# rindaman

OpenCode plugin that merges strict response mode with lifecycle code quality management.

Rindaman combines:

- `strict-mode`: concise, direct, low-filler responses
- `quality-check`: clean implementation lifecycle plus verification checks

## Lifecycle

| Phase | Plugin behavior |
|---|---|
| Before editing | Force task restatement, scope declaration, minimal footprint |
| During implementation | Enforce naming, types/contracts, structure, no speculative code |
| Before completion | Run verification checks |
| After failures | Fix root cause, not symptoms |
| Before final response | Report changed files, checks run, remaining risks |

## Strict response behavior

- concise and direct
- no filler or unnecessary hedging
- preserve technical meaning
- never compress commands, code blocks, logs, paths, URLs, API names, or exact quoted text

## Commands

Rindaman is enabled by default.

- `/rindaman on`
- `/rindaman off`
- `/quality on`
- `/quality off`
- `/strict on`
- `/strict off`
- `normal mode`
- `strict mode`

## CLI

Run from the project root:

```bash
rindaman
```

The CLI runs:

1. Semantic quality checks
2. TypeScript/contracts
3. Biome or Prettier syntax checks
4. Hygiene and unused-code detection

## Development

```bash
npm install
npm run build
npm test
```

## Production-grade controls

Rindaman now includes first-class OpenCode tools:

- `rindaman_check` — runs the verification command and records session check status.
- `rindaman_status` — reports changed files, verification requirement, and last check state.

`rindaman_status` includes `finalResponse.allowed` and `finalResponse.reason` so the assistant can avoid false completion claims when verification is pending or failed.

The plugin injects rules with `experimental.chat.system.transform` and keeps compatibility with message-history injection for OpenCode setups that still rely on message transforms.

## CLI commands

```bash
rindaman check
rindaman check --json
rindaman audit
rindaman audit --json
rindaman baseline
rindaman baseline --json
rindaman check --workspace packages/api --json
rindaman check --workspaces --json
rindaman baseline --workspaces --json
rindaman doctor
rindaman doctor --json
rindaman --help
```

`doctor` validates basic runtime setup. `audit` runs checks without making quality failures fatal.

### JSON check output

Use `--json` when Rindaman is called by OpenCode tools, CI, or other automation:

```bash
rindaman check --json
```

The JSON result includes:

- `command`
- `status`
- `projectRoot`
- `packageManager`
- `baseRef`
- `changedOnly`
- `changedFiles`
- `targetFiles`
- `formatter`
- `reportPath`
- `checks`
- `baseline`
- `debt`
- `policy`

Each check reports:

- `name`
- `status`
- `severity`
- `command`
- `reason`
- `exitCode`
- `durationMs`

Use `--include-output` to include captured `stdout` and `stderr` in JSON output:

```bash
rindaman check --json --include-output
```

### Debt classification

Rindaman reports failed checks in a `debt` object:

- `introducedChecks` - failures tied to changed target files
- `existingChecks` - failures listed in the current baseline
- `unknownChecks` - failures that cannot be safely tied to changed files

By default, `check` blocks introduced and unknown debt. `audit` reports the same classification but exits successfully.

### Baseline files

Use `rindaman baseline --json` to record the current failed check names in `.rindaman/baseline.json`.

When baseline use is enabled, failed checks listed in the baseline are classified as existing debt. Existing debt does not block by default; pass `--fail-existing` to block it.

### Monorepo workspaces

Use `--workspace <name-or-path>` to run against one workspace, or `--workspaces` to run every detected workspace.

Rindaman detects workspaces from root `package.json` workspaces and `pnpm-workspace.yaml`. Workspace runs use workspace-local scripts, config, and baselines, with root config as the fallback.

## Safety policy

- Prefer local project binaries over package executors.
- Do not auto-install `knip`, Biome, or Prettier via `npx` or `dlx`.
- Write reports only when explicitly requested with `--report`; report output goes under `.rindaman/`.
- Track session check status through `rindaman_check` and `rindaman_status`.

