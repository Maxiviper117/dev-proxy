---
title: Use DevProxy with Laravel
description: Serve a Laravel app behind DevProxy.
---

# Use DevProxy with Laravel

Laravel works with DevProxy when the host running DevProxy can reach the dev server through loopback.

## Start the server

```bash
php artisan serve --port=8000
```

## Register with DevProxy

```bash
devproxy add api.myapp --port 8000
```

This creates:

```text
https://api.myapp.local -> 127.0.0.1:8000, localhost:8000
```

## Open the site

If the project has `.devproxy/config.json`:

```bash
devproxy open
```

