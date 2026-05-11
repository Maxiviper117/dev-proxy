---
title: Use DevProxy with Next.js
description: Run Next.js through DevProxy and keep generated URLs pointed at the .local domain.
---

# Use DevProxy with Next.js

Next.js works best when the dev server binds to `0.0.0.0` and DevProxy registers the port from the host OS.

## Start the server

```bash
pnpm dev --hostname 0.0.0.0 --port 3000
```

Or:

```bash
npm run dev -- --hostname 0.0.0.0 --port 3000
```

## Register with DevProxy

```bash
devproxy add web.myapp --port 3000
```

This creates:

```text
https://web.myapp.local -> 127.0.0.1:3000, localhost:3000
```

## Set the public site URL

If the app generates absolute URLs, point it at the DevProxy domain:

```text
NEXT_PUBLIC_SITE_URL=https://web.myapp.local
```

You can place that in `.env.local`.

