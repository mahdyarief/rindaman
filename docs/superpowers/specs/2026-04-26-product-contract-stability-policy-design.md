# Product Contract Stability Policy Design

## Purpose

Rindaman has grown into a serious engineering product, but its public contract is still spread across README sections, code, and historical specs. The biggest remaining product risk is ambiguity about what Rindaman guarantees, what is stable, and what is still heuristic or evolving.

This increment defines a canonical product contract and a clear stability policy.

## Scope

Add a single authoritative contract document that defines:

- product identity
- layer model
- mode model
- plugin tool surfaces
- CLI command surfaces
- status schema semantics
- stable vs experimental surfaces
- compatibility and migration notes

Add a stability policy that explicitly separates:

### Stable

- plugin id
- plugin tool names
- mode names
- top-level CLI commands
- CLI exit code meanings
- top-level `rindaman_status` semantics

### Experimental

- automatic intent heuristics
- matched signal details
- exact reviewer/senior activation reasons
- detailed signal taxonomy used for `auto`

README should be updated to point to the contract as the source of truth instead of trying to carry every detail inline.

Out of scope:

- plugin behavior changes
- CLI behavior changes
- new modes or tools
- UI enrichment integration

## Architecture

Recommended documentation structure:

- `README.md` = product overview, quickstart, install, and links
- `docs/product-contract.md` = canonical public contract
- optionally a short migration section in the contract rather than a separate file

The contract should describe product surfaces in a consumer-facing way, not as internal implementation details.

## Data Flow

1. User reads README for quick understanding and installation.
2. Maintainer or integrator reads the product contract for exact semantics.
3. Future changes are evaluated against the stable vs experimental boundary.

## Error Handling

The contract must not overpromise.

If a surface is still driven by heuristics, it should be explicitly marked experimental.

If a field is stable in meaning but not in low-level implementation details, the contract should say so plainly.

## Testing Strategy

This is a docs/contract increment, so verification is consistency-based:

- README matches current plugin and CLI behavior
- contract reflects current implemented modes and status fields
- stable/experimental labels do not contradict code reality

Verification commands:

- `npm run build`
- `npm test`
- `node bin/rindaman.cjs doctor --json`
- `npm pack --dry-run`

## Success Criteria

- Rindaman has one canonical product contract.
- Stable vs experimental semantics are explicit.
- README points readers to the contract instead of duplicating too much detail.
- Future features have a clearer standard for whether they are stable or experimental.
