---
title: Config
description: Schema and fields for .devproxy/config.json.
prev:
  text: Commands
  link: /reference/commands
next:
  text: Files and Paths
  link: /reference/files-and-paths
---

# Config

DevProxy stores project settings in `.devproxy/config.json`.

## Location

```text
<project-root>/.devproxy/config.json
```

## Schema

Each file includes a `$schema` field for editor support:

```json
{
  "$schema": "https://raw.githubusercontent.com/Maxiviper117/dev-proxy/main/src/core/config-schema.json"
}
```

## Fields

### `name`

Required service name used to derive the `.local` domain.

### `port`

Required local port forwarded by DevProxy.

### `open`

Optional browser target settings.

#### `open.default`

Path opened by `devproxy open` with no target argument. Defaults to `/`.

#### `open.targets`

Named paths opened by `devproxy open <target>`.

## Example

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
