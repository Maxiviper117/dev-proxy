# DevProxy

### Stable HTTPS local domains for Windows + WSL development

[![CI](https://github.com/Maxiviper117/dev-proxy/actions/workflows/ci.yml/badge.svg)](https://github.com/Maxiviper117/dev-proxy/actions/workflows/ci.yml) ![npm](https://img.shields.io/badge/npm-unpublished-lightgrey) ![beta](https://img.shields.io/badge/beta-pending-lightgrey) [![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE) [![node](https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js&logoColor=white)](package.json) [![pnpm](https://img.shields.io/badge/pnpm-10.33.0-F69220?logo=pnpm&logoColor=white)](package.json) [![typescript](https://img.shields.io/badge/TypeScript-ESM-3178C6?logo=typescript&logoColor=white)](tsconfig.json)

DevProxy is a Windows-native CLI for stable HTTPS local domains that proxy to development services running in WSL.

## Why Windows + WSL

When you run a development server inside WSL, Windows can usually reach it through `localhost:<port>`. For example, a Laravel, Node, or Vite server running in WSL on port `8000` can often be opened from the Windows browser at:

```text
http://localhost:8000
```

DevProxy builds on that behavior. It keeps the network-facing pieces on Windows:

- hosts-file entries
- trusted HTTPS certificates
- Caddy reverse proxy
- browser-facing `.local` domains

Your app still runs normally in WSL. DevProxy registers a Windows hosts entry such as:

```text
127.0.0.1 api.myapp.local
```

Then Caddy receives:

```text
https://api.myapp.local
```

and proxies it back to the WSL-forwarded port:

```text
localhost:8000
```

This gives a WSL app a real HTTPS local domain without moving the app into Docker, changing WSL networking, or installing certificates inside the Linux environment.

Instead of opening `http://localhost:8000`, register a readable local domain:

```bash
devproxy add api.myapp --port 8000
```

Then open:

```text
https://api.myapp.local
```

DevProxy writes a managed Windows hosts-file block, generates a Caddyfile, and reloads Caddy so traffic to the domain is reverse-proxied to both `localhost:<port>` and `127.0.0.1:<port>`.

## Status

This project is currently an MVP.

Included:

- attach-mode services with explicit ports
- `.local` domain generation
- Windows hosts-file management
- Caddyfile generation
- Caddy start and stop commands
- Caddy `tls internal` HTTPS
- Caddy config validation and reload
- basic listing, removal, and diagnostics

Deferred:

- managed process spawning
- automatic port detection
- automatic UAC elevation
- Caddy Admin API integration
- mkcert integration
- wildcard DNS
- UI dashboard

## Requirements

- Windows
- Node.js 22 or newer
- pnpm for local development
- Caddy installed and available on `PATH`
- WSL service ports forwarded to Windows localhost

CLI output uses color when the terminal supports it.

Install Caddy separately, then trust Caddy's local CA from an elevated PowerShell session:

```powershell
caddy trust
```

DevProxy does not install Caddy or automatically elevate permissions.

## Install

Published package target:

```bash
npm install -g @maxiviper117/devproxy
```

Local development:

```bash
pnpm install
pnpm build
node dist/cli.js --help
```

## Commands

### Add a service

```bash
devproxy add <name> --port <port>
```

Example:

```bash
devproxy add api.myapp --port 8000
```

This registers:

```text
https://api.myapp.local -> localhost:8000, 127.0.0.1:8000
```

Service names must include at least two labels, such as `api.myapp` or `web.myapp`. Do not include the `.local` suffix yourself.

### List services

```bash
devproxy list
```

Alias:

```bash
devproxy ls
```

### Remove a service

```bash
devproxy remove api.myapp
```

Alias:

```bash
devproxy rm api.myapp
```

This removes the registry entry, rewrites the DevProxy hosts-file block, regenerates the Caddyfile, and reloads Caddy.

### Check setup

```bash
devproxy doctor
```

This reports platform, Caddy availability, hosts-file write access, registry path, Caddyfile path, and a generated Caddyfile preview.

### Start Caddy

```bash
devproxy start
```

This writes the Caddyfile from the current registry, validates it, reloads Caddy if it is already running, or starts Caddy if no running instance is available.

### Stop Caddy

```bash
devproxy stop
```

This stops the Caddy server through Caddy's admin endpoint. It does not stop your application process.

## How It Works

For a service named `api.myapp` on port `8000`, DevProxy:

1. Derives the domain `api.myapp.local`.
2. Stores service metadata in `%APPDATA%/devproxy/registry.json`.
3. Adds `127.0.0.1 api.myapp.local` inside its managed hosts-file block.
4. Generates `%APPDATA%/devproxy/Caddyfile`.
5. Runs `caddy validate --config <Caddyfile>`.
6. Runs `caddy reload --config <Caddyfile>`.
7. Runs `caddy start --config <Caddyfile>` if reload reports that no Caddy admin endpoint is running yet.

You can also manage Caddy directly through DevProxy:

```bash
devproxy start
devproxy stop
```

The generated Caddy route uses `tls internal` and forwards common proxy headers:

- `Host`
- `X-Forwarded-Host`
- `X-Forwarded-Proto`
- `X-Forwarded-Port`
- `X-Forwarded-For`

## Managed Files

Registry:

```text
%APPDATA%/devproxy/registry.json
```

Caddyfile:

```text
%APPDATA%/devproxy/Caddyfile
```

Hosts file:

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

## Admin Permissions

Updating the Windows hosts file requires administrator rights. If DevProxy cannot write to the hosts file, it fails with a clear message telling you to rerun the same command from an elevated PowerShell session.

## Laravel Example

Start Laravel in WSL:

```bash
php artisan serve --port=8000
```

Register the domain from Windows:

```bash
devproxy add api.myapp --port 8000
```

Set Laravel environment values:

```env
APP_URL=https://api.myapp.local
SESSION_DOMAIN=.myapp.local
```

Then open:

```text
https://api.myapp.local
```

## Frontend Example

Start a Vite app in WSL:

```bash
pnpm dev --host 0.0.0.0 --port 5173
```

Register it:

```bash
devproxy add web.myapp --port 5173
```

Then open:

```text
https://web.myapp.local
```

## Development

Install dependencies:

```bash
pnpm install
```

Run checks:

```bash
pnpm fmt:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

### Run the CLI from this project

Build first:

```bash
pnpm build
```

Run the compiled CLI directly:

```bash
node dist/cli.js --help
node dist/cli.js list
node dist/cli.js start
node dist/cli.js doctor
```

Link the package globally for local development:

```bash
pnpm link --global
devproxy --help
devproxy list
devproxy start
devproxy doctor
```

Commands that update the Windows hosts file must be run from an elevated PowerShell session:

```powershell
devproxy add api.myapp --port 8000
devproxy remove api.myapp
```

Use `node dist/cli.js ...` when you want to test the current build without linking globally.

Package dry run:

```bash
pnpm pack --dry-run
```

Useful scripts:

- `pnpm clean` removes `dist`
- `pnpm fmt` formats with Oxfmt
- `pnpm lint` lints with Oxlint
- `pnpm test` runs Vitest
- `pnpm build` cleans and compiles TypeScript

## Beta Releases

This repository is configured for Google Release Please in beta prerelease mode.

CI runs on pull requests and pushes to `main` using `.github/workflows/ci.yml`. It checks formatting, linting, TypeScript, tests, build output, and npm package contents.

On pushes to `main`, `.github/workflows/release-please.yml` runs `googleapis/release-please-action@v4` with:

- `release-please-config.json`
- `.release-please-manifest.json`
- `release-type: node`
- `prerelease: true`
- `prerelease-type: beta`

Release Please opens or updates a Release PR based on Conventional Commits. When that Release PR is merged, the workflow creates the GitHub release and publishes the package to npm with the `beta` dist-tag:

```bash
npm publish --tag beta --access public
```

Required repository secret:

```text
NPM_TOKEN
```

Install beta releases with:

```bash
npm install -g @maxiviper117/devproxy@beta
```

## Troubleshooting

### Caddy is not found

Install Caddy and confirm it is on `PATH`:

```powershell
winget install CaddyServer.Caddy
```

or:

```powershell
scoop install caddy
```

Then open a new terminal and run:

```bash
caddy version
```

### Caddy reload says localhost:2019 refused the connection

That means Caddy is installed but not currently running. DevProxy starts Caddy automatically when it sees this condition. If it still fails, run:

```bash
caddy start --config "%APPDATA%\devproxy\Caddyfile"
```

### Browser does not trust the certificate

Run this from an elevated PowerShell session:

```powershell
caddy trust
```

Then restart the browser.

### Domain does not resolve

Check the hosts file contains a DevProxy block for the domain:

```text
C:\Windows\System32\drivers\etc\hosts
```

Also run:

```bash
devproxy doctor
```

### Proxy cannot reach the WSL app

Confirm the service is reachable from Windows:

```bash
curl http://localhost:8000
curl http://127.0.0.1:8000
```

If the app only binds to the WSL interface, start it with a host option such as `--host 0.0.0.0` where supported.
