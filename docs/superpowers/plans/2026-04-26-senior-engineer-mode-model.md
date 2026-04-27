# Senior Engineer Mode Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit `core`, `senior`, and `auto` mode semantics to Rindaman and expose the active mode clearly through plugin status.

**Architecture:** Extend the plugin-side options, session state, toggle parser, and status output so core governance is always present while the senior layer can be forced on, forced off, or selected automatically by intent. Keep the current layered injection model intact.

**Tech Stack:** TypeScript OpenCode plugin, message transform hooks, existing plugin integration tests.

---

## File Structure

- Modify: `src/plugin/options.ts` for configured mode.
- Modify: `src/plugin/session-state.ts` for per-session mode overrides.
- Modify: `src/plugin/toggles.ts` for `/rindaman mode ...` parsing.
- Modify: `src/index.ts` for effective mode resolution and injection behavior.
- Modify: `src/plugin/tools.ts` for richer status output.
- Modify: `test/plugin.test.mjs` for mode and status tests.
- Modify: `README.md` for mode docs.

## Task 1: Add Mode Types and Config Support

**Files:**
- Modify: `src/plugin/options.ts`

- [ ] **Step 1: Add mode type**

Add near the top:

```ts
export type RindamanMode = "core" | "senior" | "auto"
```

- [ ] **Step 2: Extend resolved options**

Add `mode` to `RindamanResolvedOptions`:

```ts
  mode: RindamanMode
```

- [ ] **Step 3: Add mode resolver helper**

Add:

```ts
const getModeOption = (options: PluginOptions | undefined): RindamanMode => {
  const configuredValue = options?.mode
  return configuredValue === "core" || configuredValue === "senior"
    ? configuredValue
    : "auto"
}
```

- [ ] **Step 4: Include mode in resolved options**

In `resolvePluginOptions`, add:

```ts
  mode: getModeOption(options),
```

- [ ] **Step 5: Run build**

Run: `npm run build`

Expected: compiles successfully.

## Task 2: Add Session Mode Overrides

**Files:**
- Modify: `src/plugin/session-state.ts`

- [ ] **Step 1: Add session mode state map**

Add:

```ts
import type { RindamanMode } from "./options.js"

const sessionModeStates = new Map<string, RindamanMode>()
```

- [ ] **Step 2: Export session mode helpers**

Add:

```ts
export const getSessionMode = (sessionID: string) => sessionModeStates.get(sessionID)
export const setSessionMode = (sessionID: string, mode: RindamanMode) => {
  sessionModeStates.set(sessionID, mode)
}
```

- [ ] **Step 3: Export the new helpers**

Ensure `session-state.ts` exports `getSessionMode` and `setSessionMode`.

- [ ] **Step 4: Run build**

Run: `npm run build`

Expected: builds cleanly.

## Task 3: Add Chat Mode Commands

**Files:**
- Modify: `src/plugin/toggles.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Add mode parser**

In `src/plugin/toggles.ts`, add:

```ts
import type { RindamanMode } from "./options.js"

export const getRindamanModeOverride = (text: string): RindamanMode | undefined => {
  const normalizedFullText = normalizeCommandText(text)

  if (normalizedFullText === "/rindaman mode core" || normalizedFullText === "rindaman mode core") {
    return "core"
  }
  if (normalizedFullText === "/rindaman mode senior" || normalizedFullText === "rindaman mode senior") {
    return "senior"
  }
  if (normalizedFullText === "/rindaman mode auto" || normalizedFullText === "rindaman mode auto") {
    return "auto"
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => normalizeCommandText(line))
    .filter(Boolean)

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index]
    if (line === "/rindaman mode core" || line === "rindaman mode core") return "core"
    if (line === "/rindaman mode senior" || line === "rindaman mode senior") return "senior"
    if (line === "/rindaman mode auto" || line === "rindaman mode auto") return "auto"
  }

  return undefined
}
```

- [ ] **Step 2: Update chat.message hook**

In `src/index.ts`, import `getRindamanModeOverride` and `setSessionMode`, then in `chat.message`:

```ts
      const modeOverride = getRindamanModeOverride(messageText)

      if (modeOverride) {
        setSessionMode(input.sessionID, modeOverride)
      }
