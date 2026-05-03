# How It Works

## Overview

When you run a development server on your local machine, Windows can usually reach it through `localhost:<port>`. DevProxy builds on that behavior and keeps the network-facing pieces on Windows:

- hosts-file entries
- trusted HTTPS certificates
- Caddy reverse proxy
- browser-facing `.local` domains

Your app can run in WSL, Docker, or natively on Windows. DevProxy registers a Windows hosts entry such as:

```text
127.0.0.1 api.myapp.local
```

Then Caddy receives `https://api.myapp.local` and proxies it back to the local port through both `127.0.0.1:8000` and `localhost:8000`, retrying the alternate address if one loopback binding is unavailable.

## Lifecycle for Adding a Service

For a service named `api.myapp` on port `8000`, DevProxy:

1. Derives the domain `api.myapp.local`.
2. Stores service metadata in `%APPDATA%/devproxy/registry.json`.
3. Adds `127.0.0.1 api.myapp.local` inside its managed hosts-file block.
4. Generates `%APPDATA%/devproxy/Caddyfile`.
5. Runs `caddy validate --config <Caddyfile>`.
6. Runs `caddy reload --config <Caddyfile>`.
7. Runs `caddy start --config <Caddyfile>` if reload reports that no Caddy admin endpoint is running yet.

## Service Modes

DevProxy supports two service modes:

- **Attach** (`devproxy add`) — registers a domain for an already-running dev server. DevProxy does not manage the server process.
- **Managed** (`devproxy run`) — starts the dev server as a child process and registers the domain. The process inherits stdio so you see live output. When the process exits, its PID is cleared from the registry.

## Project Config

When you run `devproxy init --name <name> --port <port>` from your project root, DevProxy creates:

```text
.devproxy/config.json
```

This file stores the project's service name and port. Once present, commands like `devproxy run` and `devproxy open` can read the name and port from it, letting you omit arguments:

```bash
devproxy open          # domain from config
devproxy run -- npm run dev   # name and port from config
```

## Managed Files

### Registry

```text
%APPDATA%/devproxy/registry.json
```

Stores the list of registered services.

### Caddyfile

```text
%APPDATA%/devproxy/Caddyfile
```

Generated from the registry. Uses `tls internal` and forwards common proxy headers:

- `Host`
- `X-Forwarded-Host`
- `X-Forwarded-Proto`
- `X-Forwarded-Port`
- `X-Forwarded-For`

### Hosts File

```text
C:\Windows\System32\drivers\etc\hosts
```

DevProxy only manages entries inside this block:

```text
# BEGIN DEVPROXY
127.0.0.1 api.myapp.local
# END DEVPROXY
```

Entries outside that block are left alone.

## Examples

See the [Examples](/examples/) section for step-by-step guides for Laravel, Vite, Express.js, Next.js, and other frameworks.
