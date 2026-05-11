---
title: Permissions
description: Which DevProxy commands need elevated permissions.
---

# Permissions

## Elevated commands

The following commands need elevated permissions because they modify the hosts file or trust store:

- `devproxy init`
- `devproxy add`
- `devproxy update`
- `devproxy remove`
- `devproxy sync-hosts`
- `devproxy trust`

`devproxy doctor --fix` may also need elevation for specific fixes such as hosts sync and cert trust.

> [!WARNING]
> DevProxy fails with platform-specific instructions instead of trying to prompt for elevation itself.

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
