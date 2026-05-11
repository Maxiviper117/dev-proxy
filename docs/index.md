---
layout: home
title: DevProxy
description: Stable HTTPS `.local` domains for local development.
hero:
  name: DevProxy
  text: Stable HTTPS `.local` domains for local development
  tagline: Attach local services to trusted browser URLs on Windows, macOS, and Linux.
  actions:
    - theme: brand
      text: Get Started
      link: /tutorials/getting-started
    - theme: alt
      text: How-to Guides
      link: /how-to/
features:
  - title: Attach-first workflow
    details: "Register already-running services with `devproxy add` and keep app processes outside DevProxy."
  - title: Project-local browser targets
    details: "Store default and named open targets in `.devproxy/config.json` for repeatable project navigation."
  - title: Trusted HTTPS
    details: "Use Caddy with `tls internal` so every `.local` domain gets a browser-trusted certificate."
  - title: Safe host management
    details: "DevProxy only edits its own managed hosts block and leaves the rest of the file alone."
  - title: Clear diagnostics
    details: "`devproxy doctor` checks Caddy, hosts drift, duplicate ports, and upstream reachability."
  - title: Local dashboard
    details: "Inspect status and perform safe actions from `devproxy ui` without an elevated shell."
---

## Start here

1. [Tutorials](/tutorials/)
2. [How-to guides](/how-to/)
3. [Reference](/reference/)
4. [Explanation](/explanation/)

## Quick links

- [Install Caddy](/how-to/install-caddy)
- [Get Started](/tutorials/getting-started)
- [Commands](/reference/commands)
- [How It Works](/explanation/how-it-works)
- [Troubleshoot HTTPS](/how-to/troubleshoot-https)
- [Contributing](/development/contributing)
