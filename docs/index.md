# DevProxy

Stable HTTPS `.local` domains for local development on Windows, macOS, and Linux.

## What DevProxy does

- **`devproxy init`** — create project config and register a domain in one command; re-run in an existing project to register from config
- **Project-local config** with `.devproxy/config.json` — store name, port, and named browser targets so `open` needs zero arguments
- **Named open targets** — `devproxy open docs` opens `/docs`, `devproxy open admin` opens `/admin`, and so on
- **Attach-mode services** with `devproxy add` — proxy stable domains to already-running servers
- **In-place updates** with `devproxy update` — change a service port or rename it without remove-and-re-add
- **`.local` domain generation** for readable local URLs
- **Hosts-file management** inside a safe, managed block
- **Caddyfile generation** and lifecycle management
- **Caddy `tls internal` HTTPS** out of the box
- **Caddy config validation and reload**
- **`devproxy doctor` verifies generated Caddy config and detects duplicate ports**
- **Service listing, removal, and diagnostics**
- **Status reporting** for Caddy, registry entries, and upstream reachability
- **Local browser dashboard** with `devproxy ui` for setup visibility and non-elevated actions; it opens on `127.0.0.1:3579` by default and supports `--port` overrides

## Start here

1. [Tutorials](/tutorials/)
2. [How-to guides](/how-to/)
3. [Reference](/reference/)
4. [Explanation](/explanation/)

## Quick links

- [Install Caddy](/how-to/install-caddy)
- [Get Started](/tutorials/getting-started)
- [Commands](/reference/commands)
- [How It Works](/explanation/how-it-works)
- [Troubleshoot HTTPS](/how-to/troubleshoot-https)
- [Contributing](/development/contributing)
