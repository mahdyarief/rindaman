# Rindaman Product Contract

## Identity

Rindaman is a GitHub/local OpenCode plugin that combines:

- core governance and verification
- optional senior-engineer implementation guidance
- optional reviewer guidance
- CLI-backed quality, debt, baseline, workspace, and security checks

## Layers

- **Core** - always-on governance, verification, and final-response discipline
- **Senior Engineer** - implementation-oriented engineering guidance
- **Reviewer** - findings-first review guidance

Core is always active when Rindaman is enabled. Senior Engineer and Reviewer are mutually exclusive secondary layers.

## Modes

- `core`
- `senior`
- `reviewer`
- `auto`

Mode precedence:

1. session override command
2. configured plugin mode
3. default `auto`

## Plugin Tools

- `rindaman_check`
- `rindaman_status`

## CLI Surfaces

- `check`
- `audit`
- `baseline`
- `doctor`

## Status Contract

Canonical status concepts:

- `mode`
- `secondaryLayer`
- `verificationRequired`
- `lastCheck`
- `seniorEngineer`
- `reviewer`
- `finalResponse`

## Stability Levels

### Stable

- plugin id
- tool names
- mode names
- top-level CLI commands
- top-level `rindaman_status` contract semantics

### Experimental

- auto activation heuristics
- matched signal details
- exact secondary-layer intent inference

## Compatibility Notes

Older mental models of Rindaman as only `strict + quality` map to the current `core` layer. Newer guidance layers build on top of core rather than replacing it.
