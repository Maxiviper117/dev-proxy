---
title: Get Started
description: Install DevProxy, register one service, and open it in a browser.
---

# Get Started

This tutorial walks through the shortest path from a running local server to a trusted `https://<name>.local` domain.

## Requirements

- Windows, macOS, or Linux
- Node.js 22 or newer
- Caddy installed and available on `PATH`
- A local service reachable from the host running DevProxy

## 1. Install Caddy

Install Caddy and confirm the binary is available:

```bash
caddy version
```

See [Install Caddy](/how-to/install-caddy) for platform-specific commands and trust-store setup.

## 2. Install DevProxy

```bash
npm install -g @maxiviper117/devproxy
```

Or:

```bash
pnpm add -g @maxiviper117/devproxy
```

Confirm the CLI works:

```bash
devproxy --help
```

## 3. Register a first service

From the host running DevProxy, register a local app:

```bash
devproxy add api.myapp --port 8000
```

DevProxy creates `https://api.myapp.local` and proxies to both `127.0.0.1:8000` and `localhost:8000`.

## 4. Open the domain

If your project has `.devproxy/config.json`, open the site with:

```bash
devproxy open
```

If you do not have project config yet, see [Set Up Your First Project](/tutorials/first-project).

## 5. Verify the setup

Use diagnostics when something does not look right:

```bash
devproxy doctor
```

