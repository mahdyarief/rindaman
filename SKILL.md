---
name: rindaman
description: OpenCode plugin that merges strict response behavior with lifecycle code quality checks.
---

# rindaman

Use this plugin as the canonical OpenCode quality layer.

It consolidates strict response behavior, lifecycle verification, and quality orchestration into one plugin surface.

Use `rindaman` as the single quality entrypoint for OpenCode sessions.

## Lifecycle

| Phase | Plugin behavior |
|---|---|
| Before editing | Force task restatement, scope declaration, minimal footprint |
| During implementation | Enforce naming, types/contracts, structure, no speculative code |
| Before completion | Run verification checks |
| After failures | Fix root cause, not symptoms |
| Before final response | Report changed files, checks run, remaining risks |

## Behavior

Rindaman is enabled by default.

It injects one global rule that combines:

- strict, concise response style
- implementation discipline
- verification-before-completion behavior
- root-cause failure handling

## Boundaries

Rindaman is the umbrella quality layer. It owns:

- strict response behavior
- lifecycle quality gates
- verification-before-completion enforcement
- session check/status tooling

Rindaman works with specialized skills instead of replacing them. Keep using specialized skills when they apply:

- planning and design skills for scoping and specs
- TDD and generation-discipline skills for implementation behavior
- stack and domain skills for framework-specific guidance
- reviewer-style skills for findings-first review workflows

## Commands

- `/rindaman on` — enable full Rindaman behavior
- `/rindaman off` — disable full Rindaman behavior for the session
- `/quality on` / `/quality off` — alternate session toggle commands
- `/strict on` / `/strict off` — alternate response-mode toggle commands
- `strict mode` / `normal mode` — natural-language response-mode commands

## Verification

Run from the project root:

```bash
rindaman
```

The CLI runs four pillars:

1. Semantic quality
2. TypeScript/contracts
3. Biome or Prettier syntax checks
4. Hygiene and unused-code detection

## Failure policy

- Task-related type errors, unsafe casts, ignored errors, empty catches, introduced unused dependencies, and semantic violations are blockers.
- Existing unrelated debt should be reported, not fixed, unless the user asks.
- Never use syntactic band-aids for semantic, structural, or hygiene problems.
- Formatting touched task files is allowed. Repository-wide formatting is a separate task.

## Production controls

OpenCode tools:

- `rindaman_check` — run verification and record session state.
- `rindaman_status` — report changed files and last verification result.

CLI commands:

- `rindaman check`
- `rindaman audit`
- `rindaman doctor`

Safety:

- Prefer local project binaries.
- Avoid package auto-install through `npx`, `dlx`, or `bunx`.
- Write reports only when requested with `--report`.
- Use `.rindaman/report.md` for report output.

## Configuration

Supported plugin options:

- `enabled` — default `true`
- `strictResponses` — default `true`
- `qualityLifecycle` — default `true`
- `verificationRequired` — default `true`

Use these options to disable response strictness or lifecycle enforcement per OpenCode config.

## Distribution

GitHub/local only. Do not publish to npm.

Build locally with:

```bash
npm install
npm run build
```

## OpenCode plugin config

Recommended config:

```json
{
  "plugin": [
    "superpowers@git+https://github.com/obra/superpowers.git",
    "rindaman@git+https://github.com/mahdyarief/rindaman.git"
  ]
}
```

Use `rindaman` as the only quality plugin in your OpenCode config.
