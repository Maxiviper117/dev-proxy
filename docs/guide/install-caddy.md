# Install Caddy

DevProxy uses Caddy for HTTPS termination and local reverse-proxying. Install Caddy first, make sure the `caddy` command is available on `PATH`, then trust Caddy's local certificate authority.

These commands follow the official Caddy installation guidance. See the Caddy docs for the full list of supported package sources and service setup notes: <https://caddyserver.com/docs/install>.

## Windows

The Caddy docs list Chocolatey and Scoop as community-maintained Windows package options.

Using Scoop:

```powershell
scoop install caddy
```

Using Chocolatey:

```powershell
choco install caddy
```

If you install Caddy from a downloaded archive instead, place `caddy.exe` in a directory that is already on `%PATH%`, or add its directory to `%PATH%` yourself.

Open a new terminal and verify the install:

```powershell
caddy version
```

Then trust Caddy's local CA from an elevated PowerShell session:

```powershell
caddy trust
```

Restart your browser after trusting the CA.

## macOS

The Caddy docs list Homebrew as the common community-maintained macOS package option:

```bash
brew install caddy
```

Open a new terminal and verify the install:

```bash
caddy version
```

Then trust Caddy's local CA:

```bash
caddy trust
```

If your trust store requires administrator privileges, rerun the trust command with `sudo`. Restart your browser after trusting the CA.

## Linux

Caddy publishes official packages for Debian, Ubuntu, Raspbian, Fedora, Red Hat, CentOS, Arch Linux, Manjaro, and Parabola.

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

Restart your browser after trusting the CA.

## After Installation

Run DevProxy diagnostics:

```bash
devproxy doctor
```

If DevProxy still says Caddy is missing, open a new terminal and confirm `caddy version` works from the same shell where you run `devproxy`.
