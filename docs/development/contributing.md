# Contributing

## Tooling

- Package manager: `pnpm`
- Runtime: Node.js 22+
- Module format: native ESM
- CLI framework: Commander
- Linter: Oxlint
- Formatter: Oxfmt
- Tests: Vitest

## Install Dependencies

```bash
pnpm install
```

## Run Checks

Before submitting changes, run:

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

## Run the CLI from This Project

Build first:

```bash
pnpm build
```

Run the compiled CLI directly:

```bash
node dist/cli.js --help
node dist/cli.js list
node dist/cli.js start
node dist/cli.js doctor
```

Link the package globally for local development:

```bash
pnpm link --global
devproxy --help
devproxy list
devproxy start
devproxy doctor
```

Commands that update the system hosts file must be run from an elevated shell:

```powershell
devproxy add api.myapp --port 8000
devproxy remove api.myapp
```

Use `node dist/cli.js ...` when you want to test the current build without linking globally.

## Useful Scripts

- `pnpm clean` removes `dist`
- `pnpm fmt` formats with Oxfmt
- `pnpm lint` lints with Oxlint
- `pnpm test` runs Vitest
- `pnpm build` cleans and compiles TypeScript

## Architecture

- `src/cli.ts` is the npm binary entrypoint and defines the Commander CLI.
- `src/cli/` contains terminal presentation helpers such as colored output.
- `src/commands/` contains command-level workflows.
- `src/core/` contains domain validation, registry logic, shared types, and errors.
- `src/integrations/` contains external integration logic such as Caddy and hosts-file management.
- `src/platform/` contains runtime path resolution, default context creation, probe helpers, and child-process execution.

## Testing

### Unit Tests

Unit tests live alongside the integration tests in `test/` and cover pure functions (`updateHostsContent`, `generateCaddyfile`) and individual modules with mocked dependencies (`CommandRunner`, filesystem I/O).

```bash
pnpm test
```

### Integration Tests

Integration tests in `test/integration.test.ts` exercise the full command stack — registry writes, hosts-file updates, Caddyfile generation, and Caddy lifecycle — using isolated temp directories that never touch the real system.

The `test/helpers/temp-context.ts` module provides `createTempContext()` which builds a `DevProxyContext` backed by:

- A temp directory for the registry, Caddyfile, and hosts file
- A stub `CommandRunner` that simulates Caddy subcommands without requiring a real Caddy binary
- Overrideable probes (`probeTcp`, `probeUrl`, `probeHttps`) for status checks

### Caddyfile Admin Port Isolation

`generateCaddyfile` and `writeCaddyfile` accept an optional `CaddyfileOptions` with an `adminPort` field. When set, the generated Caddyfile includes an `admin localhost:<port>` block so integration Caddy instances do not conflict with any real Caddy running on the default `localhost:2019` endpoint.

## Safety Rules

- Do not touch the real system hosts file in tests.
- Keep filesystem paths and command execution injectable through `DevProxyContext`.
- Use `createTempContext()` from `test/helpers/temp-context.ts` for integration tests — it creates temp directories and stub command runners that never touch the real system.
- Unit tests should use temp directories and mocked `CommandRunner` implementations.
- DevProxy must only modify hosts entries inside its own marker block:
  - `# BEGIN DEVPROXY`
  - `# END DEVPROXY`
- Do not add automatic UAC elevation without an explicit product decision.
- If hosts-file access is missing, fail with clear platform-appropriate elevated-permission instructions.

## Docs Development

Start the VitePress dev server:

```bash
pnpm docs:dev
```

Build the docs:

```bash
pnpm docs:build
```

Preview the built docs:

```bash
pnpm docs:preview
```