```

- [ ] **Step 3: Run plugin tests**

Run: `npm run build && node --test test/plugin.test.mjs`

Expected: existing tests still pass.

## Task 4: Resolve Effective Mode and Injection

**Files:**
- Modify: `src/index.ts`
- Modify: `test/plugin.test.mjs`

- [ ] **Step 1: Add effective mode helper in index**

Add a local helper:

```ts
const getEffectiveMode = (
  configuredMode: RindamanMode,
  sessionMode: RindamanMode | undefined,
) => sessionMode ?? configuredMode
```

- [ ] **Step 2: Update messages transform**

In `experimental.chat.messages.transform`, compute:

```ts
      const sessionMode = transformSessionID ? getSessionMode(transformSessionID) : undefined
      const effectiveMode = getEffectiveMode(resolvedOptions.mode, sessionMode)
```

Then derive senior layer activation as:

```ts
      const seniorFullstackEnabled =
        effectiveMode === "senior"
          ? enabled
          : effectiveMode === "core"
            ? false
            : enabled && getSeniorFullstackEnabled(
                messagesWithoutRindamanRules,
                getMessageRole,
                getMessageText,
              )
```

- [ ] **Step 3: Add mode tests**

Add these tests to `test/plugin.test.mjs`:

```js
test("config core mode suppresses senior guidance", async () => {
  const hooks = await server({}, { mode: "core" })
  const output = createOutput([
    createMessage("user", "Implement an auth and API flow"),
  ])

  await hooks["experimental.chat.messages.transform"]({}, output)

  assert.equal(getRindamanRuleMessages(output.messages).length, 1)
  assert.equal(getSeniorFullstackRuleMessages(output.messages).length, 0)
})

test("config senior mode forces senior guidance", async () => {
  const hooks = await server({}, { mode: "senior" })
  const output = createOutput([
    createMessage("user", "Check release status"),
  ])

  await hooks["experimental.chat.messages.transform"]({}, output)

  assert.equal(getRindamanRuleMessages(output.messages).length, 1)
  assert.equal(getSeniorFullstackRuleMessages(output.messages).length, 1)
})
```

- [ ] **Step 4: Run plugin tests**

Run: `npm run build && node --test test/plugin.test.mjs`

Expected: mode-driven injection works.

## Task 5: Report Mode and Reason In Status

**Files:**
- Modify: `src/plugin/tools.ts`
- Modify: `test/plugin.test.mjs`

- [ ] **Step 1: Extend tool dependencies**

In `src/plugin/tools.ts`, add to `ToolDependencies`:

```ts
  getSessionMode: (sessionID: string) => RindamanMode | undefined
```

Import `RindamanMode` from `./options.js`.

- [ ] **Step 2: Add status fields**

In `createRindamanStatusTool`, compute:

```ts
      const sessionMode = dependencies.getSessionMode(context.sessionID)
      const effectiveMode = sessionMode ?? resolvedOptions.mode
      const seniorFullstackIntent = seniorFullstackActive ? "implementation" : "none"
      const seniorFullstackReason =
        effectiveMode === "core"
          ? "core mode forced"
          : effectiveMode === "senior"
            ? "senior mode forced"
            : seniorFullstackActive
              ? "implementation intent detected"
              : "auto mode with no implementation intent"
```

Add to JSON:

```ts
          mode: effectiveMode,
          seniorEngineer: {
            active: seniorFullstackActive,
            reason: seniorFullstackReason,
            intent: seniorFullstackIntent,
          },
```

- [ ] **Step 3: Add status semantics test**

Add:

```js
test("rindaman_status reports mode and senior engineer semantics", async () => {
  const hooks = await server({}, { mode: "auto" })
  const context = createToolContext()
  const output = createOutput([
    createMessage("user", "Implement a product API and auth flow"),
  ])

  await hooks["experimental.chat.messages.transform"]({ sessionID: context.sessionID }, output)
  const status = await readStatus(hooks, context)

  assert.equal(status.mode, "auto")
  assert.equal(typeof status.seniorEngineer.active, "boolean")
  assert.equal(typeof status.seniorEngineer.reason, "string")
  assert.equal(typeof status.seniorEngineer.intent, "string")
})
```

- [ ] **Step 4: Run plugin tests**

Run: `npm run build && node --test test/plugin.test.mjs`

Expected: passes.

## Task 6: Document Mode Commands

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add mode docs**

Add a short section:

```md
### Senior Engineer Modes

Rindaman supports three senior-guidance modes:

- `core` - governance only
- `senior` - governance plus senior fullstack guidance
- `auto` - governance always, senior guidance only for implementation-oriented requests

Session overrides:

- `/rindaman mode core`
- `/rindaman mode senior`
- `/rindaman mode auto`
```

- [ ] **Step 2: Run full tests**

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

Expected: only intended senior mode model files are modified.
