# Reviewer Mode Design

## Purpose

Rindaman currently distinguishes core governance from senior implementation guidance. Review tasks still rely on core behavior plus implicit user instructions. A dedicated reviewer mode makes review behavior explicit, testable, and easier to control.

## Scope

Add a fourth plugin mode:

- `core`
- `senior`
- `reviewer`
- `auto`

Layer model:

- core is always active when Rindaman is enabled
- secondary layer is mutually exclusive:
  - none
  - senior
  - reviewer

Chat overrides:

- `/rindaman mode core`
- `/rindaman mode senior`
- `/rindaman mode reviewer`
- `/rindaman mode auto`

Reviewer mode doctrine should emphasize:

- findings first
- severity ordering
- bug, regression, security, and missing-test focus
- explicit `no findings` when nothing material is found
- residual risks and testing gaps after findings

Out of scope:

- CLI changes
- composable secondary layers
- UI/design enrichment
- new verification commands

## Architecture

Add a new reviewer rule text and a small secondary-layer resolver.

The resolver should return a single effective secondary layer:

- `none`
- `senior`
- `reviewer`

In `auto` mode:

- implementation intent activates `senior`
- review intent activates `reviewer`
- pure release/status/verification intent activates `none`

## Data Flow

1. Resolve configured mode.
2. Apply session override when present.
3. Compute effective mode.
4. In `auto`, analyze intent and choose one secondary layer.
5. Inject core plus the chosen secondary layer.
6. Report `mode`, `secondaryLayer`, and reviewer metadata through status.

## Error Handling

If both implementation and review signals appear, prefer the most recent user intent in the message set or return a deterministic priority rule documented in code.

If no secondary layer qualifies, report `secondaryLayer: "none"`.

## Testing Strategy

Use plugin tests.

Add coverage for:

- config `reviewer` forces reviewer layer
- session override to reviewer works
- auto review request activates reviewer, not senior
- auto implementation request activates senior, not reviewer
- core mode suppresses both secondary layers
- status reports `secondaryLayer` and reviewer metadata

Verification commands:

- `npm run build`
- `npm test`
- `node bin/rindaman.cjs doctor --json`
- `npm pack --dry-run`

## Success Criteria

- Reviewer behavior becomes explicit and testable.
- Senior and reviewer layers never activate together.
- Auto mode selects the correct secondary layer conservatively.
- Status output explains which secondary layer is active and why.