## Exit codes

| Code | Meaning |
|---:|---|
| 0 | Passed or audit completed |
| 1 | Quality blocker found |
| 2 | Runtime error |
| 3 | Setup incomplete |

## Plugin options

Example OpenCode plugin options:

```json
{
  "plugin": [
    [
      "rindaman",
      {
        "enabled": true,
        "strictResponses": true,
        "qualityLifecycle": true,
        "verificationRequired": true
      }
    ]
  ]
}
```

Supported options:

| Option | Default | Purpose |
|---|---:|---|
| `enabled` | `true` | Enable Rindaman rule injection |
| `strictResponses` | `true` | Report strict response mode in status |
| `qualityLifecycle` | `true` | Report lifecycle mode in status |
| `verificationRequired` | `true` | Mark changed sessions as requiring verification |

## Config file support

Rindaman reads project-level configuration from either:

1. `.rindamanrc.json`
2. `package.json` under the `rindaman` key

`.rindamanrc.json` example:

```json
{
  "changedOnly": true,
  "strictWarnings": false,
  "writeReport": false,
  "reportPath": ".rindaman/report.md",
  "allowPackageInstall": false,
  "baseRef": "origin/main",
  "debtMode": "changed-only",
  "failOnExistingDebt": false,
  "baselinePath": ".rindaman/baseline.json",
  "useBaseline": true,
  "ignorePatterns": [
    "dist/**",
    "coverage/**",
    "node_modules/**",
    ".git/**"
  ],
  "checks": {
    "semantic": true,
    "types": true,
    "syntax": true,
    "hygiene": true
  }
}
```

`package.json` example:

```json
{
  "rindaman": {
    "changedOnly": true,
    "strictWarnings": false,
    "debtMode": "changed-only",
    "failOnExistingDebt": false,
    "baselinePath": ".rindaman/baseline.json",
    "useBaseline": true,
    "checks": {
      "semantic": true,
      "types": true,
      "syntax": true,
      "hygiene": true
    }
  }
}
```

CLI flags override config file values:

```bash
rindaman check --json --strict --base origin/main
rindaman check --all --report --report-path .rindaman/report.md
rindaman check --json --debt-mode changed-only
rindaman check --json --fail-existing
rindaman check --json --baseline-path .rindaman/baseline.json
rindaman check --json --no-baseline
rindaman check --workspace packages/api --json
rindaman check --workspaces --json
rindaman baseline --workspaces --json
```

## GitHub-only usage

This plugin is intended for GitHub/local installation, not npm publishing.

Recommended setup:

```bash
git clone https://github.com/mahdyarief/rindaman.git
cd rindaman
npm install
npm run build
```

Then reference the local plugin path from OpenCode config, similar to the strict-mode setup.

The package is marked `private: true` to avoid accidental npm publishing.

## OpenCode plugin config

Use Rindaman from GitHub exactly like your strict-mode setup:

```json
{
  "plugin": [
    "rindaman@git+https://github.com/mahdyarief/rindaman.git"
  ]
}
```

Do not load `strict-mode` separately if `rindaman` is enabled, because Rindaman already includes strict response behavior.

## Install in OpenCode

Add Rindaman to your OpenCode config `plugin` list using the GitHub URL:

```json
{
  "plugin": [
    "rindaman@git+https://github.com/mahdyarief/rindaman.git"
  ]
}
```

Then restart OpenCode so it resolves and loads the plugin.

Recommended setup:

- Use `rindaman` instead of loading `strict-mode` separately.
- Keep `superpowers` if you already use it.
- Do not add the old `quality-check` skill separately; Rindaman includes the quality lifecycle.

After restart, test with:

```text
/rindaman on
/rindaman off
/rindaman on
```

You can also verify the plugin tools are available in OpenCode:

- `rindaman_check`
- `rindaman_status`
