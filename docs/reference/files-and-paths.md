---
title: Files and Paths
description: Managed files and platform-specific locations used by DevProxy.
prev:
  text: Config
  link: /reference/config
next:
  text: Permissions
  link: /reference/permissions
---

# Files and Paths

## Project config

```text
<project-root>/.devproxy/config.json
```

## Registry

Windows:

```text
%APPDATA%/devproxy/registry.json
```

macOS:

```text
~/Library/Application Support/devproxy/registry.json
```

Linux:

```text
${XDG_DATA_HOME:-~/.local/share}/devproxy/registry.json
```

## Caddyfile

Windows:

```text
%APPDATA%/devproxy/Caddyfile
```

macOS:

```text
~/Library/Application Support/devproxy/Caddyfile
```

Linux:

```text
${XDG_DATA_HOME:-~/.local/share}/devproxy/Caddyfile
```

## Hosts file

Windows:

```text
C:\Windows\System32\drivers\etc\hosts
```

macOS and Linux:

```text
/etc/hosts
```

DevProxy only manages entries inside this block:

```text
# BEGIN DEVPROXY
127.0.0.1 api.myapp.local
# END DEVPROXY
```
