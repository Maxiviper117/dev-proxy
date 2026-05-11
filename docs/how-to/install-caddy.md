---
title: Install Caddy
description: Install and trust Caddy on Windows, macOS, or Linux.
---

# Install Caddy

DevProxy uses Caddy for HTTPS termination and reverse-proxying. Install Caddy first, confirm `caddy` is on `PATH`, then trust the local CA.

See the official install guide for package-source details: <https://caddyserver.com/docs/install>.

## Windows

Using Scoop:

```powershell
scoop install caddy
```

Using Chocolatey:

```powershell
choco install caddy
```

Verify the install:

```powershell
caddy version
```

Then trust Caddy's local CA from an elevated PowerShell session:

```powershell
caddy trust
```

If you run `devproxy init` or `devproxy add` from an elevated terminal, DevProxy can run `caddy trust` automatically when the local CA has not been generated yet.

## macOS

```bash
brew install caddy
```

Verify the install:

```bash
caddy version
```

Then trust Caddy's local CA:

```bash
caddy trust
```

If your trust store needs administrator privileges, rerun the command with `sudo`.

## Linux

### Debian, Ubuntu, and Raspbian

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg
sudo chmod o+r /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

### Fedora

```bash
sudo dnf install dnf5-plugins
sudo dnf copr enable @caddy/caddy
sudo dnf install caddy
```

### Red Hat, CentOS, and compatible dnf systems

```bash
sudo dnf install dnf-plugins-core
sudo dnf copr enable @caddy/caddy
sudo dnf install caddy
```

### Arch, Manjaro, and Parabola

```bash
sudo pacman -Syu caddy
```

Verify the install:

```bash
caddy version
```

Then trust Caddy's local CA:

```bash
sudo caddy trust
```

## After installation

Run:

```bash
devproxy doctor
```

