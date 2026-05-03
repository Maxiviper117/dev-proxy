# DevProxy

Stable HTTPS `.local` domains for Windows development.

## Features

- **`devproxy init`** — create project config and register a domain in one command
- **Project-local config** with `.devproxy/config.json` — store name and port so `open` needs zero arguments
- **Attach-mode services** with `devproxy add` — proxy stable domains to already-running servers
- **`.local` domain generation** for readable local URLs
- **Windows hosts-file management** inside a safe, managed block
- **Caddyfile generation** and lifecycle management
- **Caddy `tls internal` HTTPS** out of the box
- **Caddy config validation and reload**
- **Service listing, removal, and diagnostics**
- **Status reporting** for Caddy, registry entries, and upstream reachability

## Quick Start

Install Caddy and trust its local CA:

```powershell
winget install CaddyServer.Caddy
caddy trust
```

Install DevProxy:

```bash
npm install -g @maxiviper117/devproxy
```

Register a service:

```bash
devproxy add api.myapp --port 8000
```

Open your new HTTPS domain:

```text
https://api.myapp.local
```

## Next Steps

- [Getting Started](/guide/getting-started)
- [Commands](/guide/commands)
- [How It Works](/guide/how-it-works)
- [Troubleshooting](/guide/troubleshooting)
- [Contributing](/development/contributing)
