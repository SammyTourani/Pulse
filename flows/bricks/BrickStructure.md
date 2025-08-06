# Create a comprehensive postmortem / playbook as a Markdown file
from textwrap import dedent

content = dedent(r"""
# Pulse Gateway & Gmail Bricks — End-to-End Postmortem & Playbook

**Scope:** Everything we touched while building and stabilizing the stage-based gateway (HMAC auth + routing) and the three Gmail bricks (`gmail.search_messages`, `gmail.create_email_draft`, `gmail.send_email`) in n8n v1.103.x.

This is meant to be a *long-form*, practical doc you can reuse when adding new bricks from other services, so you don’t repeat the same pitfalls.

---

## Table of Contents

1. [Architecture at a Glance](#architecture-at-a-glance)  
2. [Issues & Fixes — Chronological, with Root Causes](#issues--fixes—chronological-with-root-causes)  
3. [Stable Patterns to Copy](#stable-patterns-to-copy)  
4. [n8n Import/Export Gotchas](#n8n-importexport-gotchas)  
5. [Testing Matrix (T1–T5)](#testing-matrix-t1–t5)  
6. [Pre-Flight Checklist for Adding a New Brick](#pre-flight-checklist-for-adding-a-new-brick)  
7. [Appendix: Reference Snippets](#appendix-reference-snippets)

---

## Architecture at a Glance

**Gateway (pulse.gateway):**

- **Webhook Trigger** → **Prepare Request & HMAC Payload (Code)**  
  Builds `hmacPayload = "<timestamp>" + JSON.stringify(body)` and validates required fields.
- **Stage Router (Switch)** routes on `stage`:
  - `validation_error` → **Return Validation Error (Code)**
  - `validated` → **Crypto (HMAC)** → **Compare Signature (Code)** → **Auth Router (Switch)**
- **Auth Router (Switch)** routes on `stage`:
  - `auth_error` → **Normalize Response (Code)** → **Respond**
  - `auth_ok` → **Router (Switch)** → relevant **Execute Workflow** node for the brick.
- **Execute Workflow nodes** (Wait for sub-workflow, Input = `={{ $json.subInput }}`) → **Normalize Response** → **Respond**.

**Sub-workflows (one per brick):** Start with **Execute Workflow Trigger**, then a first **Code** node that *normalizes input* (supports both flat and legacy nested `params`), followed by the vendor node(s), and a **Response Formatter (Code)** that emits the normalized payload the gateway expects (or a plain object that the gateway will wrap).

---

## Issues & Fixes — Chronological, with Root Causes

### 1) IF-node misrouting (`validation_error` vs `validated`)

- **Symptom:** Requests with headers still hit `VALIDATION_ERROR`, even when `stage: "validated"` was produced.
- **Root cause:** Boolean coercion / fragile comparisons in IF node; subtle type/string matching issues.
- **Fix:** Replace IF with **Switch** nodes:
  - **Stage Router (Switch)** on `={{ $json.stage }}`; explicit rules for `validation_error` (out 0) and `validated` (out 1).
  - **Auth Router (Switch)** on `={{ $json.stage }}`; explicit rules for `auth_error` (out 0) and `auth_ok` (out 1).
- **Prevent:** Prefer **Switch** for deterministic routing on discrete string states.

---

### 2) HMAC signature length mismatch (32 hex vs 64 hex)

- **Symptom:** Provided signature (64 hex) vs computed signature (32 hex); `INVALID_SIGNATURE` always.
- **Root cause:** **Crypto node configured to MD5** in **Binary File** mode; MD5 produces a 16-byte (32 hex) digest.
- **Fix:** Crypto node → **Operation: HMAC**, **Algorithm: SHA256**, **Encoding: HEX**, **Value:** `={{ $json.hmacPayload }}`.
- **Prevent:** Lock a template Crypto node with SHA256/HEX; never use Binary File mode for string payloads.

> Note: HMAC secret length (32 or 64 hex) doesn’t matter per se; SHA256 digest is always 32 bytes (64 hex). The earlier confusion was from MD5, not key length.

---

### 3) Crypto node secret was `undefined`

- **Symptom:** Error “The `key` argument must be ... Received undefined.”
- **Root cause:** `{{$env.PULSE_HMAC_SECRET}}` didn’t resolve inside the Crypto node at runtime/import.
- **Fix:** Resolve the secret **upstream** in **Prepare Request & HMAC Payload**, include `hmacSecret` in the output JSON, then in Crypto set **Secret** to `={{ $json.hmacSecret }}`.
- **Prevent:** Avoid referencing env vars directly inside vendor nodes that sometimes evaluate expressions differently. Resolve env → JSON in a Code node first.

---

### 4) Debug node interfering with final routing

- **Symptom:** Empty/odd responses or debug payload being normalized as errors.
- **Root cause:** A temporary **Debug HMAC** node remained in the path; its output altered expected shapes.
- **Fix:** Remove the debug node; connect **Crypto → Compare Signature** directly; revert Normalize to standard behavior.
- **Prevent:** After debugging, remove or fully bypass all debug stages. Keep a “debug branch” disconnected or behind a separate toggle.

---

### 5) Empty response / hanging after auth

- **Symptom:** T2/T3 requests hang; no response.
- **Root cause(s):**
  1. **Execute Workflow nodes** pointing to **non-existent workflow IDs** (or stale IDs), so nothing executed.
  2. **Wait for sub-workflow completion** was disabled; gateway responded before sub-workflow returned.
- **Fix:**
  - In each Execute node: set **Wait for Sub-Workflow Completion** = **true**.
  - Update **workflowId** to accurate values (copy the ID from sub-workflow URL). Watch for trailing whitespace.
- **Prevent:** After import, re-select each target workflow via the UI. Confirm **Wait for Sub-Workflow Completion** and **Input** are set (see #7).

---

### 6) Wrong Execute Workflow “Input” mapping

- **Symptom:** Sub-workflow’s first Code node reports missing fields (`query field is required`).  
- **Root cause:** Execute Workflow node passed the entire gateway item (`$json`) instead of the intended **`subInput`** object.
- **Fix:** In each Execute Workflow node **Options → Input** set **Expression** to `={{ $json.subInput }}`.
- **Prevent:** Standardize: gateway always sends a **flat** `subInput` object per brick.

---

### 7) Sub-workflow expecting nested `params` while gateway sends flat

- **Symptom:** `query field is required` in sub-workflow Code; gateway shows it did pass `subInput.query`.
- **Root cause:** Sub-workflow referenced `$json.params.query` while gateway sent `$json.query` (flat).
- **Fix (normalization pattern):**
  ```js
  const input = $json || {};
  const query = input.query ?? input.params?.query;
  if (!query) throw new Error('query field is required');
  // normalize and return { json: { query, ... } }
Prevent: First Code node always accepts both flat and legacy nested, then normalizes to flat. Downstream nodes must read the flat fields only.

8) Gmail node parameter mapping & UI variations
Symptom: Red badge on Gmail nodes / missing required fields in UI.

Root cause: Imports don’t always carry over nested property mappings; different UI variants (Raw vs Subject/Message).

Fix: Two supported configurations:

Raw/MIME path (preferred for full control): map message.raw = {{$json.mimeMessage}}.

Subject/Message path (UI variant without Raw): set Email Type: HTML and set:

Subject: ={{ $json.originalInput?.subject || "" }}

Message: ={{ $json.originalInput?.body || "" }}

Prevent: After import, open each Gmail node and re-enter expressions if fields are blank or showing defaults.

9) “Found credential with no ID” on Gmail nodes
Symptom: NodeOperationError from Gmail nodes after import.

Root cause: Imported workflows lose the internal credential ID binding.

Fix: Open each Gmail node, re-select the Gmail OAuth2 credential in the dropdown.

Prevent: Always rebind credentials in the UI after imports (it’s normal).

10) “Workflow does not exist” on Execute Workflow
Symptom: Execute node throws “Workflow does not exist. { workflowId: '...' }”.

Root cause: Wrong or stale workflowId, sometimes with a trailing space.

Fix: Copy the exact ID from the sub-workflow URL, paste it into the Execute node (or pick from dropdown). Remove stray whitespace.

Prevent: Prefer selecting the workflow from the dropdown list (n8n will insert the correct ID).

11) Timestamp skew & signature normalization
Symptom: TIMESTAMP_SKEW or INVALID_SIGNATURE with seemingly good client.

Root cause(s):

Request timestamp older/newer than ±300s window.

Not stripping the sha256= prefix or mixed-case hex.

Fix:

In Compare Signature, enforce ±300s window.

Strip sha256= when present.

Lower-case both sides and constant-time compare.

Prevent: Keep these checks in the standard Compare Signature snippet (see Appendix).

12) HMAC payload construction must match exactly
Symptom: INVALID_SIGNATURE despite SHA256 configured.

Root cause: Client and gateway didn’t sign the same bytes (spaces/newlines/order).

Fix: Payload is exactly String(timestamp) + JSON.stringify(body) where body is the same object you POST.

Prevent: Use a shared utility for both client and server; never re-serialize differently server-side.

13) “Node out of date” banners
Symptom: UI shows “This node is out of date” banner.

Root cause: Minor version mismatch / old node snapshots.

Fix: Recreate the node or ignore if it executes fine. (We recreated where necessary.)

Prevent: Not blocking; treat it as a hygiene task.

Stable Patterns to Copy
Gateway — Prepare Request & HMAC Payload (Code)
Validates headers and body.

Emits stage: "validated" plus all required fields and hmacSecret (resolved from env here).

Gateway — Crypto (HMAC)
Operation: HMAC

Value: ={{ $json.hmacPayload }}

Secret: ={{ $json.hmacSecret }}

Algorithm: SHA256

Encoding: HEX

Gateway — Compare Signature (Code)
Strip sha256=; enforce ±300s skew; constant-time compare with lowercase.

Execute Workflow nodes
Wait for Sub-Workflow Completion: true

Input (Expression): ={{ $json.subInput }}

Sub-workflows
Start with Execute Workflow Trigger.

First Code node accepts flat or nested and normalizes to flat.

Vendor nodes consume normalized fields.

Response Formatter emits a normalized result (ok, brick, brickVersion, timestamp, requestId, data) or a plain object for the gateway to wrap.

n8n Import/Export Gotchas
Credentials: Must re-select in each vendor node after import (“Found credential with no ID”).

Expressions: UI may drop some nested mappings; re-enter expressions (especially for Gmail raw MIME or Subject/Message).

Workflow IDs: After import, IDs change. Update Execute Workflow nodes or select via UI.

Wait for Sub-Workflow Completion: Off by default in some cases; ensure it’s on.

Input mapping: Confirm Execute node Input is ={{ $json.subInput }}.

Testing Matrix (T1–T5)
T1 — Missing headers → MISSING_TIMESTAMP (gateway validation path).

T2 — Bad signature / old timestamp → INVALID_SIGNATURE or TIMESTAMP_SKEW (auth error path).

T3 — Valid signature, Gmail search with:

json
Always show details

Copy
{ "brick":"gmail.search_messages", "connectionId":"...", "params": { "query":"test email", "maxResults":5 } }
Expect ok=true, data.messages array.

T4 — Create draft: gmail.create_email_draft with { to, subject, body }. Expect draftId + message summary.

T5 — Send email: gmail.send_email with { to, subject, body }. Expect messageId, threadId, labelIds.

Pre-Flight Checklist for Adding a New Brick
Router: Add brick string to the gateway’s Router (Switch).

Sub-workflow: Create a workflow that starts with Execute Workflow Trigger.

Normalize input: First Code node accepts both flat and nested params, returns flat.

Vendor node: Bind credential; map expressions from normalized fields.

Response: Add a Response Formatter that returns normalized { ok, brick, data }.

Gateway Execute node: Add a new Execute Workflow node → select sub-workflow → Wait = true → Input = ={{ $json.subInput }}.

Test matrix: Run T1–T5 equivalents for the new brick (validation, auth, success, and error paths).

Appendix: Reference Snippets
A. Sub-workflow Input Normalizer (search example)
js
Always show details

Copy
// First Code node
const input = $json || {};
const query = input.query ?? input.params?.query;
const pageSize =
  input.pageSize ?? input.maxResults ??
  input.params?.pageSize ?? input.params?.maxResults ?? 10;
const userId = input.userId ?? input.params?.userId ?? 'me';
const pageToken = input.pageToken ?? input.params?.pageToken;
const connectionId = input.connectionId;
const requestId = input.requestId ?? input.params?.requestId ?? null;

if (!query) throw new Error('query field is required');
if (!connectionId) throw new Error('connectionId field is required');

return {
  json: { query, pageSize, userId, pageToken, connectionId, requestId }
};
B. Gateway Compare Signature (excerpt)
js
Always show details

Copy
let providedSignature = $json.providedSignature || '';
if (providedSignature.startsWith('sha256=')) {
  providedSignature = providedSignature.slice(7);
}
const computedSignature = $node["Crypto"].json.data;

const ts = Number($json.timestamp);
const skew = Math.abs(Math.floor(Date.now()/1000) - ts);
if (skew > 300) {
  return { json: { stage: "auth_error", error: { code: "TIMESTAMP_SKEW" } } };
}

function ctEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0; for (let i=0;i<a.length;i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

if (!ctEqual(providedSignature.toLowerCase(), computedSignature.toLowerCase())) {
  return { json: { stage: "auth_error", error: { code: "INVALID_SIGNATURE" } } };
}

return { json: { stage: "auth_ok", brick: $json.brick, subInput: $json.subInput, connectionId: $json.connectionId, requestId: $json.requestId ?? null } };
C. Execute Workflow Node Settings
Wait For Sub-Workflow Completion: ✅

Input (Expression): ={{ $json.subInput }}

D. Gmail Send / Draft — Two UI Variants
Variant A: Raw MIME
Map message.raw = {{$json.mimeMessage}} (preferred for attachments).

Variant B: Subject/Message (no Raw field)

Email Type: HTML

Subject: ={{ $json.originalInput?.subject || "" }}

Message: ={{ $json.originalInput?.body || "" }}

Final Notes
When something “hangs,” first verify Wait for Sub-Workflow Completion and workflowId are correct.

When a sub-workflow “doesn’t see” a field, check the Execute node Input mapping and the normalizer Code node.

When Gmail nodes error after import, re-bind credentials and re-enter expressions in the UI.

This playbook captures all the failure modes we encountered and the fixes that proved stable. Use it as your template whenever you add new bricks or move between environments.
""")

path = "/mnt/data/pulse-gateway-postmortem.md"
with open(path, "w", encoding="utf-8") as f:
f.write(content)

path