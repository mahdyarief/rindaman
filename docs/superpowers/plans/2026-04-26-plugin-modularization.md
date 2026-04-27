# Plugin Modularization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the Rindaman plugin internals into focused modules while preserving all current plugin behavior.

**Architecture:** Extract plugin concerns from `src/index.ts` into `src/plugin/` modules with explicit responsibilities. Keep `src/index.ts` as the composition layer that wires the helpers into OpenCode hooks.

**Tech Stack:** TypeScript OpenCode plugin, `node:test`, existing plugin integration tests.

---

## File Structure

- Create: `src/plugin/options.ts`
- Create: `src/plugin/session-state.ts`
- Create: `src/plugin/final-response-gate.ts`
- Create: `src/plugin/toggles.ts`
- Create: `src/plugin/intent.ts`
- Create: `src/plugin/rule-messages.ts`
- Create: `src/plugin/tools.ts`
- Modify: `src/index.ts`

## Task 1: Extract Option Resolution

**Files:**
- Create: `src/plugin/options.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Create options module**

Create `src/plugin/options.ts` with:

```ts
import type { PluginOptions } from "@opencode-ai/plugin"

export type RindamanResolvedOptions = {
  enabled: boolean
  strictResponses: boolean
  qualityLifecycle: boolean
  verificationRequired: boolean
}

const getBooleanOption = (
  options: PluginOptions | undefined,
  key: string,
  defaultValue: boolean,
) => {
  const configuredValue = options?.[key]
  return typeof configuredValue === "boolean" ? configuredValue : defaultValue
}

export const resolvePluginOptions = (
  options: PluginOptions | undefined,
): RindamanResolvedOptions => ({
  enabled: getBooleanOption(options, "enabled", true),
  strictResponses: getBooleanOption(options, "strictResponses", true),
  qualityLifecycle: getBooleanOption(options, "qualityLifecycle", true),
  verificationRequired: getBooleanOption(options, "verificationRequired", true),
})
```

- [ ] **Step 2: Replace local option code**

In `src/index.ts`, import `resolvePluginOptions` and `RindamanResolvedOptions`, then delete the local definitions.

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: compiles successfully.

## Task 2: Extract Session State and Gate Logic

**Files:**
- Create: `src/plugin/session-state.ts`
- Create: `src/plugin/final-response-gate.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Create session state module**

Create `src/plugin/session-state.ts` with:

```ts
export type SessionQualityState = {
  changedFiles: string[]
  lastCheckAt?: string
  lastCheckStatus?: string
  lastCheckCommand?: string
  lastCheckExitCode?: number | null
}

const sessionStates = new Map<string, SessionQualityState>()
const sessionEnabledStates = new Map<string, boolean>()
const sessionSeniorFullstackStates = new Map<string, boolean>()

export const getSessionState = (sessionID: string) => {
  const existingState = sessionStates.get(sessionID)
  if (existingState) return existingState

  const initialState: SessionQualityState = { changedFiles: [] }
  sessionStates.set(sessionID, initialState)
  return initialState
}

export { sessionEnabledStates, sessionSeniorFullstackStates }
```

- [ ] **Step 2: Create final response gate module**

Create `src/plugin/final-response-gate.ts` with:

```ts
import type { RindamanResolvedOptions } from "./options.js"
import type { SessionQualityState } from "./session-state.js"

export type FinalResponseGate = {
  allowed: boolean
  reason: string
}

export const isVerificationRequired = (
  resolvedOptions: RindamanResolvedOptions,
  sessionState: SessionQualityState,
) => resolvedOptions.verificationRequired && sessionState.changedFiles.length > 0

export const createFinalResponseGate = (
  resolvedOptions: RindamanResolvedOptions,
  sessionState: SessionQualityState,
): FinalResponseGate => {
  if (!resolvedOptions.enabled) {
    return { allowed: true, reason: "rindaman disabled" }
  }
  if (!resolvedOptions.qualityLifecycle) {
    return { allowed: true, reason: "quality lifecycle disabled" }
  }
  if (!isVerificationRequired(resolvedOptions, sessionState)) {
    return { allowed: true, reason: "verification not required" }
  }
  if (sessionState.lastCheckStatus === "passed") {
    return { allowed: true, reason: "verification passed" }
  }
  if (sessionState.lastCheckStatus === "failed") {
    return { allowed: false, reason: "verification failed" }
  }
  if (sessionState.lastCheckStatus === "error") {
    return { allowed: false, reason: "verification errored" }
  }
  return { allowed: false, reason: "verification pending" }
}
```

