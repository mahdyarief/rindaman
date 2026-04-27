# Security Audit Mode Design

## Purpose

Rindaman already checks code quality, debt classification, baselines, monorepo targeting, and plugin enforcement. The next production-grade increment is dependency security visibility, so teams can treat vulnerable dependency state as part of their quality gate.

## Scope

Add a `security` check pillar to the CLI.

Behavior:

- Run `npm audit --json` when a compatible lockfile and npm environment are present.
- Summarize vulnerability counts by severity.
- Do not modify dependencies.
- Do not run `npm audit fix`.

Add config keys:

```json
{
  "checks": {
    "security": true
  },
  "security": {
    "failOnModerate": false,
    "failOnHigh": true,
    "failOnCritical": true
  }
}
```

JSON output for the security check should include:

- `status`
- `severity`
- `command`
- `reason`
- `exitCode`
- `durationMs`
- `summary`:

```json
{
  "moderate": 3,
  "high": 1,
  "critical": 0
}
```

Default policy:

- critical vulnerabilities block
- high vulnerabilities block
- moderate vulnerabilities report only

Monorepo behavior:

- when running a workspace, audit from that workspace root
- when running `--workspaces`, audit each workspace independently
- if a workspace does not have a compatible lockfile, skip with a structured reason

Out of scope:

- automatic fixes
- `pnpm audit`, `yarn npm audit`, or third-party audit backends in v1
- advisory-level policy customization beyond moderate/high/critical severity thresholds
- SBOM export or license scanning

## Architecture

Implement the security runner inside the extracted CLI modules, not the plugin.

Recommended placement:

- `src/cli/check-runner.cjs` executes the audit command and normalizes the JSON
- `src/cli/policy.cjs` evaluates whether the summary should block

This keeps the security pillar aligned with existing CLI result assembly and policy evaluation.

## Data Flow

1. CLI reads config and flags.
2. Check runner decides whether security audit is available.
3. If available, run `npm audit --json` in the execution root.
4. Normalize the audit JSON into severity counts.
5. Policy decides whether the security result is blocking.
6. CLI includes the security result in standard output and JSON.

## Error Handling

If `npm audit --json` returns parseable JSON with vulnerabilities, treat that as a successful command execution with a security result, not as a runtime error.

If audit output is not valid JSON, return a failed security check with reason `invalid audit output`.

If audit is not applicable, return a skipped security check with a clear reason such as `npm audit unavailable for this workspace` or `lockfile not found`.

## Testing Strategy

Use fixture-backed tests and command stubbing where needed.

Add coverage for:

- security check skipped when no supported lockfile exists
- security check reports severity counts from normalized JSON
- default policy blocks high and critical
- moderate-only results do not block by default
- config overrides for `failOnModerate`, `failOnHigh`, and `failOnCritical`
- workspace audit execution and skipping behavior in monorepos

Verification commands:

- `npm run build`
- `npm test`
- `node bin/rindaman.cjs doctor --json`
- `npm pack --dry-run`

## Success Criteria

- Security audit appears as a first-class CLI check.
- Read-only behavior is preserved.
- Severity policy is configurable and tested.
- Monorepo workspace audit behavior is deterministic.
- Existing CLI behavior remains compatible when `checks.security` is disabled.
