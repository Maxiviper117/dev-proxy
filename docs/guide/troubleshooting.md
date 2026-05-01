# Troubleshooting

## Caddy is not found

Install Caddy and confirm it is on `PATH`:

```powershell
winget install CaddyServer.Caddy
```

Or:

```powershell
scoop install caddy
```

Then open a new terminal and run:

```bash
caddy version
```

## Caddy reload says localhost:2019 refused the connection

That means Caddy is installed but not currently running. DevProxy starts Caddy automatically when it sees this condition. If it still fails, run:

```bash
caddy start --config "%APPDATA%\devproxy\Caddyfile"
```

## Browser does not trust the certificate

Run this from an elevated PowerShell session:

```powershell
caddy trust
```

Then restart the browser.

## Domain does not resolve

Check the hosts file contains a DevProxy block for the domain:

```text
C:\Windows\System32\drivers\etc\hosts
```

Also run:

```bash
devproxy doctor
```

## Proxy cannot reach the WSL app

Confirm the service is reachable from Windows:

```bash
curl http://localhost:8000
curl http://127.0.0.1:8000
```

If the app only binds to the WSL interface, start it with a host option such as `--host 0.0.0.0` where supported.
