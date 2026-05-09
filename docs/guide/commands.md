# Commands

Commands that update the system hosts file or the system trust store need
elevated permissions: `devproxy init`, `devproxy add`, `devproxy remove`, and
`devproxy trust`. Commands such as `devproxy start`, `devproxy stop`,
`devproxy open`, `devproxy list`, `devproxy status`, `devproxy doctor`, and
`devproxy certs` do not modify the hosts file or trust store and should run
without `sudo` or an elevated shell.

## `devproxy init [--name <name> --port <port>]`

Create a `.devproxy/config.json` file and register the service in one step.

### First time (no config file)

```bash
devproxy init --name api.myapp --port 8000
```

This registers `https://api.myapp.local`, writes the project config file, updates the hosts file, generates the Caddyfile, and reloads Caddy. If the terminal is already running with elevated permissions (Administrator on Windows, `sudo` on macOS/Linux), it also runs `caddy trust` automatically so the local CA is trusted immediately.

### With an existing config file

When `.devproxy/config.json` already exists, you can run `devproxy init` without flags to register the service from the config:

```bash
devproxy init
```

DevProxy detects the existing config and prompts:

```text
Found existing .devproxy/config.json:
  name: api.myapp
  port: 8000

Use this config? [y/N]
```

Answering `y` registers the service using the existing config. Answering `n` aborts; provide `--name` and `--port` to overwrite with new values:

```bash
devproxy init --name newapp --port 9000
```

If flags are provided alongside an existing config, DevProxy still prompts to confirm whether to use the existing config. Declining overwrites the config with the new values.

Once the config file exists, `devproxy open` can open the domain:

```bash
devproxy open
```

## `devproxy add <name> --port <port>`

Register a new service.

```bash
devproxy add api.myapp --port 8000
```

This registers `https://api.myapp.local` and proxies it to `127.0.0.1:8000` and `localhost:8000`. If the terminal is already running with elevated permissions, it also runs `caddy trust` automatically so the local CA is trusted immediately.

Service names can be a single label or multiple labels separated by dots, such as `myapp`, `api.myapp`, or `web.myapp`. Do not include the `.local` suffix yourself.

## `devproxy open [target]`

Open a browser target from the project's `.devproxy/config.json` in your default browser.

```bash
devproxy open
```

Opens the default URL for the project. When no `open.default` is set, this opens `https://<name>.local/`. When `open.default` is set to a path like `/dashboard`, this opens `https://<name>.local/dashboard`.

```bash
devproxy open docs
```

Opens the named target's path. Targets are defined in `.devproxy/config.json` under `open.targets`. For example, with this config:

```json
{
  "name": "api.myapp",
  "port": 8000,
  "open": {
    "default": "/",
    "targets": {
      "docs": "/docs",
      "admin": "/admin",
      "graphql": "/graphql"
    }
  }
}
```

- `devproxy open` opens `https://api.myapp.local/` (the `default` path)
- `devproxy open docs` opens `https://api.myapp.local/docs`
- `devproxy open admin` opens `https://api.myapp.local/admin`

If you specify a target that is not listed in `open.targets`, DevProxy shows an error with the list of available targets.

The `open` command requires a `.devproxy/config.json` in the current directory. Run `devproxy init` first to create one.

## `devproxy list`

List all registered services.

```bash
devproxy list
```

Alias: `devproxy ls`

## `devproxy status`

Report Caddy running state, registered services, and upstream reachability.

```bash
devproxy status
```

This reports:

- Whether Caddy's admin endpoint is reachable
- How many services are registered
- Whether each service's `localhost:<port>` and `127.0.0.1:<port>` upstreams respond

## `devproxy remove <name>`

Remove a registered service.

```bash
devproxy remove api.myapp
```

Alias: `devproxy rm api.myapp`

This removes the registry entry, rewrites the DevProxy hosts-file block, regenerates the Caddyfile, and reloads Caddy.

## `devproxy doctor`

Check setup and report diagnostics.

```bash
devproxy doctor
```

This reports:

- Platform and Node version
- Caddy availability
- Hosts-file write access
- Whether DevProxy hosts entries match the registry
- Registry path and contents
- Caddyfile path and a generated preview

If the DevProxy hosts block has drifted from the registry, `doctor` warns and
suggests `devproxy sync-hosts`.

## `devproxy sync-hosts`

Align the DevProxy-owned hosts-file block with the global registry.

```bash
devproxy sync-hosts
```

This rewrites only the entries between `# BEGIN DEVPROXY` and
`# END DEVPROXY` so they match `registry.json`. Run it from an elevated
terminal when hosts-file write access requires administrator or sudo rights.

## `devproxy start`

Start or reload Caddy from the current registry.

```bash
devproxy start
```

This writes the Caddyfile from the current registry, validates it, reloads Caddy if it is already running, or starts Caddy if no running instance is available.

If Caddy's local root CA certificate has not been generated yet and you are
not running from an elevated shell, DevProxy warns before starting because
browsers may show HTTPS certificate warnings until you run `devproxy trust` or
`caddy trust` with the privileges needed to update your trust store.

## `devproxy trust`

Trust the Caddy local root CA certificate.

```bash
devproxy trust
```

When run from an elevated terminal (Administrator on Windows, `sudo` on
macOS/Linux), this runs `caddy trust` directly. When not elevated, it prints
platform-specific instructions telling you how to rerun the command with the
required privileges.

This is useful when you did not run `devproxy init` or `devproxy add` from an
elevated shell and your browser still warns about the HTTPS certificate.

## `devproxy stop`

Stop the Caddy server.

```bash
devproxy stop
```

This stops Caddy through Caddy's admin endpoint. It does **not** stop your application process.
