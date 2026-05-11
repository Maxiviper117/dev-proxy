---
title: Use DevProxy with Vite
description: Configure Vite so a DevProxy domain can reach the dev server cleanly.
---

# Use DevProxy with Vite

Vite apps work well with DevProxy when the host OS can reach the dev server through loopback. If your app runs in WSL, Docker, or another environment that loopback cannot reach cleanly, bind the server to `0.0.0.0`.

## Start the server

```bash
pnpm dev --port 5173
```

Or:

```bash
npm run dev -- --port 5173
```

## Register with DevProxy

```bash
devproxy add web.myapp --port 5173
```

This creates:

```text
https://web.myapp.local -> 127.0.0.1:5173, localhost:5173
```

## Allow the host

Add the `.local` domain to `server.allowedHosts` and use `0.0.0.0` when needed:

```ts
export default {
  base: "/",
  server: {
    port: 5173,
    allowedHosts: ["web.myapp.local"],
    // host: "0.0.0.0",
  },
};
```

## Open the site

If the project has `.devproxy/config.json`:

```bash
devproxy open
```

