# bullishNuts

A Cashu wallet PWA for sending and receiving ecash tokens.

## Environment Variables

### Nostr Integration

To enable Nostr DM functionality for sending tokens, you need to set the following environment variable:

```bash
NEXT_PUBLIC_BULLISHNUTSBOT_NSEC=nsec1your_secret_key_here
```

**How to get an nsec key:**
1. Use a Nostr client like Damus, Amethyst, or Snort
2. Export your private key in nsec format
3. Add it to your Vercel environment variables

**Security Note:** The `NEXT_PUBLIC_` prefix makes this variable available to the client-side code. This is necessary for the Nostr functionality but means the secret key will be visible in the browser. For production use, consider the security implications.

## Development

```bash
npm install
npm run dev
```

## Deployment

Deploy to Vercel with the environment variable configured in your project settings.
