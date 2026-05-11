---
title: Set Up Your First Project
description: Create project config, define open targets, and reopen the site from the repo.
prev:
  text: Get Started
  link: /tutorials/getting-started
next:
  text: Register a Service
  link: /how-to/register-service
---

# Set Up Your First Project

Use this tutorial when you already know the service port and want a project-local config that lets teammates open the right browser target from the repo.

## 1. Create the project config

From the project root:

```bash
devproxy init --name api.myapp --port 8000
```

This writes `.devproxy/config.json`, registers the service, and prepares the local domain.

## 2. Add browser targets

Put common pages in the config:

```json
{
  "name": "api.myapp",
  "port": 8000,
  "open": {
    "default": "/",
    "targets": {
      "docs": "/docs",
      "admin": "/admin"
    }
  }
}
```

Now the project can open named targets:

```bash
devproxy open
devproxy open docs
devproxy open admin
```

## 3. Reuse the config on another machine

If a teammate clones the repo and the config already exists, they can run:

```bash
devproxy init
```

DevProxy prompts before reusing the existing config so the project name and port stay explicit.
