---
title: Register a Service
description: Attach an already-running app to a stable DevProxy domain.
prev:
  text: Install Caddy
  link: /how-to/install-caddy
next:
  text: Open Project Targets
  link: /how-to/open-project-targets
---

# Register a Service

Use this when your app already runs on a known port and you want DevProxy to put it behind `https://<name>.local`.

## Start the app

Make sure the server is already running and reachable from the host running DevProxy.

> [!NOTE]
> DevProxy is attach-first. It does not start or stop your app process.

## Register the port

```bash
devproxy add api.myapp --port 8000
```

This creates `https://api.myapp.local` and proxies to both `127.0.0.1:8000` and `localhost:8000`.

## Choose a name

Service names can use dots for subdomains:

- `myapp` becomes `https://myapp.local`
- `api.myapp` becomes `https://api.myapp.local`

Do not add the `.local` suffix yourself.

## Create project config later

If you also want `devproxy open` and named browser targets, run `devproxy init` from the project root to create `.devproxy/config.json`.
