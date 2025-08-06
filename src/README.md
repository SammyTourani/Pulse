# Pulse Brick Client

A TypeScript client for calling bricks through the Pulse Gateway with HMAC authentication.

## Usage

### Basic Example

```typescript
import { callBrick, createBrickClient } from './brick-client';

// Option 1: Direct function call
const result = await callBrick(
  {
    gatewayUrl: 'http://localhost:5678',
    hmacSecret: process.env.PULSE_HMAC_SECRET!,
    timeoutMs: 30000
  },
  {
    brick: 'gmail.send_email',
    connectionId: 'user-connection-123',
    params: {
      to: ['recipient@example.com'],
      subject: 'Hello from Pulse',
      body: '<p>This email was sent via Pulse Gateway!</p>',
      userId: 'me',
      tenantId: 'tenant-123'
    }
  }
);

// Option 2: Pre-configured client
const client = createBrickClient({
  gatewayUrl: 'http://localhost:5678',
  hmacSecret: process.env.PULSE_HMAC_SECRET!
});

const result = await client({
  brick: 'gmail.search_messages',
  connectionId: 'user-connection-123',
  params: {
    query: 'from:important@company.com',
    maxResults: 10,
    userId: 'me',
    tenantId: 'tenant-123'
  }
});
```

### Error Handling

```typescript
import { BrickExecutionError } from './brick-client';

try {
  const result = await client({
    brick: 'gmail.send_email',
    connectionId: 'user-connection-123',
    params: { /* ... */ }
  });
  
  console.log('Success:', result.data);
  
} catch (error) {
  if (error instanceof BrickExecutionError) {
    // Brick-level error (e.g., validation failed, API error)
    console.error('Brick failed:', error.response.error);
    
    if (error.response.error?.retryable) {
      // Can retry after delay
      const retryAfter = error.response.error.retryAfterMs || 5000;
      console.log(`Retryable error, wait ${retryAfter}ms`);
    }
  } else {
    // Network or gateway error
    console.error('Gateway error:', error.message);
  }
}
```

## Available Bricks

### Gmail Bricks

#### `gmail.send_email`
- **Params**: `{ to, subject, body, cc?, bcc?, attachments?, userId, tenantId }`
- **Returns**: `{ messageId, threadId }`

#### `gmail.create_email_draft`  
- **Params**: `{ to, subject, body, cc?, bcc?, attachments?, userId, tenantId }`
- **Returns**: `{ draftId, messageId }`

#### `gmail.search_messages`
- **Params**: `{ query, maxResults?, userId, tenantId }`
- **Returns**: `{ messages, nextPageToken?, cached }`

## Testing

Run the test script to verify your setup:

```bash
npm run test:brick-client
```

Make sure your `.env` file contains:
```
PULSE_HMAC_SECRET=your-secret-here
```

And that n8n is running with the Pulse Gateway workflow imported and active.
