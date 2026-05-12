---
title: Permissions
description: Which DevProxy commands need elevated permissions.
---

# Permissions

## Elevated commands

The following commands may prompt for UAC on Windows because they modify the hosts file or trust store:

- `devproxy init`
- `devproxy add`
- `devproxy update`
- `devproxy remove`
- `devproxy sync-hosts`
- `devproxy trust`

`devproxy doctor --fix` may also need elevation for specific fixes such as hosts sync and cert trust.

> [!WARNING]
> DevProxy prompts for elevation on Windows only when it needs to update the hosts file or trust store. On macOS and Linux, it still falls back to platform-specific instructions.

When testing a local build on Windows, `node dist/cli.js add api.myapp --port 8000` uses the same UAC flow as the installed `devproxy` binary. The current terminal stays unelevated; DevProxy launches a short-lived elevated helper for the protected operation and then returns to the original command.

## Non-elevated commands

These commands should run without `sudo` or Administrator rights:

- `devproxy start`
- `devproxy stop`
- `devproxy open`
- `devproxy ui`
- `devproxy list`
- `devproxy status`
- `devproxy doctor`
- `devproxy certs`
