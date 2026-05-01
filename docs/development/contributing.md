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

Commands that update the Windows hosts file must be run from an elevated PowerShell session:

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
- `src/integrations/` contains external integration logic such as Caddy and the Windows hosts file.
- `src/platform/` contains runtime path resolution and child-process execution.

## Safety Rules

- Do not touch the real Windows hosts file in tests.
- Keep filesystem paths and command execution injectable through `DevProxyContext`.
- Tests should use temp directories and mocked `CommandRunner` implementations.
- DevProxy must only modify hosts entries inside its own marker block:
  - `# BEGIN DEVPROXY`
  - `# END DEVPROXY`
- Do not add automatic UAC elevation without an explicit product decision.
- If hosts-file access is missing, fail with a clear administrator rerun instruction.

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
