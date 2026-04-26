# rindaman

OpenCode plugin that merges strict response mode with lifecycle code quality management.

Rindaman combines:

- `strict-mode`: concise, direct, low-filler responses
- `opencode-quality-check`: clean implementation lifecycle plus verification checks

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

The plugin injects rules with `experimental.chat.system.transform` and keeps compatibility with message-history injection for OpenCode setups that still rely on message transforms.

## CLI commands

```bash
rindaman check
rindaman audit
rindaman doctor
rindaman --help
```

`doctor` validates basic runtime setup. `audit` runs checks without making quality failures fatal.

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
    "superpowers@git+https://github.com/obra/superpowers.git",
    "rindaman@git+https://github.com/mahdyarief/rindaman.git"
  ]
}
```

Do not load `strict-mode` separately if `rindaman` is enabled, because Rindaman already includes strict response behavior.
