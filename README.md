# bullishNuts

A Cashu wallet PWA for sending and receiving ecash tokens.

## Nostr Integration

The app automatically generates an ephemeral Nostr key for encrypted messaging when needed. This key is stored in localStorage under the key `bullishnuts_ephemeralKey` and is used for sending encrypted messages to Nostr users.

**Security Note:** The ephemeral key is generated locally and stored in the browser's localStorage. It's used only for encrypted messaging and is not tied to any permanent identity.

## Development

```bash
npm install
npm run dev
```

## Deployment

Deploy to Vercel with the environment variable configured in your project settings.
