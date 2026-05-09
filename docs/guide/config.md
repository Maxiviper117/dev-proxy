# Project Config

DevProxy stores project settings in `.devproxy/config.json`. This file is created by `devproxy init` and read by `devproxy open` and other project-level commands.

## Location

```text
<project-root>/.devproxy/config.json
```

## Schema

Every config file includes a `$schema` field for editor autocomplete and validation. Editors like VS Code will use it automatically:

```json
{
  "$schema": "https://raw.githubusercontent.com/Maxiviper117/dev-proxy/main/src/core/config-schema.json"
}
```

## Reference

### `name` (required)

Service name used to derive the `.local` domain. For example, `api.myapp` becomes `api.myapp.local`.

```json
{
  "name": "api.myapp"
}
```

### `port` (required)

Local port the proxy forwards traffic to. Must be an integer between 1 and 65535.

```json
{
  "port": 8000
}
```

### `open` (optional)

Named browser targets for `devproxy open`.

#### `open.default`

Path opened by `devproxy open` with no target argument. Defaults to `/` if omitted.

```json
{
  "open": {
    "default": "/dashboard"
  }
}
```

#### `open.targets`

Named paths opened by `devproxy open <target>`. Keys are target names, values are URL paths.

```json
{
  "open": {
    "targets": {
      "docs": "/docs",
      "admin": "/admin",
      "graphql": "/graphql"
    }
  }
}
```

## Full Example

```json
{
  "$schema": "https://raw.githubusercontent.com/Maxiviper117/dev-proxy/main/src/core/config-schema.json",
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

## Creating the Config

::: warning Elevated Terminal Required
`devproxy init` modifies the system hosts file. On Windows, run from an **Administrator** terminal. On macOS and Linux, run with `sudo`:

```bash
sudo devproxy init --name api.myapp --port 8000
```

Non-elevated terminals will fail with instructions on how to re-run the command.
:::

```bash
devproxy init --name api.myapp --port 8000
```

When the config already exists (for example, when a teammate clones the repo), run `devproxy init` without flags and DevProxy will prompt to register using the existing config.

```bash
devproxy init
```

## Opening Targets

```bash
devproxy open          # opens open.default or /
devproxy open docs     # opens /docs
devproxy open admin    # opens /admin
```

See [Commands](/guide/commands) for the full command reference.