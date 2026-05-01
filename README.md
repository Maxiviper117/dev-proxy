# DevProxy

### Stable HTTPS local domains for Windows + WSL development

[![npm](https://img.shields.io/npm/v/@maxiviper117/devproxy)](https://www.npmjs.com/package/@maxiviper117/devproxy) ![status](https://img.shields.io/badge/status-pre--1.0-orange) [![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE) [![node](https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js&logoColor=white)](package.json) [![pnpm](https://img.shields.io/badge/pnpm-10.33.0-F69220?logo=pnpm&logoColor=white)](package.json) [![typescript](https://img.shields.io/badge/TypeScript-ESM-3178C6?logo=typescript&logoColor=white)](tsconfig.json)

DevProxy is a Windows-native CLI for stable HTTPS `.local` domains that proxy to development services running in WSL.

## Documentation

Full documentation is hosted at [https://maxiviper117.github.io/dev-proxy/](https://maxiviper117.github.io/dev-proxy/).

## Quick Start

1. Install [Caddy](https://caddyserver.com/) and trust its CA:

   ```powershell
   winget install CaddyServer.Caddy
   caddy trust
   ```

2. Install DevProxy:

   ```bash
   npm install -g @maxiviper117/devproxy
   ```

3. Register a service:

   ```bash
   devproxy add api.myapp --port 8000
   ```

4. Open your domain:

   ```text
   https://api.myapp.local
   ```

## Commands

| Command | Description |
| --- | --- |
| `devproxy add <name> --port <port>` | Register a new service |
| `devproxy open <name>` | Open a service in your browser |
| `devproxy list` | List all registered services |
| `devproxy status` | Report Caddy state and upstream health |
| `devproxy remove <name>` | Remove a registered service |
| `devproxy doctor` | Check setup and diagnostics |
| `devproxy start` | Start or reload Caddy |
| `devproxy stop` | Stop Caddy |

## Requirements

- Windows
- Node.js 22 or newer
- Caddy installed and available on `PATH`
- WSL service ports forwarded to Windows localhost

## License

[MIT](LICENSE)
