# Senior Engineer Activation Precision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make senior-engineer auto activation more precise and expose clearer activation metadata in plugin status.

**Architecture:** Keep the current `core/senior/auto` mode model intact, but replace loose activation booleans in the intent layer with structured activation analysis. Wire the resulting metadata through `src/index.ts` and `rindaman_status` without changing CLI behavior.

**Tech Stack:** TypeScript OpenCode plugin, modular plugin helpers, `node:test` plugin integration suite.

---

## File Structure

- Modify: `src/plugin/intent.ts` for structured activation analysis.
- Modify: `src/index.ts` for effective mode + activation metadata handling.
- Modify: `src/plugin/tools.ts` for richer status output.
- Modify: `test/plugin.test.mjs` for true-positive and false-positive activation tests.
- Modify: `README.md` for status/activation semantics if needed.

## Task 1: Add Structured Activation Analysis

**Files:**
- Modify: `src/plugin/intent.ts`

- [ ] **Step 1: Add activation metadata type**

Add near the top:

```ts
export type SeniorEngineerActivation = {
  active: boolean
  intent: "implementation" | "architecture" | "review" | "release" | "status" | "none"
  reason: string
  intentSource: "forced-mode" | "auto-signals" | "none"
  matchedSignals: string[]
}
```

- [ ] **Step 2: Split current signals into clearer groups**

Replace the current keyword arrays with three groups:

```ts
const IMPLEMENTATION_VERBS = ["implement", "build", "create", "add", "wire", "refactor"]
const ARCHITECTURE_SIGNALS = ["api", "auth", "schema", "contract", "database", "data flow", "feature architecture", "backend", "frontend"]
const GOVERNANCE_SIGNALS = ["review", "status", "release", "verify", "push", "commit", "doctor"]
```

- [ ] **Step 3: Add signal collector**

Add helper:

```ts
const collectMatchedSignals = (text: string, signals: string[]) =>
  signals.filter((signal) => text.includes(signal))
```

- [ ] **Step 4: Add activation analyzer**

Replace `getSeniorFullstackEnabled` with a richer function:

```ts
export const analyzeSeniorFullstackActivation = (
  messages: TransformMessage[],
  getMessageRole: (message: TransformMessage) => string | undefined,
  getMessageText: (message: TransformMessage) => string,
): SeniorEngineerActivation => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]

    if (getMessageRole(message) !== "user") {
      continue
    }

    const normalizedText = getMessageText(message).toLowerCase()

    if (!normalizedText) {
      continue
    }

    const implementationSignals = collectMatchedSignals(normalizedText, IMPLEMENTATION_VERBS)
    const architectureSignals = collectMatchedSignals(normalizedText, ARCHITECTURE_SIGNALS)
    const governanceSignals = collectMatchedSignals(normalizedText, GOVERNANCE_SIGNALS)

    if (governanceSignals.length > 0 && implementationSignals.length === 0) {
      return {
        active: false,
        intent: "review",
        reason: "governance-oriented request detected",
        intentSource: "auto-signals",
        matchedSignals: governanceSignals,
      }
    }

    if (implementationSignals.length > 0 && architectureSignals.length > 0) {
      return {
        active: true,
        intent: "implementation",
        reason: "implementation and product-engineering signals detected",
        intentSource: "auto-signals",
        matchedSignals: [...implementationSignals, ...architectureSignals],
      }
    }
  }

  return {
    active: false,
    intent: "none",
    reason: "no qualifying signals detected",
    intentSource: "none",
    matchedSignals: [],
  }
}
```

- [ ] **Step 5: Run build**

Run: `npm run build`

Expected: compiles cleanly.

## Task 2: Use Activation Metadata in Index

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Import the new analyzer and type**

Replace the old boolean import with:

```ts
import {
  analyzeSeniorFullstackActivation,
  type SeniorEngineerActivation,
} from "./plugin/intent.js"
```

- [ ] **Step 2: Add a local state helper for activation metadata**

Near `getEffectiveMode`, add:

```ts
const sessionSeniorEngineerMetadata = new Map<string, SeniorEngineerActivation>()
```

- [ ] **Step 3: Replace boolean-only activation logic**

In `experimental.chat.messages.transform`, replace:

```ts
      const seniorFullstackEnabled = enabled && getSeniorFullstackEnabled(...)
```

with:

```ts
      const activation = analyzeSeniorFullstackActivation(
        messagesWithoutRindamanRules,
        getMessageRole,
        getMessageText,
      )
```

Then compute effective enablement:

```ts
      const effectiveSeniorFullstackEnabled =
        effectiveMode === "senior"
          ? enabled
          : effectiveMode === "core"
            ? false
            : enabled && activation.active
```

- [ ] **Step 4: Persist metadata**

When `transformSessionID` exists, store:

