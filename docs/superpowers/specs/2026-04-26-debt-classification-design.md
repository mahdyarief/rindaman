# Debt Classification Design

## Purpose

Rindaman should be adoptable in imperfect projects. A production quality gate must block newly introduced problems without forcing teams to fix all historical debt on day one.

This increment adds CLI-level introduced-vs-existing debt classification while keeping the semantic engine stable.

## Scope

Add a `debt` section to `check` and `audit` JSON output:

- `mode`: `"changed-only"` or `"all"`
- `classification`: `"introduced"`, `"existing"`, `"mixed"`, or `"unknown"`
- `introducedChecks`: check names classified as introduced debt
- `existingChecks`: check names classified as existing debt
- `unknownChecks`: check names that cannot be classified safely

Classification rules:

- Failed checks are debt candidates.
- Skipped and disabled checks are not debt.
- In `changedOnly: true`, failed checks that ran against changed target files classify as `introduced`.
- In `changedOnly: true`, broad failures without target files classify as `unknown`.
- In `changedOnly: false`, failed checks classify as `unknown` because no baseline exists yet.
- `audit` reports classification but keeps exit code `0`.

Add config keys:

- `debtMode`: `"changed-only"` or `"all"`, default `"changed-only"`
- `failOnExistingDebt`: default `false`

Add CLI flags:

- `--debt-mode changed-only|all`
- `--fail-existing`

Exit policy:

- Introduced debt blocks `check`.
- Unknown debt blocks `check` unless `audit` is used.
- Existing debt blocks only when `failOnExistingDebt` is true.
- The first implementation may classify broad non-baseline failures as `unknown`, not `existing`, to avoid false safety.

Out of scope:

- Persistent baseline files.
- Line-level semantic diffing.
- Monorepo workspace targeting.
- Rewriting semantic quality categories.
- Suppression comments or ignore annotations.

## Architecture

Implement classification in `bin/rindaman.cjs` after checks are collected and before the final status and exit code are decided.

The classifier should be a small pure function that receives:

- check results
- effective config
- `changedOnly`
- `targetFiles`

It returns the `debt` object and the status decision remains in the CLI layer. This keeps check execution independent from policy evaluation.

## Data Flow

1. CLI reads config and applies flags.
2. CLI detects changed files and target files.
3. CLI runs semantic, type, syntax, and hygiene checks.
4. CLI classifies failed checks into introduced, existing, and unknown buckets.
5. CLI computes status from the debt policy.
6. CLI emits JSON with `checks`, `policy`, and `debt`.

## Error Handling

Invalid `--debt-mode` values should be treated as runtime input errors with exit code `2` and structured JSON when `--json` is active.

Missing config keys should fall back to defaults.

Classification must never hide a failed check. If Rindaman cannot classify a failure, it must mark it as `unknown`.

## Testing Strategy

Use fixture-backed CLI tests in `test/cli.test.mjs`.

Add coverage for:

- Changed-only failure classified as introduced and blocking.
- Broad `--all` failure classified as unknown and blocking for `check`.
- `audit --json` reports unknown debt but exits `0`.
- Config and flag precedence for `debtMode` and `failOnExistingDebt`.
- Invalid `--debt-mode` returns structured JSON error.

Verification commands:

- `npm run build`
- `npm test`
- `node bin/rindaman.cjs doctor --json`
- `npm pack --dry-run`

## Success Criteria

- JSON output includes stable debt classification fields.
- Existing CLI behavior remains compatible except for the added `debt` object.
- Introduced and unknown failures remain blockers for `check`.
- `audit` remains non-blocking while reporting classification.
- Tests are deterministic on Windows and CI.