- [ ] **Step 3: Replace local state and gate code**

In `src/index.ts`, import these helpers and remove the local equivalents.

- [ ] **Step 4: Run plugin tests**

Run: `npm run build && node --test test/plugin.test.mjs`

Expected: plugin tests pass.

## Task 3: Extract Toggle and Intent Logic

**Files:**
- Create: `src/plugin/toggles.ts`
- Create: `src/plugin/intent.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Create toggles module**

Move these concerns into `src/plugin/toggles.ts`:

- `RINDAMAN_ON_COMMANDS`
- `RINDAMAN_OFF_COMMANDS`
- `normalizeCommandText`
- `getRindamanToggle`
- `getRindamanEnabled`

Export the functions used by `src/index.ts`.

- [ ] **Step 2: Create intent module**

Move these concerns into `src/plugin/intent.ts`:

- `IMPLEMENTATION_INTENT_KEYWORDS`
- `GOVERNANCE_ONLY_KEYWORDS`
- `isImplementationOrArchitectureRequest`
- `getSeniorFullstackEnabled`

- [ ] **Step 3: Replace local intent/toggle code**

Import the new helpers in `src/index.ts` and remove the local copies.

- [ ] **Step 4: Run plugin tests**

Run: `npm run build && node --test test/plugin.test.mjs`

Expected: plugin tests pass unchanged.

## Task 4: Extract Rule Message Helpers

**Files:**
- Create: `src/plugin/rule-messages.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Create rule message module**

Create `src/plugin/rule-messages.ts` with:

- `MessagePart`
- `TransformMessage`
- `TransformOutput`
- `getMessageRole`
- `getMessageText`
- `isRindamanRuleMessage`
- `isSeniorFullstackRuleMessage`
- `createRindamanRuleMessage`
- `createSeniorFullstackRuleMessage`

Use the existing implementations from `src/index.ts`.

- [ ] **Step 2: Update index imports**

Import those helpers and types into `src/index.ts`, then delete the local copies.

- [ ] **Step 3: Run plugin tests**

Run: `npm run build && node --test test/plugin.test.mjs`

Expected: plugin tests pass.

## Task 5: Extract Tool Construction

**Files:**
- Create: `src/plugin/tools.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Create tools module**

Move these into `src/plugin/tools.ts`:

- `getCliPath`
- `readChangedFiles`
- `createRindamanCheckTool`
- `createRindamanStatusTool`

Make the module take explicit dependencies instead of importing hidden state from `src/index.ts`.

Suggested constructor shape:

```ts
export const createRindamanCheckTool = (dependencies) => tool({...})
export const createRindamanStatusTool = (resolvedOptions, dependencies) => tool({...})
```

Where `dependencies` contains the session helpers and final-response gate helpers.

- [ ] **Step 2: Replace local tool builders**

In `src/index.ts`, import the tool builders and wire the dependencies in the `server` function.

- [ ] **Step 3: Run full tests**

Run: `npm test`

Expected: all tests pass.

## Task 6: Thin Composition File

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Keep only composition in index**

After extraction, `src/index.ts` should mainly contain:

- imports
- `server` composition
- exported plugin metadata

No large inline helper blocks should remain.

- [ ] **Step 2: Run final verification**

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
- doctor JSON reports `status: "passed"`
- package dry-run passes
- only intended plugin refactor files are modified
