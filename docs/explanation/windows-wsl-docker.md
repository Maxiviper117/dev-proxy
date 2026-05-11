---
title: Windows, WSL, and Docker
description: How DevProxy reaches services across local environments.
---

# Windows, WSL, and Docker

DevProxy runs on the host side and proxies only to addresses that the host can actually reach.

## Loopback matters

DevProxy tries both `127.0.0.1:<port>` and `localhost:<port>` because some frameworks bind only one of those loopback addresses.

## WSL and containers

If a service is running in WSL or a container, make sure the host OS can reach its port. When the framework supports it, binding to `0.0.0.0` is often the easiest fix.

## Why this matters

The goal is a stable browser URL without requiring DevProxy to manage the app process itself.

