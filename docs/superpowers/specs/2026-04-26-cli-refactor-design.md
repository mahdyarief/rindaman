# CLI Refactor Design

## Purpose

Rindaman's CLI now handles command parsing, config loading, workspace targeting, baseline files, debt classification, and result assembly in one large file. The next production-grade improvement is a behavior-preserving refactor that reduces change risk for future features.

## Scope

Refactor the CLI internals while keeping public behavior unchanged.

Preserve:

- command names and flags
- JSON output fields and shapes
- exit codes
- current baseline and monorepo behavior
- current tests

Extract these responsibilities from `bin/rindaman.cjs`:

- argument and flag parsing
- config loading and overrides
- workspace discovery and selection
- baseline read/write
- debt classification and status policy
- check result creation and command routing helpers

Keep `bin/rindaman.cjs` as a thin entrypoint that wires modules together.

Out of scope:

- new end-user features
- new command flags
- semantic engine rewrites
- plugin changes
- TypeScript migration for CLI modules in this increment

## Architecture

Add internal CommonJS modules under `src/cli/`.

Recommended module split:

- `src/cli/args.cjs` - command parsing, flag reading, validation
- `src/cli/config.cjs` - defaults, root/workspace config, overrides
- `src/cli/workspaces.cjs` - workspace discovery and selection
- `src/cli/baseline.cjs` - baseline read/write helpers
- `src/cli/policy.cjs` - debt classification, aggregate status, exit policy
- `src/cli/check-runner.cjs` - check execution and result assembly

`bin/rindaman.cjs` remains the only executable file and imports these helpers.

## Data Flow

1. Entry point parses command and flags.
2. Entry point resolves project/workspace context through extracted helpers.
3. Check runner creates structured results.
4. Policy module computes debt and final status.
5. Entry point renders JSON or human output and exits.

## Error Handling

Refactor must preserve current runtime errors and structured JSON error behavior.

If extraction introduces shared helpers, each helper should either:

- return structured data, or
- throw contextual errors that the entrypoint already knows how to serialize.

## Testing Strategy

Primary regression proof is the existing test suite.

Add focused tests only when refactor exposes missing unit coverage for extracted helpers. Favor existing integration tests over broad new unit-test surface.

Verification commands:

- `npm run build`
- `npm test`
- `node bin/rindaman.cjs doctor --json`
- `npm pack --dry-run`

## Success Criteria

- `bin/rindaman.cjs` becomes a thin entrypoint.
- Extracted modules have one clear responsibility each.
- All existing tests pass unchanged or with minimal assertion updates.
- No public CLI behavior regresses.
