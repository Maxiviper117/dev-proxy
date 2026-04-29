# TODO

## Near Term

- Add an integration test mode that uses temporary Caddy/hosts paths and never touches the real system.
- Add a `devproxy status` command that reports Caddy running state, registered services, and upstream reachability.
- Add a `devproxy trust` helper that checks Caddy trust state and prints the exact elevated `caddy trust` command when needed.
- Improve Caddy lifecycle messages so users can tell whether DevProxy reloaded an existing server or started a new one.
- Add tests for hosts-file permission failures and friendly `EPERM`/`EACCES` messaging.

## CLI UX

- Add `--json` output for `list`, `doctor`, and future automation-friendly commands.
- Add `--verbose` to show underlying Caddy commands and paths.
- Add `devproxy open <name>` to open `https://<name>.local` in the default browser.
- Add `devproxy logs` if DevProxy starts managing Caddy logs or process metadata.
- Consider `devproxy update <name> --port <port>` instead of requiring remove/add for port changes.

## Managed Processes

- Add `devproxy run <name> -- <command>` to start an app process and register its domain in one command.
- Track managed process metadata separately from attach-mode services.
- Add managed-process stop/restart behavior without affecting attach-mode services.
- Add port inference for common commands where reliable, while keeping explicit `--port` supported.
- Capture stdout/stderr for managed commands without hiding interactive dev-server output.

## Caddy

- Decide whether to keep Caddyfile reloads long term or move to the Caddy Admin API.
- Add safer Caddy ownership boundaries if the user already has a non-DevProxy Caddy process running.
- Add support for custom Caddy binary path.
- Add support for custom admin endpoint if the default `localhost:2019` is unavailable.
- Add optional access/error log configuration.

## Domain And Networking

- Add configurable root domain instead of hard-coding `.local`.
- Add wildcard DNS support as an alternative to hosts-file entries.
- Add checks for `.local` conflicts with mDNS behavior.
- Add upstream health checks for `localhost:<port>` and `127.0.0.1:<port>`.
- Add IPv6 loopback support explicitly if needed.

## HTTPS

- Improve certificate-trust diagnostics.
- Add optional mkcert support.
- Document browser-specific trust/cache troubleshooting.
- Add a command to print certificate/root CA information.

## Packaging And Release

- Add changelog generation.
- Add npm provenance once publishing is ready.
- Add Windows install smoke tests.
- Revisit Release Please beta prerelease settings before the first stable release.

## Documentation

- Add screenshots or terminal examples for the successful Caddy flow.
- Add WSL-specific recipes for Laravel, Vite, Node, and PHP built-in server.
- Add troubleshooting docs for ports, Caddy admin endpoint conflicts, and certificate trust.
- Add architecture notes for contributors.
