---
title: Run the Dashboard
description: Start the local DevProxy dashboard for status and safe actions.
---

# Run the Dashboard

Use the dashboard when you want a local, non-elevated view of status and safe actions.

## Start it

```bash
devproxy ui
```

This starts a localhost-only server, opens it in your browser, and keeps running until you stop it with `Ctrl+C`.

## Adjust the port

```bash
devproxy ui --port 4173
```

## Skip browser launch

```bash
devproxy ui --no-open
```

## Override the bind host

```bash
devproxy ui --host 127.0.0.1 --port 3579
```

