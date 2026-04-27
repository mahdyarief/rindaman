# Reviewer Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an explicit reviewer mode to Rindaman with a mutually exclusive reviewer secondary layer.

**Architecture:** Keep core always active, keep secondary layers mutually exclusive, add a reviewer rule plus reviewer intent analysis, and extend mode resolution and status reporting without changing CLI behavior.

**Tech Stack:** TypeScript OpenCode plugin, existing modular plugin helpers, plugin integration tests.

---

## File Structure

- Modify: `src/rindaman-rule.ts` for a reviewer rule.
- Modify: `src/plugin/options.ts` for `reviewer` mode support.
- Modify: `src/plugin/toggles.ts` for reviewer mode override commands.
- Modify: `src/plugin/intent.ts` for reviewer intent analysis.
- Modify: `src/index.ts` for mutually exclusive secondary-layer resolution.
- Modify: `src/plugin/tools.ts` for reviewer status metadata.
- Modify: `test/plugin.test.mjs` for reviewer mode tests.
- Modify: `README.md` for reviewer mode docs.

## Task 1: Add Reviewer Rule

**Files:**
- Modify: `src/rindaman-rule.ts`

- [ ] **Step 1: Add reviewer marker**

Add:

```ts
export const RINDAMAN_REVIEWER_RULE_MARKER =
  "rindaman reviewer mode is enabled.";
```

- [ ] **Step 2: Add reviewer rule text**

Add:

```ts
export const RINDAMAN_REVIEWER_RULE = `
rindaman reviewer mode is enabled.

Review doctrine:
- Present findings first.
- Prioritize bugs, regressions, security risks, and missing tests.
- Prefer concrete behavioral risks over stylistic commentary.
- If no findings are discovered, say so explicitly.
- After findings, list residual risks or testing gaps briefly.
`.trim();
```

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: compiles.

## Task 2: Extend Mode Model

**Files:**
- Modify: `src/plugin/options.ts`
- Modify: `src/plugin/toggles.ts`
- Modify: `src/plugin/session-state.ts`

- [ ] **Step 1: Extend mode type**

Change:

```ts
export type RindamanMode = "core" | "senior" | "auto"
```

to:

```ts
export type RindamanMode = "core" | "senior" | "reviewer" | "auto"
```

- [ ] **Step 2: Extend config mode parser**

In `getModeOption`, accept `reviewer` as a valid configured mode.

- [ ] **Step 3: Add reviewer chat command override**

In `src/plugin/toggles.ts`, update `getRindamanModeOverride` to recognize:

```ts
"/rindaman mode reviewer"
"rindaman mode reviewer"
```

- [ ] **Step 4: Run build**

Run: `npm run build`

Expected: mode model compiles.

## Task 3: Add Reviewer Intent Analysis

**Files:**
- Modify: `src/plugin/intent.ts`

- [ ] **Step 1: Add reviewer signal group**

Add:

```ts
const REVIEW_SIGNALS = ["review", "audit", "inspect", "find issues", "risks", "regression"]
```

- [ ] **Step 2: Extend activation metadata type**

If needed, ensure the intent union already supports `review`.

- [ ] **Step 3: Update analysis logic**

In `analyzeSeniorFullstackActivation`, distinguish review intent from governance-only by returning:

```ts
      return {
        active: false,
        intent: "review",
        reason: "review-oriented request detected",
        intentSource: "auto-signals",
        matchedSignals: reviewSignals,
      }
```

for review requests.

- [ ] **Step 4: Rename function or add new resolver**

Either:

- rename the function to something like `analyzeSecondaryLayerIntent`, or
- keep the current function and add a second helper for reviewer intent.

Prefer the smallest correct change.

- [ ] **Step 5: Run plugin tests**

Run: `npm run build && node --test test/plugin.test.mjs`

Expected: existing tests still pass or only fail where reviewer behavior is now expected.

## Task 4: Make Secondary Layers Mutually Exclusive

**Files:**
- Modify: `src/index.ts`
- Modify: `src/plugin/tools.ts`

- [ ] **Step 1: Add secondary-layer state**

