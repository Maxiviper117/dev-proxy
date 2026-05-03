# Commands

## `devproxy init --name <name> --port <port>`

Create a `.devproxy/config.json` file in the current working directory. This file stores your project's service name and port so subsequent commands can read them automatically.

```bash
devproxy init --name api.myapp --port 8000
```

Once the config file exists, `devproxy open` can omit the name:

```bash
devproxy open
```

## `devproxy add <name> --port <port>`

Register a new service.

```bash
devproxy add api.myapp --port 8000
```

This registers `https://api.myapp.local` and proxies it to `127.0.0.1:8000` and `localhost:8000`.

Service names can be a single label or multiple labels separated by dots, such as `myapp`, `api.myapp`, or `web.myapp`. Do not include the `.local` suffix yourself.

## `devproxy open [name]`

Open a registered service in your default browser.

```bash
devproxy open api.myapp
```

When `name` is omitted, it is read from `.devproxy/config.json` (see `init`):

```bash
devproxy open
```

This opens `https://<name>.local/`.

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
- Registry path and contents
- Caddyfile path and a generated preview

## `devproxy start`

Start or reload Caddy from the current registry.

```bash
devproxy start
```

This writes the Caddyfile from the current registry, validates it, reloads Caddy if it is already running, or starts Caddy if no running instance is available.

## `devproxy stop`

Stop the Caddy server.

```bash
devproxy stop
```

This stops Caddy through Caddy's admin endpoint. It does **not** stop your application process.
