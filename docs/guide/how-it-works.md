# How It Works

## Overview

When you run a development server inside WSL, Windows can usually reach it through `localhost:<port>`. DevProxy builds on that behavior and keeps the network-facing pieces on Windows:

- hosts-file entries
- trusted HTTPS certificates
- Caddy reverse proxy
- browser-facing `.local` domains

Your app still runs normally in WSL. DevProxy registers a Windows hosts entry such as:

```text
127.0.0.1 api.myapp.local
```

Then Caddy receives `https://api.myapp.local` and proxies it back to the WSL-forwarded port `localhost:8000`.

## Lifecycle for Adding a Service

For a service named `api.myapp` on port `8000`, DevProxy:

1. Derives the domain `api.myapp.local`.
2. Stores service metadata in `%APPDATA%/devproxy/registry.json`.
3. Adds `127.0.0.1 api.myapp.local` inside its managed hosts-file block.
4. Generates `%APPDATA%/devproxy/Caddyfile`.
5. Runs `caddy validate --config <Caddyfile>`.
6. Runs `caddy reload --config <Caddyfile>`.
7. Runs `caddy start --config <Caddyfile>` if reload reports that no Caddy admin endpoint is running yet.

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

### Laravel

Start Laravel in WSL:

```bash
php artisan serve --port=8000
```

Register the domain from Windows:

```bash
devproxy add api.myapp --port 8000
```

Set Laravel environment values:

```text
APP_URL=https://api.myapp.local
SESSION_DOMAIN=.myapp.local
```

Then open `https://api.myapp.local`.

### Vite Frontend

Start a Vite app in WSL:

```bash
pnpm dev --host 0.0.0.0 --port 5173
```

Register it:

```bash
devproxy add web.myapp --port 5173
```

Then open `https://web.myapp.local`.
