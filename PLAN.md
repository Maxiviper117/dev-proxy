# DevProxy MVP Implementation Plan

## Summary

Build an attach-first Windows-native CLI using modern TypeScript, Commander, and pnpm. The MVP maps named HTTPS `.local` domains to already-running WSL services by port, manages hosts-file entries, generates a Caddyfile, reloads Caddy, and persists registry state.

Package defaults:

- npm package name: `@maxiviper117/devproxy`
- CLI binary name: `devproxy`
- GitHub repository metadata: `Maxiviper117/dev-proxy`
- Package manager: `pnpm`
- CLI parser: `commander`
- Runtime target: current active Node LTS, ESM-only TypeScript

## Key Changes

- Scaffold a publish-ready modern TypeScript package:
  - `package.json` with `"type": "module"`, `exports`, `bin`, `files`, repository, bugs, homepage, keywords, license, and `publishConfig: { "access": "public" }`.
  - `tsconfig.json` using `module: "NodeNext"`, `moduleResolution: "NodeNext"`, `target: "ES2022"` or newer, strict mode, declaration output, and source maps.
  - pnpm scripts for `build`, `typecheck`, `test`, `lint`, and `pack:dry`.
  - CLI entrypoint with Node shebang and Commander command definitions.
- Use modern TypeScript patterns:
  - native ESM imports.
  - `node:` built-in imports.
  - `async/await` throughout.
  - discriminated unions for command results and service modes.
  - `satisfies` for config-like constants.
  - dependency injection for filesystem/process paths so tests never touch real system files.
  - `unknown` in catch blocks with explicit error normalization.
- Implement commands:
  - `devproxy add <name> --port <port>` registers `https://<name>.local`.
  - `devproxy remove <name>` removes registry, hosts entry, and Caddy route.
  - `devproxy list` prints registered services with domain, port, and status.
  - `devproxy doctor` checks Windows, Caddy availability, config paths, and hosts permissions.
  - `devproxy stop <name>` returns a clear "managed services are not supported yet" message for MVP attach services.
- Store registry at `%APPDATA%/devproxy/registry.json` with name, domain, port, mode=`attach`, and timestamps.
- Generate `%APPDATA%/devproxy/Caddyfile`:
  - one HTTPS site per registered domain.
  - `tls internal`.
  - `reverse_proxy 127.0.0.1:<port>`.
  - forward `Host`, `X-Forwarded-Host`, `X-Forwarded-Proto`, `X-Forwarded-Port`, and `X-Forwarded-For`.
- Manage only DevProxy-owned hosts entries using marker comments.
  - If not elevated, fail with the exact PowerShell command to rerun as admin.
- Caddy integration:
  - require `caddy` on `PATH`.
  - run `caddy validate --config <Caddyfile>`.
  - run `caddy reload --config <Caddyfile>`.
  - print `caddy trust` guidance when trust setup appears missing.

## Public Interface

Primary MVP flow:

```bash
pnpm install
pnpm build

devproxy add api.myapp --port 8000
devproxy add web.myapp --port 5173
devproxy list
devproxy remove api.myapp
```

Published install target:

```bash
npm install -g @maxiviper117/devproxy
devproxy add api.myapp --port 8000
```

Domain derivation:

```text
<name>.local
```

So:

```text
api.myapp -> api.myapp.local
```

Future managed process shape is reserved as:

```bash
devproxy run api.myapp -- php artisan serve --port=8000
```

## Test Plan

- Unit tests:
  - Commander command parsing and validation.
  - domain/name validation.
  - registry create/list/remove behavior.
  - Caddyfile generation for one and multiple services.
  - hosts-file block insertion/removal without touching unrelated entries.
  - admin detection and elevated-command message formatting.
- CLI tests:
  - `add` rejects invalid names, duplicate names, and invalid ports.
  - `list` handles empty and populated registries.
  - `remove` handles missing services cleanly.
  - `doctor` reports missing Caddy and permission issues.
  - `stop` returns the attach-mode unsupported message.
- Packaging checks:
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
  - `pnpm pack --dry-run`

## Assumptions

- The npm scope `@maxiviper117` is available to your npm account.
- The public CLI command should stay `devproxy` even though the npm package is scoped.
- The repo URL should be `https://github.com/Maxiviper117/dev-proxy`.
- Caddy is installed separately and available on `PATH`.
- WSL services are reachable from Windows at `127.0.0.1:<port>`.
- Caddy internal CA is the MVP HTTPS mechanism; mkcert, DNS server, UI, process spawning, wildcard DNS, and Caddy Admin API are deferred.
