# AGENTS.md

## Project

DevProxy is a Windows-native TypeScript CLI that maps stable HTTPS `.local` domains to development services running in WSL. The npm package is `@maxiviper117/devproxy`; the CLI binary is `devproxy`.

Use `TODO.md` for future enhancements, deferred product work, and follow-up hardening tasks.

## Tooling

- Package manager: `pnpm`
- Runtime: Node.js 22+
- Module format: native ESM
- CLI framework: Commander
- Linter: Oxlint
- Formatter: Oxfmt
- Tests: Vitest
- Releases: Google Release Please beta prereleases
- TypeScript config:
  - `tsconfig.json` for editor/workspace diagnostics across source and tests
  - `tsconfig.build.json` for package output
  - `tsconfig.test.json` for no-emit test typechecking

## Commands

- Install dependencies: `pnpm install`
- Clean build output: `pnpm clean`
- Typecheck: `pnpm typecheck`
- Test: `pnpm test`
- Lint: `pnpm lint`
- Lint fix: `pnpm lint:fix`
- Format: `pnpm fmt`
- Format check: `pnpm fmt:check`
- Build: `pnpm build`
- Package dry run: `pnpm pack --dry-run`

Before finishing code changes, run:

```bash
pnpm fmt:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

For publishing-related changes, also run:

```bash
pnpm pack --dry-run
```

## Releases

- CI workflow lives in `.github/workflows/ci.yml`.
- Release Please config lives in `release-please-config.json`.
- Release Please manifest lives in `.release-please-manifest.json`.
- GitHub Actions workflow lives in `.github/workflows/release-please.yml`.
- Release Please creates release PRs and GitHub releases only; do not add automated npm publishing unless explicitly requested.
- npm publishing is manual from a local machine after running the full checks and `pnpm pack --dry-run`.
- Keep commits Conventional Commits-compatible so Release Please can infer versions.

## Architecture

- `src/cli.ts` is the npm binary entrypoint and defines the Commander CLI.
- `src/cli/` contains terminal presentation helpers such as colored output.
- `src/commands/` contains command-level workflows.
- `src/core/` contains domain validation, registry logic, shared types, and errors.
- `src/integrations/` contains external integration logic such as Caddy and the Windows hosts file.
- `src/platform/` contains runtime path resolution and child-process execution.

## Safety Rules

- Keep `AGENTS.md` up to date after any project change that affects setup, commands,
  architecture, safety rules, or contributor workflow.
- Do not touch the real Windows hosts file in tests.
- Keep filesystem paths and command execution injectable through `DevProxyContext`.
- Tests should use temp directories and mocked `CommandRunner` implementations.
- DevProxy must only modify hosts entries inside its own marker block:
  - `# BEGIN DEVPROXY`
  - `# END DEVPROXY`
- Do not add automatic UAC elevation without an explicit product decision.
- If hosts-file access is missing, fail with a clear administrator rerun instruction.

## Product Defaults

- MVP mode is attach-first: users provide a port with `devproxy add <name> --port <port>`.
- Domain derivation is `<name>.local`; for example, `api.myapp` becomes `api.myapp.local`.
- `devproxy start` starts or reloads Caddy from the current registry.
- `devproxy stop` stops Caddy; it does not stop attach-mode app processes.
- Caddy integration uses generated Caddyfile reloads, not the Caddy Admin API.
- If `caddy reload` reports that `localhost:2019` is unavailable, DevProxy starts Caddy with the generated config.
- If Caddy is missing, CLI errors and `doctor` output must include actionable install commands.
- Proxy upstreams should include both `localhost:<port>` and `127.0.0.1:<port>` so Windows apps that bind IPv6 localhost or IPv4 loopback work.
- HTTPS uses Caddy `tls internal`.
- Managed process spawning is deferred. `devproxy stop <name>` currently reports that attach services cannot be stopped.

## Formatting

- Use Oxfmt for formatting; do not introduce Prettier.
- Use Oxlint for linting; do not reintroduce ESLint unless there is a specific rule gap that Oxlint cannot cover.
- Keep generated `dist/` files out of source edits unless intentionally rebuilding package output.
