# Monorepo Workspace Targeting Design

## Purpose

Rindaman now supports reliable checks, debt classification, and baseline files. The next adoption blocker is monorepo support: many production repositories organize code under `apps/*` and `packages/*`, with package-specific scripts, config, and baselines.

This increment adds workspace targeting without changing the default single-project behavior.

## Scope

Add CLI flags:

- `--workspace <name-or-path>`: run the command for one workspace.
- `--workspaces`: run the command for all detected workspaces.

Detect workspaces from:

- root `package.json` `workspaces` array
- root `package.json` `workspaces.packages` array
- `pnpm-workspace.yaml` `packages` array

Support v1 workspace patterns:

- exact relative paths, such as `packages/api`
- one-level globs, such as `packages/*` and `apps/*`

Workspace identity:

- `name`: `package.json.name` when present, otherwise workspace path
- `path`: relative path from the monorepo root
- `root`: absolute workspace path

Behavior:

- `rindaman check --workspace packages/api --json` runs checks from `packages/api`.
- `rindaman check --workspace @scope/api --json` resolves by package name.
- `rindaman check --workspaces --json` runs all detected workspaces independently.
- `rindaman baseline --workspaces --json` writes one baseline per workspace.
- No workspace flag preserves current behavior.

Workspace config rules:

- root config is the base
- workspace `package.json.rindaman` overrides root config
- workspace `.rindamanrc.json` overrides workspace package config
- CLI flags override all config
- workspace baseline defaults to `<workspace>/.rindaman/baseline.json`

Formatter and script behavior:

- package scripts run from the workspace root
- formatter config uses workspace config when present
- formatter config falls back to root config when workspace config is absent

Aggregated JSON shape for `--workspaces`:

```json
{
  "command": "check",
  "status": "failed",
  "projectRoot": "/repo",
  "workspaces": [
    {
      "workspace": {
        "name": "@acme/api",
        "path": "packages/api",
        "root": "/repo/packages/api"
      },
      "status": "passed",
      "checks": []
    }
  ]
}
```

Out of scope:

- nested workspaces
- Yarn Plug'n'Play specifics
- task graph or topological ordering
- cross-workspace dependency impact analysis
- root plus workspace execution in one command

## Architecture

Keep implementation in `bin/rindaman.cjs` for this increment. Add small helpers for workspace discovery, workspace selection, and aggregate result creation.

The existing check and baseline command paths should accept an execution root and optional workspace metadata. Single-project execution remains the default path.

## Data Flow

Single workspace:

1. Resolve monorepo root from current project root.
2. Discover workspace list.
3. Match `--workspace` by path or package name.
4. Merge root and workspace config.
5. Run command from workspace root.
6. Include `workspace` metadata in JSON output.

All workspaces:

1. Discover workspaces.
2. Run the command once per workspace.
3. Aggregate workspace results.
4. Return failed status when any workspace check fails.

## Error Handling

Missing `--workspace` target returns exit code `2` and structured JSON when `--json` is active.

`--workspaces` with no detected workspaces returns exit code `3` for setup incomplete.

Workspace package files that cannot be parsed are skipped from discovery.

Individual workspace failures should not stop `--workspaces`; all workspace results should be returned.

## Testing Strategy

Use a fixture monorepo under `test/fixtures/monorepo-project`.

Add coverage for:

- workspace discovery from `package.json.workspaces`
- single workspace selection by path
- single workspace selection by package name
- all workspace JSON aggregation
- workspace-local baseline path
- workspace config overriding root config
- missing workspace structured JSON error

Verification commands:

- `npm run build`
- `npm test`
- `node bin/rindaman.cjs doctor --json`
- `npm pack --dry-run`

## Success Criteria

- Current non-workspace behavior remains compatible.
- Workspace checks run from workspace roots.
- Baselines default to workspace-local `.rindaman/baseline.json`.
- Aggregated workspace JSON is deterministic.
- Tests pass on Windows and CI without network access.
