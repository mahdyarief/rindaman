# Plugin Enforcement Hardening Design

## Purpose

Rindaman's CLI now provides strong verification behavior. The plugin should expose clearer enforcement state so OpenCode sessions know whether final responses are safe, pending verification, or blocked by failed checks.

This increment strengthens plugin-side enforcement metadata and rule injection without claiming hard response blocking beyond what OpenCode APIs support.

## Scope

Improve plugin state and tool responses for:

- `verificationRequired`
- `changedFiles`
- `lastCheck.status`
- `lastCheck.command`
- `lastCheck.checkedAt`
- `finalResponse.allowed`
- `finalResponse.reason`

`rindaman_status` should return a structured object like:

```json
{
  "enabled": true,
  "strictResponses": true,
  "qualityLifecycle": true,
  "verificationRequired": true,
  "changedFiles": ["src/foo.ts"],
  "lastCheck": {
    "status": "passed",
    "command": "rindaman check --json",
    "checkedAt": "2026-04-26T00:00:00.000Z"
  },
  "finalResponse": {
    "allowed": true,
    "reason": "verification passed"
  }
}
```

Rule injection should say:

- final responses must include changed files, checks run, and remaining risks
- if verification is required and no passing `rindaman_check` exists, final response must explicitly say verification is pending or failed
- no completion claim should be made when `finalResponse.allowed` is false
- if quality lifecycle is disabled, final response is allowed with reason `quality lifecycle disabled`

Out of scope:

- true response cancellation if the OpenCode plugin API does not expose a stable blocker
- persisting check state across OpenCode sessions
- changing CLI behavior
- adding network or package installation behavior

## Architecture

Keep enforcement state inside the plugin module. Add a small gate evaluator that derives final-response metadata from existing plugin state.

The plugin should continue exposing the same tool names:

- `rindaman_check`
- `rindaman_status`

`rindaman_check` updates `lastCheck` and changed-file state. `rindaman_status` reports the current state plus final-response gate metadata.

## Data Flow

1. Plugin initializes default state from options.
2. Rule injection tells the assistant how to behave before final response.
3. `rindaman_status` computes changed files and gate metadata.
4. `rindaman_check` runs verification, records command/status/timestamp, and returns updated status.
5. Final-response rules use the status output and gate metadata to prevent false completion claims.

## Error Handling

Failed `rindaman_check` results should set `lastCheck.status` to `failed` and `finalResponse.allowed` to false when verification is required.

Tool execution errors should set `lastCheck.status` to `error` and expose the error message without throwing unstructured data to the caller.

If changed files cannot be detected, report an empty array and use reason `changed files unavailable` only if verification is required.

## Testing Strategy

Use existing plugin tests in `test/plugin.test.mjs`.

Add coverage for:

- dirty session requires verification
- passing `rindaman_check` allows final response
- failed `rindaman_check` marks final response as not allowed
- `rindaman_status` exposes `finalResponse` metadata
- `/quality off` bypasses verification requirement
- existing strict and quality toggles still work

Verification commands:

- `npm run build`
- `npm test`
- `node bin/rindaman.cjs doctor --json`
- `npm pack --dry-run`

## Success Criteria

- Plugin status reports final-response gate metadata.
- Passing and failed checks update the gate state correctly.
- Quality lifecycle disablement allows final response with an explicit reason.
- Existing plugin commands and toggles remain compatible.
- All tests pass without changing CLI behavior.
