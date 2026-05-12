---
title: Troubleshoot HTTPS
description: Fix browser certificate warnings for DevProxy domains.
prev:
  text: Fix Hosts Drift
  link: /how-to/fix-hosts-drift
next: false
---

# Troubleshoot HTTPS

If the browser does not trust the DevProxy certificate, the Caddy local CA has not been installed in the trust store yet.

## Trust the CA

Run:

```bash
devproxy trust
```

> [!WARNING]
> Without trust store access, browsers can still show HTTPS warnings even when DevProxy and Caddy are configured correctly.

On Windows, `devproxy init` and `devproxy add` can prompt for UAC and run `caddy trust` automatically when the CA is missing.

## Use Caddy directly

If you want to run the underlying command yourself:

```bash
caddy trust
```

## Restart the browser

Close and reopen the browser after the trust store changes.
