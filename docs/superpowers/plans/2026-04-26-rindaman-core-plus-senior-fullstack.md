# Rindaman Core Plus Senior Fullstack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand Rindaman into one plugin with two internal layers: always-on governance plus optional senior fullstack implementation guidance.

**Architecture:** Keep the existing core rule intact and add a second stack-agnostic implementation rule that activates only for implementation-oriented requests. Expose the activation state through `rindaman_status` and cover it with plugin tests.

**Tech Stack:** TypeScript OpenCode plugin, message-transform hooks, `node:test`, built `dist` plugin tests.

---

## File Structure

- Modify: `src/rindaman-rule.ts` to add the second rule and marker.
- Modify: `src/index.ts` to add activation logic and status reporting.
- Modify: `test/plugin.test.mjs` to validate layered injection behavior.
- Modify: `README.md` to explain the two-layer model.

## Task 1: Add Senior Fullstack Rule Text

**Files:**
- Modify: `src/rindaman-rule.ts`

- [ ] **Step 1: Add marker constant**

Add after `RINDAMAN_RULE_MARKER`:

```ts
export const RINDAMAN_SENIOR_FULLSTACK_RULE_MARKER =
  "rindaman senior fullstack implementation mode is enabled.";
```

- [ ] **Step 2: Add the second rule text**

Add after `RINDAMAN_RULE`:

```ts
export const RINDAMAN_SENIOR_FULLSTACK_RULE = `
rindaman senior fullstack implementation mode is enabled.

This layer adds framework-agnostic web-product engineering doctrine.

Architecture:
- Organize by feature or domain, not by generic layer dumping grounds.
- Keep UI, application logic, domain rules, and infrastructure boundaries explicit.
- Avoid circular imports across features. Shared utilities must be intentionally cross-cutting.

Boundaries:
- Validate all untrusted inputs at the boundary.
- Keep business rules on the server or trusted execution side.
- Do not leak internal persistence shapes directly to the browser when a stable contract is needed.

Data and contracts:
- Model domain entities explicitly.
- Prefer typed contracts for reads and mutations.
- Keep lifecycle fields on important business records.

Auth and security:
- Treat server-side authorization as the source of truth.
- Use client guards only as defense in depth.

UI delivery:
- Compose small components.
- Keep data loading close to route or page boundaries when possible.
- Avoid ad hoc fetching patterns when a clearer orchestration boundary exists.

Testing and release:
- Prefer integration evidence over mock-heavy confidence theater.
- Keep release discipline aligned with verification discipline.
`.trim();
```

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: rule module compiles.

## Task 2: Add Implementation Intent Detection

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Import the second rule**

Replace the current rule import with:

```ts
import {
  RINDAMAN_RULE,
  RINDAMAN_RULE_MARKER,
  RINDAMAN_SENIOR_FULLSTACK_RULE,
  RINDAMAN_SENIOR_FULLSTACK_RULE_MARKER,
} from "./rindaman-rule.js";
```

- [ ] **Step 2: Add intent keyword sets**

Add near the command sets:

```ts
const IMPLEMENTATION_INTENT_KEYWORDS = [
  "implement",
  "build",
  "create",
  "add feature",
  "wire up",
  "architecture",
  "api",
  "frontend",
  "backend",
  "auth",
  "database",
  "model",
];

const GOVERNANCE_ONLY_KEYWORDS = [
  "review",
  "status",
  "release",
  "version",
  "push",
  "commit",
  "verify",
  "test",
  "doctor",
];
```

- [ ] **Step 3: Add activity detector**

Add after `getMessageText`:

```ts
const isImplementationOrArchitectureRequest = (text: string) => {
  const normalizedText = text.toLowerCase();
  const hasImplementationKeyword = IMPLEMENTATION_INTENT_KEYWORDS.some((keyword) =>
    normalizedText.includes(keyword),
  );
  const hasGovernanceOnlyKeyword = GOVERNANCE_ONLY_KEYWORDS.some((keyword) =>
    normalizedText.includes(keyword),
  );

  return hasImplementationKeyword && !hasGovernanceOnlyKeyword;
};
```

- [ ] **Step 4: Add activation decision helper**

Add after `getRindamanEnabled`:

```ts
const getSeniorFullstackEnabled = (messages: TransformMessage[]) => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (getMessageRole(message) !== "user") {
      continue;
    }

    const text = getMessageText(message);

    if (!text) {
      continue;
    }

    if (isImplementationOrArchitectureRequest(text)) {
      return true;
    }
  }

  return false;
};
```

- [ ] **Step 5: Run build**

Run: `npm run build`

Expected: activation helpers compile.

## Task 3: Inject the Second Rule Conservatively

**Files:**
- Modify: `src/index.ts`
- Modify: `test/plugin.test.mjs`

- [ ] **Step 1: Add helper to detect second rule messages**

Add after `isRindamanRuleMessage`:

