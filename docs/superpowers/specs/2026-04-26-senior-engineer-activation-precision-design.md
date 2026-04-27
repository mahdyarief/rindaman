# Senior Engineer Activation Precision Design

## Purpose

Rindaman now supports explicit `core`, `senior`, and `auto` modes for its senior-engineer layer. The next quality increment is to make `auto` activation more precise and more observable, so users can trust why the senior layer turned on or stayed off.

## Scope

Improve automatic activation for the senior-engineer layer in `auto` mode.

Add richer observability fields to plugin status:

- `seniorEngineer.effectiveMode`
- `seniorEngineer.intent`
- `seniorEngineer.reason`
- `seniorEngineer.intentSource`
- `seniorEngineer.matchedSignals`

Replace loose keyword-only activation with signal groups.

Suggested signal groups:

- **Implementation verbs**: implement, build, create, add, wire, refactor
- **Architecture/domain signals**: API, auth, schema, contract, data flow, feature boundary, backend, frontend
- **Governance-only signals**: review, status, release, verify, push, commit, doctor

Activation rule in `auto` mode:

- enable senior guidance only when implementation intent and product-engineering context appear together
- keep senior guidance off for pure governance, release, review, or status tasks even if they mention API/auth/schema terms

Out of scope:

- new plugin modes
- UI enrichment integration
- CLI behavior changes

## Architecture

Keep the plugin modular structure.

The activation decision should live inside the `intent` module and return structured metadata rather than only a boolean.

Recommended return shape:

```ts
{
  active: boolean,
  intent: "implementation" | "architecture" | "review" | "release" | "status" | "none",
  reason: string,
  intentSource: "forced-mode" | "auto-signals" | "none",
  matchedSignals: string[]
}
```

## Data Flow

1. Plugin resolves configured mode.
2. Plugin resolves session override mode.
3. Plugin computes effective mode.
4. If effective mode is `auto`, intent analysis returns structured activation metadata.
5. Plugin injects the senior-engineer layer only when `active` is true.
6. `rindaman_status` reports the structured metadata.

## Error Handling

If the message text cannot be analyzed, return a non-throwing metadata result with:

- `active: false`
- `intent: "none"`
- `reason: "no qualifying signals detected"`
- `intentSource: "none"`
- `matchedSignals: []`

## Testing Strategy

Use plugin tests.

Add coverage for:

- implementation request with architecture context activates senior guidance
- generic implementation request without engineering context stays core-only
- review request mentioning auth/API/schema stays core-only
- release/status requests stay core-only
- forced `senior` mode still overrides auto analysis
- forced `core` mode still suppresses senior guidance
- status returns matched signals and intent source

Verification commands:

- `npm run build`
- `npm test`
- `node bin/rindaman.cjs doctor --json`
- `npm pack --dry-run`

## Success Criteria

- Auto activation is more conservative and more explainable.
- Status output explains exactly why the senior layer is active or inactive.
- Existing explicit mode behavior remains stable.
- Plugin tests cover both false-positive and true-positive activation scenarios.
