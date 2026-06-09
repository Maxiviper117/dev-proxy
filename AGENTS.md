# AGENTS.md

## Project

DevProxy is a cross-platform TypeScript CLI that maps stable HTTPS `.local` domains to local development services on Windows, macOS, and Linux. On Windows, it also works with apps running in WSL, Docker, or natively on Windows when they are reachable through loopback. The npm package is `@maxiviper117/devproxy`; the CLI binary is `devproxy`.

Use `TODO.md` for future enhancements, deferred product work, and follow-up hardening tasks.

## Tooling

- Package manager: `pnpm`
- Runtime: Node.js 22+
- Module format: native ESM
- CLI framework: Commander
- CLI UI rendering: Ink + React via `renderToString()` for formatted command/help output
- Web UI: Vite + Svelte 5 SPA
- Linter: Oxlint
- Formatter: Oxfmt
- Tests: Vitest
- Releases: Google Release Please normal pre-1.0 releases
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
- Docs dev server: `pnpm docs:dev`
- Docs build: `pnpm docs:build`
- Docs preview: `pnpm docs:preview`

Before finishing code changes, run:

```bash
pnpm fmt:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

If `pnpm fmt:check` fails, run `pnpm fmt` and then run `pnpm fmt:check` again to verify.

For publishing-related changes, also run:

```bash
pnpm pack --dry-run
```

## Releases

- CI workflow lives in `.github/workflows/ci.yml`.
- `ci / checks` runs only for pull requests targeting `main` (including new commits pushed to those PRs); it does not run again on the merge commit pushed to `main`.
- `ci / checks` runs on a Windows, macOS, and Linux matrix so platform-specific regressions are caught before merge.
- `ci / checks` is skipped for draft pull requests and only starts once the PR is ready for review.
- The CI workflow normalizes Git line endings before checkout so Windows runners preserve LF files for `oxfmt --check`.
- Local CI can be run with `pnpm act:ci` for Linux, `pnpm act:ci:windows` on Windows, and `pnpm act:ci:macos` on macOS. Each command uses the checked-in pull request event payload in `.act/pull_request.json` and selects one matrix entry with `act`.
- Release Please config lives in `release-please-config.json`.
- Release Please manifest lives in `.release-please-manifest.json`.
- GitHub Actions workflow lives in `.github/workflows/release-please.yml`.
- Release Please is manifest-driven for the root Node package and uses normal pre-1.0 releases with the fixed component/tag format `devproxy-v<version>`.
- `bump-minor-pre-major: true` keeps breaking changes below `1.0.0` until an intentional `1.0.0` release is requested.
- Release Please creates release PRs and GitHub releases. npm staging runs automatically in CI after a Release Please release is created on `main`, and a maintainer must manually approve the staged package before it becomes publicly available.
- GitHub repository settings must allow GitHub Actions to create and approve pull requests for Release Please to work reliably.
- Release publishes run to completion for a given ref; do not reintroduce `cancel-in-progress` on the release workflow unless the publish flow changes.
- `RELEASE_PLEASE_TOKEN` is required. Configure it as a PAT or GitHub App token with enough permission to create and update branches, pull requests, releases, and labels so the release PR triggers normal CI instead of approval-gated `GITHUB_TOKEN` workflow runs.
- The workflow validates `RELEASE_PLEASE_TOKEN` in a shell step via the job environment. Do not use `secrets.*` directly inside an `if:` expression in this workflow; GitHub Actions workflow validation rejects that before jobs start.
- The publish job is set up for npm Trusted Publishing via GitHub Actions OIDC and stages with `npm stage publish --access public --provenance`. Keep `id-token: write` intact unless the publishing model changes.
- The publish job must use npm CLI `11.5.1` or later for trusted publishing and staged publishing. The workflow currently installs npm `11.15.0` explicitly before `pnpm pack --dry-run` and `npm stage publish` so the runner is not dependent on the Node image's bundled npm version.
- Configure the npm trusted publisher for `.github/workflows/release-please.yml` with `npm stage publish` permission. Stage approval still requires maintainer proof-of-presence and 2FA.
- After CI stages a release, approve it manually through `npm stage approve <stage-id>` or the npmjs.com staged packages UI. Use `npm stage list @maxiviper117/devproxy` to find the stage ID when approving from the CLI.
- When ready for the first stable release, use a commit footer like `Release-As: 1.0.0`.
- Keep commits Conventional Commits-compatible so Release Please can infer versions. Examples:
  - `feat: add devproxy open command`
  - `fix: improve Caddy lifecycle messages`
  - `docs: add screenshots for Caddy flow`
  - `chore: update AGENTS.md with new safety rules`
  - Never use brackets in commit messages since they can interfere with Release Please parsing; for example, use `feat: add devproxy open command` instead of `feat(cli): add devproxy open command`.

## Architecture

- `src/cli.ts` is the npm binary entrypoint and defines the Commander CLI.
- `src/cli/` contains terminal presentation helpers and Ink-based UI renderers.
- `src/commands/` contains command-level workflows. `src/commands/services.ts` is a barrel for the class-based service API; implementation lives in `src/commands/services/` by domain (`RegistryService`, `ProjectService`, `CaddyService`, and `DiagnosticsService`).
- `src/commands/elevated.ts` contains the privileged helper operations that the Windows UAC flow calls through a hidden CLI command.
- `src/commands/ui.ts` contains `devproxy ui` command orchestration (port selection, browser launch, lifecycle).
- `src/core/` contains domain validation, registry logic, shared types, and errors.
- `src/integrations/` contains external integration logic such as Caddy and hosts-file management.
- `src/platform/` contains runtime path resolution, default context creation, probe helpers, child-process execution, and the Windows elevation runner.
- `src/ui/server.ts` contains the localhost-only dashboard server and API routes.
- `ui/` contains the Svelte 5 SPA source built into `dist/ui-static/`.
- `test/helpers/temp-context.ts` provides `createTempContext()` for integration tests; it creates a `DevProxyContext` backed by temp directories that never touch the real system.
- `test/integration.test.ts` contains full-stack integration tests using `createTempContext()` with stub Caddy commands and temp file paths.

## Safety Rules

- Keep `AGENTS.md` up to date after any project change that affects setup, commands,
  architecture, safety rules, or contributor workflow.
- Keep `docs/` (VitePress) up to date when adding, removing, or changing CLI commands or
  product behaviour. Every new command must have a section in `docs/guide/commands.md`.
  Feature additions should be reflected in the `docs/index.md` feature list.
- Keep `src/core/config-schema.json` in sync when the `.devproxy/config.json` shape
  changes (new fields, renamed fields, or type changes). The schema is copied to
  `dist/` during `pnpm build` and referenced via a `$schema` field in every
  generated config file.
- Do not touch the real system hosts file in tests.
- Keep filesystem paths and command execution injectable through `DevProxyContext`.
- Tests should use temp directories and mocked `CommandRunner` implementations.
- DevProxy must only modify hosts entries inside its own marker block:
  - `# BEGIN DEVPROXY`
  - `# END DEVPROXY`