```ts
      sessionSeniorEngineerMetadata.set(transformSessionID, {
        ...activation,
        active: effectiveSeniorFullstackEnabled,
        intentSource:
          effectiveMode === "senior"
            ? "forced-mode"
            : effectiveMode === "core"
              ? "forced-mode"
              : activation.intentSource,
        reason:
          effectiveMode === "senior"
            ? "senior mode forced"
            : effectiveMode === "core"
              ? "core mode forced"
              : activation.reason,
      })
```

- [ ] **Step 5: Run plugin tests**

Run: `npm run build && node --test test/plugin.test.mjs`

Expected: existing tests pass or reveal assertion updates needed for richer semantics.

## Task 3: Extend Status Output

**Files:**
- Modify: `src/plugin/tools.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Extend tool dependencies**

In `src/plugin/tools.ts`, add to `ToolDependencies`:

```ts
  getSeniorEngineerMetadata: (sessionID: string) =>
    | {
        active: boolean
        intent: string
        reason: string
        intentSource: string
        matchedSignals: string[]
      }
    | undefined
```

- [ ] **Step 2: Replace placeholder status semantics**

In `createRindamanStatusTool`, replace the current synthetic `seniorFullstackReason` and `seniorFullstackIntent` logic with metadata from `getSeniorEngineerMetadata`.

Fallback metadata when missing:

```ts
      const seniorEngineerMetadata = dependencies.getSeniorEngineerMetadata(context.sessionID) ?? {
        active: seniorFullstackActive,
        intent: "none",
        reason: "no activation analysis recorded",
        intentSource: "none",
        matchedSignals: [],
      }
```

Then set:

```ts
          seniorEngineer: {
            active: seniorEngineerMetadata.active,
            reason: seniorEngineerMetadata.reason,
            intent: seniorEngineerMetadata.intent,
            intentSource: seniorEngineerMetadata.intentSource,
            matchedSignals: seniorEngineerMetadata.matchedSignals,
          },
```

- [ ] **Step 3: Wire dependency in index**

When constructing both tools in `src/index.ts`, pass:

```ts
        getSeniorEngineerMetadata: (sessionID) =>
          sessionSeniorEngineerMetadata.get(sessionID),
```

- [ ] **Step 4: Run plugin tests**

Run: `npm run build && node --test test/plugin.test.mjs`

Expected: status continues passing.

## Task 4: Add Adversarial Tests

**Files:**
- Modify: `test/plugin.test.mjs`

- [ ] **Step 1: Add false-positive prevention test**

```js
test("generic implementation request without engineering context stays core-only", async () => {
  const messages = await runTransform([
    createMessage("user", "Implement the dashboard filter"),
  ])

  assert.equal(getRindamanRuleMessages(messages).length, 1)
  assert.equal(getSeniorFullstackRuleMessages(messages).length, 0)
})
```

- [ ] **Step 2: Add review-with-domain-terms test**

```js
test("review request mentioning api or auth stays core-only", async () => {
  const messages = await runTransform([
    createMessage("user", "Review the auth API schema and tell me the risks"),
  ])

  assert.equal(getRindamanRuleMessages(messages).length, 1)
  assert.equal(getSeniorFullstackRuleMessages(messages).length, 0)
})
```

- [ ] **Step 3: Add matched-signal status test**

```js
test("status reports matched signals and intent source", async () => {
  const hooks = await server({}, { mode: "auto" })
  const context = createToolContext()
  const output = createOutput([
    createMessage("user", "Implement an auth API contract for the dashboard"),
  ])

  await hooks["experimental.chat.messages.transform"]({ sessionID: context.sessionID }, output)
  const status = await readStatus(hooks, context)

  assert.ok(Array.isArray(status.seniorEngineer.matchedSignals))
  assert.equal(typeof status.seniorEngineer.intentSource, "string")
})
```

- [ ] **Step 4: Run plugin tests**

Run: `npm run build && node --test test/plugin.test.mjs`

Expected: adversarial tests pass.

## Task 5: Documentation Update

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Extend status documentation**

Add the new fields to the `rindaman_status` section:

```md
- `seniorEngineer.intentSource`
- `seniorEngineer.matchedSignals`
```

- [ ] **Step 2: Clarify auto activation semantics**

Add a short sentence:

```md
In `auto` mode, the senior layer activates only when implementation signals and web-product engineering context appear together.
```

- [ ] **Step 3: Run tests**

Run: `npm test`

Expected: all tests pass.

## Task 6: Final Verification

**Files:**
- All files above.

- [ ] **Step 1: Run build**

Run: `npm run build`

Expected: build passes.

- [ ] **Step 2: Run tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 3: Run doctor JSON**

Run: `node bin/rindaman.cjs doctor --json`

Expected: JSON output with `status` equal to `passed`.

- [ ] **Step 4: Run package dry-run**

Run: `npm pack --dry-run`

Expected: package dry-run succeeds.

- [ ] **Step 5: Inspect git status**

Run: `git status --short`

Expected: only intended activation-precision files are modified.
