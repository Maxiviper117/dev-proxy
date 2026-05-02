# Vite

Vite projects (React, Vue, Svelte, vanilla, etc.) can be served through DevProxy on Vite's default localhost binding. If your app is running inside WSL, Docker, or another environment that Windows cannot reach through loopback, bind the dev server to `0.0.0.0`.

## Start the server

From your Vite project directory:

```bash
pnpm dev --port 5173
```

Or with npm:

```bash
npm run dev -- --port 5173
```

## Register with DevProxy

From Windows:

```bash
devproxy add web.myapp --port 5173
```

This creates:

```text
https://web.myapp.local -> 127.0.0.1:5173, localhost:5173
```

DevProxy configures Caddy to try both loopback upstreams. If Vite is reachable through `localhost:5173` but not `127.0.0.1:5173`, or the other way around, Caddy retries the working address instead of returning intermittent `502` responses.

## Configure Vite (optional)

If your app needs to accept the `.local` host, add it to Vite's `server.allowedHosts`. If Windows cannot reach the server through loopback, also set `server.host` to `"0.0.0.0"`:

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

```bash
devproxy open web.myapp
```

Or navigate to `https://web.myapp.local` in your browser.