```ts
const isSeniorFullstackRuleMessage = (message: TransformMessage) =>
  message.parts.some(
    (part) =>
      part.type === "text" &&
      typeof part.text === "string" &&
      part.text.includes(RINDAMAN_SENIOR_FULLSTACK_RULE_MARKER),
  );
```

- [ ] **Step 2: Add senior fullstack rule message creator**

Add after `createRindamanRuleMessage`:

```ts
const createSeniorFullstackRuleMessage = (): TransformMessage => ({
  info: {
    id: "rindaman-senior-fullstack-rule",
    role: "system",
  },
  parts: [
    {
      type: "text",
      text: RINDAMAN_SENIOR_FULLSTACK_RULE,
    },
  ],
});
```

- [ ] **Step 3: Update message transform**

In `experimental.chat.messages.transform`, filter out both rule types:

```ts
      const messagesWithoutRindamanRules = transformOutput.messages.filter(
        (message) =>
          !isRindamanRuleMessage(message) && !isSeniorFullstackRuleMessage(message),
      );
```

Compute:

```ts
      const enabled = resolvedOptions.enabled && getRindamanEnabled(messagesWithoutRindamanRules);
      const seniorFullstackEnabled = enabled && getSeniorFullstackEnabled(messagesWithoutRindamanRules);
```

Set messages:

```ts
      transformOutput.messages = enabled
        ? [
            createRindamanRuleMessage(),
            ...(seniorFullstackEnabled ? [createSeniorFullstackRuleMessage()] : []),
            ...messagesWithoutRindamanRules,
          ]
        : messagesWithoutRindamanRules;
```

- [ ] **Step 4: Add helper in tests to count second rule**

In `test/plugin.test.mjs`, add after `getRindamanRuleMessages`:

```js
const getSeniorFullstackRuleMessages = (messages) =>
  messages.filter(
    (message) =>
      message.info?.role === "system" &&
      message.parts?.some(
        (part) =>
          part.type === "text" &&
          typeof part.text === "string" &&
          part.text.includes(RINDAMAN_SENIOR_FULLSTACK_RULE_MARKER),
      ),
  );
```

- [ ] **Step 5: Add implementation-task injection test**

```js
test("implementation requests inject senior fullstack guidance", async () => {
  const messages = await runTransform([
    createMessage("user", "Implement a new auth flow for the dashboard"),
  ]);

  assert.equal(getRindamanRuleMessages(messages).length, 1);
  assert.equal(getSeniorFullstackRuleMessages(messages).length, 1);
});
```

- [ ] **Step 6: Add governance-only test**

```js
test("release or status requests do not inject senior fullstack guidance", async () => {
  const messages = await runTransform([
    createMessage("user", "Check release status and verify the branch"),
  ]);

  assert.equal(getRindamanRuleMessages(messages).length, 1);
  assert.equal(getSeniorFullstackRuleMessages(messages).length, 0);
});
```

- [ ] **Step 7: Run plugin tests**

Run: `npm run build && node --test test/plugin.test.mjs`

Expected: new layered injection tests pass.

## Task 4: Expose Activation State in Status Tool

**Files:**
- Modify: `src/index.ts`
- Modify: `test/plugin.test.mjs`

- [ ] **Step 1: Add status field**

In `createRindamanStatusTool`, compute:

```ts
      const seniorFullstackActive = false;
```

For this increment, derive it conservatively from the session’s most recent trigger state if available, or report false when unknown.

Add to JSON:

```ts
          seniorFullstack: {
            active: seniorFullstackActive,
          },
```

- [ ] **Step 2: Persist activation state per session**

Add a new session map near the others:

```ts
const sessionSeniorFullstackStates = new Map<string, boolean>();
```

When message transform determines `seniorFullstackEnabled`, record it by session when possible.

- [ ] **Step 3: Add status test**

```js
test("rindaman_status reports senior fullstack activation state", async () => {
  const hooks = await server();
  const context = createToolContext();
  const output = createOutput([
    createMessage("user", "Implement a product API and auth flow"),
  ]);

  await hooks["experimental.chat.messages.transform"]({ sessionID: context.sessionID }, output);
  const status = await readStatus(hooks, context);

  assert.equal(typeof status.seniorFullstack.active, "boolean");
});
```

- [ ] **Step 4: Run plugin tests**

Run: `npm run build && node --test test/plugin.test.mjs`

Expected: status test passes.

## Task 5: Document the Two-Layer Model

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add model description**

Add a short section near the top:

```md
## Two-Layer Model

Rindaman combines:

- **Core** - strict response mode, lifecycle verification, and quality governance
- **Senior Fullstack** - optional framework-agnostic web-product engineering guidance for implementation-oriented tasks
```

- [ ] **Step 2: Add activation note**

Add:

```md
The Senior Fullstack layer activates automatically for implementation-oriented requests and stays quiet for pure verification, status, or release tasks.
```

- [ ] **Step 3: Run tests**

Run: `npm test`

Expected: tests still pass.

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

Expected: only intended combined-Rindaman files are modified.
