# Getting Started

## Requirements

- Windows, macOS, or Linux
- Node.js 22 or newer
- Caddy installed and available on `PATH`
- Local services reachable from the host running DevProxy

## Install Caddy

DevProxy uses Caddy for HTTPS termination and reverse-proxying. Install Caddy for your operating system, then confirm it is available on `PATH`:

```bash
caddy version
```

See [Install Caddy](/guide/install-caddy) for Windows, macOS, and Linux commands.

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

## Project Setup with `init`

From your project root, the easiest way to get started is:

```bash
devproxy init --name api.myapp --port 8000
```

This creates `.devproxy/config.json` and registers the service in one step. If the terminal is already elevated (Administrator on Windows, `sudo` on macOS/Linux), it also runs `caddy trust` automatically so the local CA is trusted immediately. Your domain is live immediately.

If `.devproxy/config.json` already exists (for example, when cloning a repo), you can run `devproxy init` without flags. DevProxy detects the existing config and prompts to confirm using it to register the service.

```bash
devproxy open
```

Opens the domain (reads the name from project config).

You can add named browser targets to `.devproxy/config.json` for common project URLs:

```json
{
  "name": "api.myapp",
  "port": 8000,
  "open": {
    "default": "/",
    "targets": {
      "docs": "/docs",
      "admin": "/admin"
    }
  }
}
```

Then open them by name:

```bash
devproxy open          # opens https://api.myapp.local/
devproxy open docs     # opens https://api.myapp.local/docs
devproxy open admin    # opens https://api.myapp.local/admin
```

## Register a Service Manually

You can also register a service separately:

```bash
devproxy add api.myapp --port 8000
```

This registers the domain without spawning or managing the process.

To open the service in your browser, run `devproxy init` from your project directory first to create `.devproxy/config.json`, then use `devproxy open`.

## Service Name Rules

Service names can be a single label or multiple labels separated by dots, such as `myapp`, `api.myapp`, or `web.myapp`. Do not include the `.local` suffix yourself; DevProxy derives the domain automatically.

Examples:

- `myapp` becomes `https://myapp.local`
- `api.myapp` becomes `https://api.myapp.local`

## Elevated Permissions

::: warning Elevated permissions required
Updating the system hosts file requires elevated permissions. If DevProxy cannot write to the hosts file, it fails with a clear message telling you to rerun the same command from an elevated shell.

Commands that modify the hosts file include:

- `devproxy init --name <name> --port <port>`
- `devproxy add <name> --port <port>`
- `devproxy remove <name>`

`devproxy trust` also requires elevation because it updates the system trust store.

Commands like `devproxy start`, `devproxy stop`, `devproxy list`, `devproxy status`, and `devproxy doctor` do not modify the hosts file or trust store and should not require elevation. When using `devproxy doctor --fix`, certain fixes (hosts sync, cert trust) still require elevation and will be skipped with manual instructions if run from a non-elevated terminal.

When you run `devproxy init` or `devproxy add` from an already-elevated terminal, DevProxy automatically runs `caddy trust` for you if the local CA certificate has not been generated yet. This means you usually do not need to run `devproxy trust` separately.
:::

## Windows and WSL

On Windows, DevProxy runs on the Windows side and can proxy to apps running in WSL when the app's port is reachable from Windows. If a WSL app is not reachable through loopback, bind the dev server to `0.0.0.0` where the framework supports it.
