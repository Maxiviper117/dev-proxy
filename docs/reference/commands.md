---
title: Commands
description: Canonical CLI command reference for DevProxy.
---

# Commands

> [!WARNING]
> Commands that modify the system hosts file or trust store need elevated permissions: `devproxy init`, `devproxy add`, `devproxy update`, `devproxy remove`, `devproxy sync-hosts`, and `devproxy trust`. `devproxy doctor --fix` may also need elevation for specific fixes.

## `devproxy init [--name <name> --port <port>]`

Create `.devproxy/config.json` and register the service.

```bash
devproxy init --name api.myapp --port 8000
```

If the config already exists, `devproxy init` without flags prompts before reusing it.

## `devproxy add <name> --port <port>`

Register an already-running local service.

```bash
devproxy add api.myapp --port 8000
```

## `devproxy open [target]`

Open the current project from `.devproxy/config.json`.

```bash
devproxy open
devproxy open docs
```

## `devproxy list`

List registered services.

```bash
devproxy list
```

Alias: `devproxy ls`

## `devproxy ui [--host <host> --port <port> --no-open]`

Start the localhost-only dashboard.

```bash
devproxy ui
```

## `devproxy status`

Report Caddy state, registered services, and upstream reachability.

```bash
devproxy status
```

## `devproxy update <name> [--port <port>] [--name <name>]`

Update a service's port or rename it.

```bash
devproxy update api.myapp --port 9000
```

## `devproxy remove [name]`

Remove one or more services.

```bash
devproxy remove api.myapp
```

Alias: `devproxy rm`

## `devproxy doctor [--fix] [--non-interactive]`

Check setup and report diagnostics.

```bash
devproxy doctor
devproxy doctor --fix
```

## `devproxy sync-hosts`

Rewrite only the DevProxy-managed hosts block so it matches the registry.

```bash
devproxy sync-hosts
```

## `devproxy start`

Start or reload Caddy from the current registry.

```bash
devproxy start
```

## `devproxy stop`

Stop Caddy.

```bash
devproxy stop
```

## `devproxy certs`

Print Caddy root CA certificate information.

```bash
devproxy certs
```

## `devproxy trust`

Trust the Caddy local root CA certificate.

```bash
devproxy trust
```
