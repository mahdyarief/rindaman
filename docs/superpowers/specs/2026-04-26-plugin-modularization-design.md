# Plugin Modularization Design

## Purpose

Rindaman's plugin logic now handles core governance, final-response gating, optional senior fullstack guidance, tool execution, and session state in a single `src/index.ts` file. The next production-grade increment is a behavior-preserving refactor to make plugin evolution safer.

## Scope

Refactor plugin internals without changing public plugin behavior.

Preserve:

- plugin id
- tool names
- toggle behavior
- final-response gate behavior
- senior fullstack activation behavior
- current tests

Extract responsibilities from `src/index.ts` into focused modules.

Out of scope:

- new plugin features
- new CLI behavior
- new rules or modes
- changing current activation heuristics

## Architecture

Recommended module split under `src/plugin/`:

- `options.ts` - plugin option parsing
- `session-state.ts` - session maps and state helpers
- `final-response-gate.ts` - verification and final-response policy
- `toggles.ts` - command parsing and enable/disable decisions
- `intent.ts` - senior fullstack activation heuristic
- `rule-messages.ts` - rule message markers and constructors
- `tools.ts` - `rindaman_check` and `rindaman_status`

`src/index.ts` remains the composition layer that wires the modules into the OpenCode plugin hooks.

## Data Flow

1. `index.ts` resolves options.
2. `index.ts` asks state and intent helpers what should be active.
3. Rule message helpers build system messages.
4. Tool helpers update session state and return structured outputs.
5. Final-response gate helpers compute the current gate metadata.

## Error Handling

This refactor must preserve the current JSON status shapes and tool output behavior.

Extracted helpers should either:

- return plain structured values, or
- throw typed/contextual errors that are already handled by tool execution logic.

Avoid hidden module-level side effects except the explicit shared session-state store.

## Testing Strategy

Primary proof is the existing plugin test suite.

Use the current tests as regression protection and add new tests only if extraction reveals gaps in module contracts.

Verification commands:

- `npm run build`
- `npm test`
- `node bin/rindaman.cjs doctor --json`
- `npm pack --dry-run`

## Success Criteria

- `src/index.ts` becomes a thin composition file.
- Extracted plugin modules each have one clear responsibility.
- All existing tests pass unchanged or with only import-path-neutral updates.
- No public plugin behavior regresses.
