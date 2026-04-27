# Product Contract And Documentation Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Rindaman a single coherent public contract covering identity, layers, modes, tools, status semantics, CLI surfaces, and stability levels.

**Architecture:** Keep this increment documentation-only. Add a dedicated product contract document, restructure the README around the product model, and define a clear stable/experimental boundary for users and integrators.

**Tech Stack:** Markdown docs, existing README, current plugin and CLI contracts.

---

## File Structure

- Create: `docs/product-contract.md`
- Modify: `README.md`
- Optionally create: `docs/status-schema.md` only if the status section becomes too large for README

## Task 1: Create Product Contract Document

**Files:**
- Create: `docs/product-contract.md`

- [ ] **Step 1: Add product identity section**

Start the document with:

```md
# Rindaman Product Contract

## Identity

Rindaman is a GitHub/local OpenCode plugin that combines:

- core governance and verification
- optional senior-engineer implementation guidance
- optional reviewer guidance
- CLI-backed quality, debt, baseline, workspace, and security checks
```

- [ ] **Step 2: Add layer model**

Add:

```md
## Layers

- **Core** - always-on governance, verification, and final-response discipline
- **Senior Engineer** - implementation-oriented engineering guidance
- **Reviewer** - findings-first review guidance

Core is always active when Rindaman is enabled. Senior Engineer and Reviewer are mutually exclusive secondary layers.
```

- [ ] **Step 3: Add mode model**

Add:

```md
## Modes

- `core`
- `senior`
- `reviewer`
- `auto`

Mode precedence:

1. session override command
2. configured plugin mode
3. default `auto`
```

- [ ] **Step 4: Add plugin tools and CLI surfaces**

Add sections documenting:

```md
## Plugin Tools

- `rindaman_check`
- `rindaman_status`

## CLI Surfaces

- `check`
- `audit`
- `baseline`
- `doctor`
```

- [ ] **Step 5: Add stability section**

Add:

```md
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
```

## Task 2: Restructure README Around Product Model

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace the opening section ordering**

Reorder the README so the early sections follow this flow:

```md
# rindaman

<one-sentence identity>

## What It Is
## Layers
## Modes
## Tools
## CLI
## Install
## Releasing
```

Keep existing content, but move it into a cleaner order rather than deleting useful details.

- [ ] **Step 2: Add explicit layer section**

Add or update a concise section:

```md
## Layers

- **Core** - always-on governance and verification
- **Senior Engineer** - implementation-oriented engineering guidance
- **Reviewer** - findings-first review guidance
```

- [ ] **Step 3: Add explicit mode section**

Create a compact mode table:

```md
## Modes

| Mode | Meaning |
|---|---|
| `core` | Governance only |
| `senior` | Governance plus senior engineer guidance |
| `reviewer` | Governance plus reviewer guidance |
| `auto` | Governance always, secondary layer chosen by intent |
```

- [ ] **Step 4: Add contract link**

Add a short note:

```md
For the canonical contract, see `docs/product-contract.md`.
```

## Task 3: Canonical Status Example

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add one canonical status example**

Add a single `rindaman_status` JSON example that includes:

```json
{
  "enabled": true,
  "mode": "auto",
  "secondaryLayer": "senior",
  "verificationRequired": true,
  "lastCheck": {
    "status": "passed"
  },
  "seniorEngineer": {
    "active": true,
    "effectiveMode": "auto",
    "reason": "implementation intent detected",
    "intent": "implementation",
    "intentSource": "auto-signals",
    "matchedSignals": ["implement", "api", "auth"]
  },
  "reviewer": {
    "active": false,
    "reason": "reviewer layer inactive",
    "intent": "none"
  },
  "finalResponse": {
    "allowed": true,
    "reason": "verification passed"
  }
}
```

- [ ] **Step 2: Clarify optional/evolving fields**

Directly below the example, add:

```md
`mode`, `secondaryLayer`, and the presence of `seniorEngineer`/`reviewer` are stable product concepts. `matchedSignals` and exact intent heuristics are experimental and may evolve.
```

## Task 4: Final Consistency Pass

**Files:**
- Modify: `README.md`
- Create: `docs/product-contract.md`

- [ ] **Step 1: Normalize naming**

Use these exact public names consistently:

- `Core`
- `Senior Engineer`
- `Reviewer`
- `secondaryLayer`

Avoid mixing `seniorFullstack` into the public documentation except where referring to a technical/internal field if still present.

- [ ] **Step 2: Verify docs against current behavior**

Check that README and product contract match:

- current modes
- current chat commands
- current status fields
- current CLI commands

- [ ] **Step 3: Run verification commands**

Run:

```bash
npm run build
npm test
node bin/rindaman.cjs doctor --json
npm pack --dry-run
git status --short
```

Expected:

- build passes
- tests pass
- doctor passes
- pack dry-run passes
- only intended documentation files are modified
