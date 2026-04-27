# Product Contract And Documentation Unification Design

## Purpose

Rindaman now has enough capability that the next risk is not missing features, but product ambiguity. Users and maintainers need one clear contract for what Rindaman is, what layers it contains, what surfaces are stable, and how to interpret the plugin and CLI outputs.

## Scope

This increment is documentation and contract definition only.

Add or improve:

- a product contract document
- a clearer README structure
- normalized naming for layers and modes
- explicit stability notes for major surfaces
- a canonical `rindaman_status` example

Define these product areas explicitly:

1. **Identity**
   - Rindaman is one plugin that combines governance and engineering guidance.

2. **Layers**
   - Core
   - Senior Engineer
   - Reviewer

3. **Modes**
   - `core`
   - `senior`
   - `reviewer`
   - `auto`

4. **Plugin Tools**
   - `rindaman_check`
   - `rindaman_status`

5. **CLI Surfaces**
   - check, audit, baseline, doctor

6. **Status Contract**
   - canonical stable fields
   - optional or evolving fields

7. **Stability Levels**
   - stable
   - experimental

Out of scope:

- plugin behavior changes
- CLI behavior changes
- new rules or modes
- UI enrichment integration

## Architecture

Documentation should match the actual product model rather than the historical order of implementation.

Recommended artifact split:

- `README.md` as the product overview and quickstart
- `docs/product-contract.md` as the authoritative contract
- optionally `docs/status-schema.md` only if the status section becomes too large

## Data Flow

1. User reads README for quick understanding and installation.
2. Maintainer or integrator reads product contract for mode/layer/schema details.
3. Status and CLI outputs are interpreted against the documented contract.

## Error Handling

The docs must clearly distinguish:

- stable contract fields that integrators may rely on
- experimental semantics that may change

Avoid implying guarantees that the code does not currently enforce.

## Testing Strategy

This increment is documentation-heavy, so verification is consistency-based:

- README matches the implemented modes and tools
- product contract matches current plugin and CLI behavior
- examples do not contradict the code

Verification commands:

- `npm run build`
- `npm test`
- `node bin/rindaman.cjs doctor --json`
- `npm pack --dry-run`

## Success Criteria

- Rindaman has one crisp product definition.
- README is organized by product model, not implementation history.
- Stable and experimental surfaces are documented.
- `rindaman_status` has a canonical contract example.
- Naming is consistent across public docs.
