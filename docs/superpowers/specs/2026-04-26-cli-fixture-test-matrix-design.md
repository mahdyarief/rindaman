# CLI Fixture Test Matrix Design

## Purpose

Rindaman already has a structured CLI, JSON output, config loading, local-tool safety, and CI coverage. The next production-grade increment is to protect those behaviors with deterministic fixture tests before adding larger features.

This work closes the first known production gap: broader fixture coverage for failure modes and setup variations.

## Scope

Add focused CLI tests and minimal fixtures for these cases:

- Typecheck script failure returns failed JSON and exits with code `1`.
- Formatter failure returns a failed `syntax` check.
- Missing `package.json` is reported predictably by `doctor`.
- A non-git project does not crash `check --json`.
- Missing local tools are skipped as warnings by default.
- `--strict` converts skipped checks into a failed overall status.
- Config precedence is defaults, then `package.json.rindaman`, then `.rindamanrc.json`, then CLI flags.

Out of scope:

- Introduced-vs-existing debt classification.
- Monorepo workspace targeting.
- New package installation behavior.
- Hard-blocking final response enforcement.

## Architecture

Tests remain in `test/cli.test.mjs` and invoke `bin/rindaman.cjs` through `node`, matching the existing test style.

Fixtures live under `test/fixtures/` and are intentionally small. Each fixture contains only the files required to exercise the behavior under test. Tests should avoid relying on globally installed formatters or package managers beyond Node and npm behavior already used by the repo.

Production code changes should only happen when tests expose ambiguous or broken behavior. The preferred fix is the smallest CLI adjustment that preserves the current JSON contract.

## Data Flow

Each test runs the CLI in a fixture directory, captures `stdout`, `stderr`, and exit status, then parses JSON when `--json` is used.

Assertions focus on stable public output:

- `status`
- relevant `checks[].name`
- relevant `checks[].status`
- relevant `checks[].reason`
- `changedOnly`
- `policy`
- exit code

Tests should not assert volatile values like durations, absolute temporary paths except where `projectRoot` is the behavior being tested, or full command strings unless needed.

## Error Handling

The CLI must continue returning structured JSON for expected setup problems. Missing scripts, missing local binaries, missing formatter config, and missing git history are not runtime crashes.

Runtime errors should remain exit code `2`; setup failures from `doctor` should remain exit code `3`.

## Testing Strategy

Use Node's built-in `node:test` runner. Add helper functions inside `test/cli.test.mjs` only if they reduce duplication across multiple fixture tests.

Verification commands:

- `npm run build`
- `npm test`
- `node bin/rindaman.cjs doctor --json`
- `npm pack --dry-run`

## Success Criteria

- The new fixture tests pass on Windows and in GitHub Actions.
- Tests are deterministic and do not require network access.
- The CLI keeps producing valid JSON for `--json` paths.
- Known production gap #1 is substantially covered.
