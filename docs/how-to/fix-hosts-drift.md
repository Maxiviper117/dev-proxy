---
title: Fix Hosts Drift
description: Reconcile the DevProxy hosts block with the registry.
---

# Fix Hosts Drift

Use this when the hosts file no longer matches the DevProxy registry.

## Check first

```bash
devproxy doctor
```

If the managed hosts block has drifted, `doctor` will warn about it.

## Repair it

```bash
devproxy sync-hosts
```

Or let `doctor` attempt safe fixes:

```bash
devproxy doctor --fix
```

On a non-elevated terminal, fixes that need permission are reported with manual instructions.

