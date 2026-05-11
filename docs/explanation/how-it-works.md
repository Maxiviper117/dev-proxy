---
title: How It Works
description: DevProxy's attach-first proxy model and managed infrastructure.
---

# How It Works

DevProxy keeps the network-facing pieces on the host operating system and leaves your app process alone.

## The model

- Your app runs natively, in WSL, or in a container if the host can reach it
- DevProxy registers a stable `.local` hostname
- The hosts file maps that hostname to `127.0.0.1`
- Caddy terminates HTTPS with `tls internal`
- Caddy proxies the request back to the local port

## Attach-first workflow

DevProxy is designed for attach mode. You start the server yourself, then register the port with `devproxy add`.

## Lifecycle

For a service named `api.myapp` on port `8000`, DevProxy:

1. Derives `api.myapp.local`
2. Stores service metadata in the platform data directory
3. Writes the DevProxy-managed hosts entry
4. Generates the Caddyfile
5. Validates the Caddyfile
6. Reloads Caddy, or starts it if needed

## Managed files

The registry, Caddyfile, and managed hosts block are the only persistent files DevProxy owns.

