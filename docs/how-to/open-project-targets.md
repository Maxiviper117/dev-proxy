---
title: Open Project Targets
description: Define and open named browser targets from .devproxy/config.json.
---

# Open Project Targets

Use project config when you want `devproxy open` to open the right page without typing the full URL every time.

## Add targets

Create or update `.devproxy/config.json`:

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

## Open them

```bash
devproxy open
devproxy open docs
devproxy open admin
```

`devproxy open` uses `open.default` when present, or `/` when it is not.

## Keep the paths short

Target values should be URL paths, not full domains. DevProxy prepends the project domain automatically.

