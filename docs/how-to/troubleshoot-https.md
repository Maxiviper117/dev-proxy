---
title: Troubleshoot HTTPS
description: Fix browser certificate warnings for DevProxy domains.
---

# Troubleshoot HTTPS

If the browser does not trust the DevProxy certificate, the Caddy local CA has not been installed in the trust store yet.

## Trust the CA

Run:

```bash
devproxy trust
```

If you already have an elevated terminal, `devproxy init` and `devproxy add` can run `caddy trust` automatically when the CA is missing.

## Use Caddy directly

If you want to run the underlying command yourself:

```bash
caddy trust
```

## Restart the browser

Close and reopen the browser after the trust store changes.

