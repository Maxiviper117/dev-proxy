# Getting Started

## Requirements

- Windows
- Node.js 22 or newer
- Caddy installed and available on `PATH`
- Local services reachable from Windows (e.g., WSL-forwarded ports, Docker, or native Windows apps)

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

## One-Command Setup with `init`

The fastest way to set up a project is with the `init` and `run` commands.

From your project root, create a config file:

```bash
devproxy init --name api.myapp --port 8000
```

This creates `.devproxy/config.json` with your project settings.

Then start your dev server through DevProxy:

```bash
devproxy run -- php artisan serve --port=8000
```

The domain `https://api.myapp.local` is now live. Press `Ctrl+C` to stop.

```bash
devproxy open
```

Opens the domain without needing to repeat the name.

## Register an Existing Service (Attach Mode)

If your dev server is already running separately, attach DevProxy to its port:

```bash
devproxy add api.myapp --port 8000
```

This registers the domain without spawning or managing the process.

Open the domain:

```bash
devproxy open api.myapp
```

Or navigate to `https://api.myapp.local` in your browser.

## Service Name Rules

Service names can be a single label or multiple labels separated by dots, such as `myapp`, `api.myapp`, or `web.myapp`. Do not include the `.local` suffix yourself; DevProxy derives the domain automatically.

Examples:

- `myapp` becomes `https://myapp.local`
- `api.myapp` becomes `https://api.myapp.local`

## Admin Permissions

Updating the Windows hosts file requires administrator rights. If DevProxy cannot write to the hosts file, it fails with a clear message telling you to rerun the same command from an elevated PowerShell session.

Commands that modify the hosts file include:

- `devproxy add <name> --port <port>`
- `devproxy run [name] -p [port] -- <command>`
- `devproxy remove <name>`
- `devproxy start`

Read-only commands like `devproxy list`, `devproxy status`, and `devproxy doctor` do not require elevation.