In `src/index.ts`, add a session map for the active secondary layer:

```ts
const sessionSecondaryLayerStates = new Map<string, "none" | "senior" | "reviewer">()
```

- [ ] **Step 2: Update auto resolution**

When mode is `auto`, resolve:

- `reviewer` for review intent
- `senior` for implementation intent
- `none` otherwise

- [ ] **Step 3: Update forced mode resolution**

Resolve:

- `core` -> `none`
- `senior` -> `senior`
- `reviewer` -> `reviewer`

- [ ] **Step 4: Inject reviewer rule**

In message transform, inject exactly one secondary rule:

```ts
...(secondaryLayer === "senior" ? [createSeniorFullstackRuleMessage()] : []),
...(secondaryLayer === "reviewer" ? [createReviewerRuleMessage()] : []),
```

- [ ] **Step 5: Status output includes secondary layer**

In `rindaman_status`, add:

```ts
secondaryLayer: "none" | "senior" | "reviewer"
```

- [ ] **Step 6: Run plugin tests**

Run: `npm run build && node --test test/plugin.test.mjs`

Expected: mode behavior passes.

## Task 5: Add Reviewer Tests

**Files:**
- Modify: `test/plugin.test.mjs`

- [ ] **Step 1: Add reviewer rule helper**

Create a helper similar to `getSeniorFullstackRuleMessages` for the reviewer marker.

- [ ] **Step 2: Add config reviewer mode test**

```js
test("config reviewer mode forces reviewer guidance", async () => {
  const hooks = await server({}, { mode: "reviewer" })
  const output = createOutput([createMessage("user", "Implement an auth flow")])

  await hooks["experimental.chat.messages.transform"]({}, output)

  assert.equal(getSeniorFullstackRuleMessages(output.messages).length, 0)
  assert.equal(getReviewerRuleMessages(output.messages).length, 1)
})
```

- [ ] **Step 3: Add auto review activation test**

```js
test("auto review request activates reviewer guidance", async () => {
  const messages = await runTransform([
    createMessage("user", "Review this auth API and find issues"),
  ])

  assert.equal(getSeniorFullstackRuleMessages(messages).length, 0)
  assert.equal(getReviewerRuleMessages(messages).length, 1)
})
```

- [ ] **Step 4: Add core suppression test**

```js
test("core mode suppresses reviewer and senior layers", async () => {
  const hooks = await server({}, { mode: "core" })
  const output = createOutput([createMessage("user", "Review this auth API and find issues")])

  await hooks["experimental.chat.messages.transform"]({}, output)

  assert.equal(getSeniorFullstackRuleMessages(output.messages).length, 0)
  assert.equal(getReviewerRuleMessages(output.messages).length, 0)
})
```

- [ ] **Step 5: Add status reviewer semantics test**

```js
test("status reports reviewer secondary layer", async () => {
  const hooks = await server({}, { mode: "reviewer" })
  const context = createToolContext()
  const output = createOutput([createMessage("user", "Review this API")])

  await hooks["experimental.chat.messages.transform"]({ sessionID: context.sessionID }, output)
  const status = await readStatus(hooks, context)

  assert.equal(status.mode, "reviewer")
  assert.equal(status.secondaryLayer, "reviewer")
  assert.equal(typeof status.reviewer.active, "boolean")
})
```

- [ ] **Step 6: Run plugin tests**

Run: `npm run build && node --test test/plugin.test.mjs`

Expected: reviewer tests pass.

## Task 6: Document Reviewer Mode

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update mode section**

Add `reviewer` to the documented modes.

- [ ] **Step 2: Add reviewer mode commands**

Add:

```md
- `/rindaman mode reviewer`
```

- [ ] **Step 3: Add status semantics note**

Document:

```md
- `secondaryLayer`
- `reviewer.active`
- `reviewer.reason`
- `reviewer.intent`
```

- [ ] **Step 4: Run full tests**

Run: `npm test`

Expected: all tests pass.

## Task 7: Final Verification

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

Expected: only intended reviewer-mode files are modified.
