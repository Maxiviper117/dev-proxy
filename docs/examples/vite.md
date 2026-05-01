# Vite

Vite projects (React, Vue, Svelte, vanilla, etc.) can be served through DevProxy by binding the dev server to `0.0.0.0` so Windows can reach it.

## Start the server

From your Vite project directory:

```bash
pnpm dev --host 0.0.0.0 --port 5173
```

Or with npm:

```bash
npm run dev -- --host 0.0.0.0 --port 5173
```

## Register with DevProxy

From Windows:

```bash
devproxy add web.myapp --port 5173
```

This creates:

```text
https://web.myapp.local -> localhost:5173, 127.0.0.1:5173
```

## Configure Vite (optional)

If your app needs to know its public URL, set the environment variable or configure the base path in `vite.config.ts`:

```ts
export default {
  base: "/",
  server: {
    port: 5173,
    host: "0.0.0.0",
  },
};
```

## Open the site

```bash
devproxy open web.myapp
```

Or navigate to `https://web.myapp.local` in your browser.
