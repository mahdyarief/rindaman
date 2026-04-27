# Operator Interface Design

## Purpose

Rindaman already exposes useful plugin tools, but `rindaman_check` and `rindaman_status` still behave more like raw state reporters than a true operator interface. The next increment should make them answer the practical question: what is the current state, and what should the operator do next?

## Scope

Improve plugin tool ergonomics only.

Add to `rindaman_status`:

- `checkFreshness`: `not_run` | `fresh` | `stale`
- `nextAction.command`
- `nextAction.reason`

Behavior:

- `not_run` when no check has been run in the session
- `fresh` when the latest successful or failed check still reflects the current session state
- `stale` when files or relevant tool activity happened after the last check

`nextAction` should guide the operator:

- recommend `rindaman_check` when verification is required and stale or not run
- recommend no action when final response is allowed and the state is fresh

`rindaman_check` should include a short operator summary in its output:

- last status
- final response allowed
- next action if any

Out of scope:

- CLI behavior changes
- persistent cross-session state
- hard host-level blocking
- new modes or new plugin tools

## Architecture

Use the existing session state store. Add a small freshness evaluator and next-action resolver.

Recommended helpers:

- `getCheckFreshness(sessionState)`
- `getNextAction(sessionState, finalResponseGate, freshness)`

These can live alongside final-response gate logic or in a new plugin helper module if needed.

## Data Flow

1. Session activity updates changed files and check metadata.
2. Status tool computes:
   - verification requirement
   - final response gate
   - freshness
   - next action
3. Check tool updates last-check metadata and emits operator-oriented output.

## Error Handling

If state is incomplete, prefer safe defaults:

- freshness -> `not_run`
- next action -> recommend `rindaman_check` when uncertain and verification is required

Do not emit contradictory states such as `fresh` with `not_run`.

## Testing Strategy

Use plugin tests.

Add coverage for:

- untouched session -> `not_run`
- passing check -> `fresh`
- edit after check -> `stale`
- `nextAction` recommends `rindaman_check` when stale and verification required
- `nextAction` is null or inactive when fresh and final response allowed

Verification commands:

- `npm run build`
- `npm test`
- `node bin/rindaman.cjs doctor --json`
- `npm pack --dry-run`

## Success Criteria

- Status becomes action-oriented, not just descriptive.
- Check freshness is explicit and correct.
- Operators can tell what to do next without interpreting multiple fields manually.
- Existing plugin behavior remains compatible.