- Windows UAC elevation is an explicit product decision for the minimum privileged helper surface.
- DevProxy may prompt for UAC only for hosts-file or trust-store changes. On macOS and Linux, it still falls back to clear elevated-shell instructions.
- If hosts-file access is missing and UAC is unavailable or declined, fail with clear platform-appropriate elevated-permission instructions.

## Product Defaults

- MVP mode is attach-first: users provide a port with `devproxy add <name> --port <port>`.
- `devproxy init [--name <name> --port <port>]` creates `.devproxy/config.json` and registers the service. When the config already exists, running `devproxy init` without flags prompts to confirm using the existing config. Declining with `--name` and `--port` provided overwrites the config.
- Domain derivation is `<name>.local`; for example, `api.myapp` becomes `api.myapp.local`.
- `devproxy open [target]` opens a browser target from `.devproxy/config.json`. Without a target, opens `open.default` or `/`. With a target name, opens the corresponding path from `open.targets`. Requires `.devproxy/config.json`.
- `devproxy update <name> [--port <port>] [--name <name>]` updates an existing service port or renames it, re-derives the domain, rewrites hosts and Caddy config, and reloads Caddy.
- `devproxy start` starts or reloads Caddy from the current registry.
- `devproxy ui [--host <host> --port <port> --no-open]` starts a localhost dashboard for non-elevated status, diagnostics, and safe actions.
- `devproxy status` reports Caddy running state, registered services, and upstream reachability.
- `devproxy doctor` warns when the DevProxy-owned hosts block has drifted from the global registry.
- `devproxy sync-hosts` rewrites the DevProxy-owned hosts block so it matches the global registry.
- `devproxy stop` stops Caddy; it does not stop attach-mode app processes.
- Caddy integration uses generated Caddyfile reloads, not the Caddy Admin API.
- If `caddy reload` reports that `localhost:2019` is unavailable, DevProxy starts Caddy with the generated config.
- If Caddy is missing, CLI errors and `doctor` output must include actionable install commands.
- Proxy upstreams should include both `127.0.0.1:<port>` and `localhost:<port>`, with IPv4 loopback first so tools like Vite that bind localhost narrowly work before falling back to IPv6 localhost.
- HTTPS uses Caddy `tls internal`.
- Managed process spawning is deferred. `devproxy stop <name>` currently reports that attach services cannot be stopped.

## Formatting

- Use Oxfmt for formatting; do not introduce Prettier.
- Use Oxlint for linting; do not reintroduce ESLint unless there is a specific rule gap that Oxlint cannot cover.
- Keep generated `dist/` files out of source edits unless intentionally rebuilding package output.
