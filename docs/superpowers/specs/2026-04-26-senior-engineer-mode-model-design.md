# Senior Engineer Mode Model Design

## Purpose

Rindaman now supports an optional senior fullstack guidance layer, but its current activation model is not explicit enough. Users and maintainers need to know whether the plugin is in core-only mode, senior-guidance mode, or automatic mode, and why.

This increment adds explicit mode semantics and status reporting.

## Scope

Add a mode model with three values:

- `core`
- `senior`
- `auto`

Control should be available through:

1. plugin config
2. chat commands

Recommended chat commands:

- `/rindaman mode core`
- `/rindaman mode senior`
- `/rindaman mode auto`

Recommended config option:

```json
{
  "mode": "auto"
}
```

Add status fields:

```json
{
  "mode": "auto",
  "seniorEngineer": {
    "active": true,
    "reason": "implementation intent detected",
    "intent": "implementation"
  }
}
```

Mode behavior:

- `core`: core rule only, senior guidance always off
- `senior`: core rule plus senior guidance always on
- `auto`: core always on, senior guidance based on task intent

Out of scope:

- changing the current heuristic beyond what is required to support the mode model
- renaming the plugin
- new CLI behavior
- UI enrichment integration

## Architecture

Keep the current two-layer plugin model, but add a mode resolver and a small activation-state object.

The plugin should compute:

- configured mode
- session override mode, if any
- effective mode
- whether senior guidance is active
- why it is active or inactive

## Data Flow

1. Plugin reads configured default mode.
2. Chat commands may override the session mode.
3. Plugin computes the effective mode.
4. If effective mode is `auto`, plugin evaluates task intent.
5. Plugin injects rules accordingly.
6. `rindaman_status` reports the effective mode and senior guidance activation details.

## Error Handling

Unknown mode commands should not crash the plugin. They should be ignored or reported as non-state-changing inputs.

If mode state is unavailable, default to `auto`.

## Testing Strategy

Use plugin tests.

Add coverage for:

- config default mode `core`
- config default mode `senior`
- config default mode `auto`
- session command override from auto to core
- session command override from auto to senior
- session command override back to auto
- `rindaman_status` reports `mode`, `reason`, and `intent`

Verification commands:

- `npm run build`
- `npm test`
- `node bin/rindaman.cjs doctor --json`
- `npm pack --dry-run`

## Success Criteria

- Mode semantics are explicit and test-covered.
- Users can control the senior guidance layer by config and by chat command.
- Status output explains activation clearly.
- Existing core behavior remains stable.
