# Getting Started

## Requirements

- Windows
- Node.js 22 or newer
- Caddy installed and available on `PATH`
- WSL service ports forwarded to Windows localhost

## Install Caddy

DevProxy uses Caddy for HTTPS termination and reverse-proxying.

```powershell
winget install CaddyServer.Caddy
```

Or using Scoop:

```powershell
scoop install caddy
```

After installing, trust Caddy's local CA from an elevated PowerShell session:

```powershell
caddy trust
```

Then restart your browser so it picks up the new trusted root certificate.

## Install DevProxy

### From npm

```bash
npm install -g @maxiviper117/devproxy
```

Or with pnpm:

```bash
pnpm add -g @maxiviper117/devproxy
```

Or with yarn:

```bash
yarn global add @maxiviper117/devproxy
```

After installing, confirm the CLI is available:

```bash
devproxy --help
```

### Local development

```bash
pnpm install
pnpm build
node dist/cli.js --help
```

Link the package globally for local development:

```bash
pnpm link --global
devproxy --help
```

## Register Your First Service

Start your development server in WSL. For example, a Laravel app:

```bash
php artisan serve --port=8000
```

From Windows, register the domain:

```bash
devproxy add api.myapp --port 8000
```

This creates:

```text
https://api.myapp.local -> localhost:8000, 127.0.0.1:8000
```

Open the domain:

```bash
devproxy open api.myapp
```

Or navigate to `https://api.myapp.local` in your browser.

## Service Name Rules

Service names must include at least two labels, such as `api.myapp` or `web.myapp`. Do not include the `.local` suffix yourself; DevProxy derives the domain automatically.

## Admin Permissions

Updating the Windows hosts file requires administrator rights. If DevProxy cannot write to the hosts file, it fails with a clear message telling you to rerun the same command from an elevated PowerShell session.

Commands that modify the hosts file include:

- `devproxy add <name> --port <port>`
- `devproxy remove <name>`
- `devproxy start`

Read-only commands like `devproxy list`, `devproxy status`, and `devproxy doctor` do not require elevation.
