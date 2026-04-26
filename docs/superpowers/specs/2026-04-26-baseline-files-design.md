# Baseline Files Design

## Purpose

Rindaman can now classify failures as introduced or unknown, but it cannot yet identify known existing debt. Baseline files make Rindaman practical for legacy projects by allowing teams to record current failures and block only new debt.

## Scope

Add a baseline command:

- `rindaman baseline`
- `rindaman baseline --json`

Add config keys:

- `baselinePath`: default `.rindaman/baseline.json`
- `useBaseline`: default `true`

Add CLI flags:

- `--baseline-path <path>`
- `--no-baseline`

Extend JSON output with:

```json
{
  "baseline": {
    "path": "/absolute/path/to/.rindaman/baseline.json",
    "found": true,
    "used": true,
    "checkNames": ["types", "syntax"]
  }
}
```

Baseline format v1:

```json
{
  "version": 1,
  "createdAt": "2026-04-26T00:00:00.000Z",
  "checks": ["semantic", "types", "syntax"]
}
```

Classification rules:

- Failed check names present in the baseline classify as `existingChecks`.
- Failed check names absent from the baseline classify as `introducedChecks` when changed target files exist.
- Failed check names absent from the baseline classify as `unknownChecks` when changed target files do not exist.
- Existing debt does not block by default.
- Existing debt blocks when `failOnExistingDebt` is true.
- Introduced and unknown debt still block `check`.
- `audit` remains non-blocking.

Out of scope:

- Line-level baselines.
- Per-rule semantic issue baselines.
- Expiring baselines.
- Monorepo package-specific baselines.
- Suppression annotations.

## Architecture

Implement baseline support in `bin/rindaman.cjs` at the CLI orchestration layer.

The baseline command should reuse existing check execution logic in audit mode, collect failed check names, write the baseline file, and return structured JSON when requested.

The classification function should receive baseline metadata and classify failed check names before final status is computed.

## Data Flow

1. CLI reads config and applies flags.
2. CLI loads baseline metadata if enabled.
3. CLI runs checks.
4. CLI classifies failed checks using baseline membership, changed target files, and debt mode.
5. CLI computes status from debt policy.
6. CLI emits `checks`, `debt`, `baseline`, and `policy` in JSON output.

For `baseline` command:

1. CLI reads config and flags.
2. CLI runs checks in audit mode.
3. CLI writes failed check names to the baseline file.
4. CLI emits baseline write metadata in JSON output.

## Error Handling

Invalid baseline JSON should not crash `check`; it should be treated as not usable and reported as `used: false`.

Baseline write failures are runtime errors with exit code `2` and structured JSON when `--json` is active.

Missing baseline file is not an error. It reports `found: false`, `used: false`, and empty `checkNames`.

## Testing Strategy

Use fixture-backed CLI tests.

Add coverage for:

- `baseline --json` writes a baseline file with failed check names.
- `check --all --json` classifies baseline-matched failures as existing.
- `--fail-existing` blocks existing baseline debt.
- `--no-baseline` ignores an existing baseline and classifies broad failures as unknown.
- Missing baseline reports `found: false` and does not crash.
- Invalid baseline JSON reports `used: false` and does not crash.

Verification commands:

- `npm run build`
- `npm test`
- `node bin/rindaman.cjs doctor --json`
- `npm pack --dry-run`

## Success Criteria

- Baseline generation is deterministic and writes v1 JSON.
- JSON output contains stable baseline metadata.
- Existing baseline debt no longer blocks by default.
- New or unknown failures still block `check`.
- Tests pass on Windows and CI without network access.
