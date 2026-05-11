---
title: HTTPS and Trust
description: Why DevProxy uses Caddy internal TLS and how trust is established.
---

# HTTPS and Trust

DevProxy uses Caddy's internal CA to provide trusted HTTPS for local domains.

## What Caddy does

Caddy generates certificates for `https://<name>.local` using its local root CA. Browsers trust those certificates only after the root CA is installed in the operating system trust store.

## When trust happens automatically

If `devproxy init` or `devproxy add` runs from an already elevated terminal, DevProxy can trust the local CA automatically when the certificate has not yet been generated.

## When you need to trust manually

Run:

```bash
devproxy trust
```

or:

```bash
caddy trust
```

if the browser still warns about the certificate.

