---
title: Install Caddy
description: Install and trust Caddy on Windows, macOS, or Linux.
prev: false
next:
  text: Register a Service
  link: /how-to/register-service
---

# Install Caddy

DevProxy uses Caddy for HTTPS termination and reverse-proxying. Install Caddy first, confirm `caddy` is on `PATH`, then trust the local CA.

See the official install guide for package-source details: <https://caddyserver.com/docs/install>.

## Windows

::: code-group

```powershell [Scoop]
scoop install caddy
```

```powershell [Chocolatey]
choco install caddy
```

:::

Verify the install:

```powershell
caddy version
```

> [!WARNING]
> Trust Caddy's local CA from an elevated PowerShell session:

```powershell
caddy trust
```

If you run `devproxy init` or `devproxy add` on Windows, DevProxy can prompt for UAC and run `caddy trust` automatically when the local CA has not been generated yet.

## macOS

```bash
brew install caddy
```

Verify the install:

```bash
caddy version
```

> [!WARNING]
> Trust Caddy's local CA by approving the UAC prompt on Windows:

```bash
caddy trust
```

If your trust store needs administrator privileges, rerun the command with `sudo`.

## Linux

::: code-group

```bash [Debian / Ubuntu / Raspbian]
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg
sudo chmod o+r /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

```bash [Fedora]
sudo dnf install dnf5-plugins
sudo dnf copr enable @caddy/caddy
sudo dnf install caddy
```

```bash [Red Hat / CentOS]
sudo dnf install dnf-plugins-core
sudo dnf copr enable @caddy/caddy
sudo dnf install caddy
```

```bash [Arch / Manjaro / Parabola]
sudo pacman -Syu caddy
```

:::

Verify the install:

```bash
caddy version
```

> [!WARNING]
> Trust Caddy's local CA with elevated permissions:

```bash
sudo caddy trust
```

## After installation

Run:

```bash
devproxy doctor
```
