# Pulse Agent - Clean Architecture

This directory contains the TypeScript agent that serves as the intelligent routing layer for Pulse.

## Architecture

```
Triggers (Gmail/Telegram) → Agent (TS + LLM) → Bricks (n8n HTTP endpoints)
```

## Files

- `src/index.ts` - Main webhook server
- `src/router.ts` - Event routing logic  
- `src/llm.ts` - Function calling with Claude/GPT
- `src/bricks.ts` - Brick API client
- `src/types.ts` - Event & brick interfaces

## Development

```bash
cd agent
npm install
npm run dev    # Start development server
npm run build  # Build for production
```

## Events

All events follow this standardized format:

```typescript
interface Event {
  type: string;           // "email.new", "chat.command", etc.
  payload: any;           // Event-specific data
  timestamp: string;      // ISO timestamp
  source: string;         // "gmail", "telegram", etc.
}
```

## Next Steps

1. Implement webhook handler in `src/index.ts`
2. Add LLM function calling in `src/llm.ts`
3. Connect to existing bricks via HTTP calls
4. Add Telegram bot integration
