# Plugin Enforcement Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add final-response gate metadata to Rindaman's OpenCode plugin status and check tools.

**Architecture:** Keep state in `src/index.ts`, add a pure final-response gate evaluator, update `rindaman_check` and `rindaman_status`, and strengthen `src/rindaman-rule.ts`. Extend `test/plugin.test.mjs` using existing plugin test patterns.

**Tech Stack:** TypeScript OpenCode plugin, Node `node:test`, built package tests through `dist`.

---

## File Structure

- Modify: `src/index.ts` for gate metadata, status output, and check status handling.
- Modify: `src/rindaman-rule.ts` for stronger final-response rules.
- Modify: `test/plugin.test.mjs` for plugin enforcement tests.
- Modify: `README.md` for plugin status behavior docs.

## Task 1: Add Status Shape Tests

**Files:**
- Modify: `test/plugin.test.mjs`

- [ ] **Step 1: Add plugin context helper**

Add after `runTransform`:

```js
const createToolContext = (overrides = {}) => ({
  sessionID: overrides.sessionID ?? `session-${Date.now()}-${Math.random()}`,
  directory: overrides.directory ?? process.cwd(),
});
```

- [ ] **Step 2: Add status JSON helper**

Add after `createToolContext`:

```js
const readStatus = async (hooks, context) =>
  JSON.parse(await hooks.tool.rindaman_status.execute({}, context));
```

- [ ] **Step 3: Add final response metadata test**

Add after `exposes Rindaman quality tools`:

```js
test("rindaman_status exposes final response gate metadata", async () => {
  const hooks = await server();
  const context = createToolContext();
  const status = await readStatus(hooks, context);

  assert.equal(status.lastCheck.status, "not_run");
  assert.equal(status.lastCheck.command, null);
  assert.equal(status.lastCheck.checkedAt, null);
  assert.equal(typeof status.finalResponse.allowed, "boolean");
  assert.equal(typeof status.finalResponse.reason, "string");
});
```

- [ ] **Step 4: Run failing plugin tests**

Run: `npm run build && node --test test/plugin.test.mjs`

Expected: FAIL because `lastCheck` and `finalResponse` do not exist yet.

## Task 2: Implement Final Response Gate Metadata

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Add final response types**

Add after `SessionQualityState`:

```ts
type FinalResponseGate = {
  allowed: boolean;
  reason: string;
};
```

- [ ] **Step 2: Add verification requirement helper**

Add after `getSessionState`:

```ts
const isVerificationRequired = (
  resolvedOptions: RindamanResolvedOptions,
  sessionState: SessionQualityState,
) =>
  resolvedOptions.verificationRequired && sessionState.changedFiles.length > 0;
```

- [ ] **Step 3: Add final response evaluator**

Add after `isVerificationRequired`:

```ts
const createFinalResponseGate = (
  resolvedOptions: RindamanResolvedOptions,
  sessionState: SessionQualityState,
): FinalResponseGate => {
  if (!resolvedOptions.enabled) {
    return { allowed: true, reason: "rindaman disabled" };
  }

  if (!resolvedOptions.qualityLifecycle) {
    return { allowed: true, reason: "quality lifecycle disabled" };
  }

  if (!isVerificationRequired(resolvedOptions, sessionState)) {
    return { allowed: true, reason: "verification not required" };
  }

  if (sessionState.lastCheckStatus === "passed") {
    return { allowed: true, reason: "verification passed" };
  }

  if (sessionState.lastCheckStatus === "failed") {
    return { allowed: false, reason: "verification failed" };
  }

  if (sessionState.lastCheckStatus === "error") {
    return { allowed: false, reason: "verification errored" };
  }

  return { allowed: false, reason: "verification pending" };
};
```

- [ ] **Step 4: Update status output shape**

In `createRindamanStatusTool`, compute:

```ts
      const verificationRequired = isVerificationRequired(
        resolvedOptions,
        sessionState,
      );
      const finalResponse = createFinalResponseGate(
        resolvedOptions,
        sessionState,
      );
```

Replace flat `lastCheckAt`, `lastCheckStatus`, `lastCheckCommand`, `lastCheckExitCode` fields with:

```ts
          verificationRequired,
          changedFiles: sessionState.changedFiles,
          lastCheck: {
            status: sessionState.lastCheckStatus ?? "not_run",
            command: sessionState.lastCheckCommand ?? null,
            checkedAt: sessionState.lastCheckAt ?? null,
            exitCode: sessionState.lastCheckExitCode ?? null,
          },
          finalResponse,
```

- [ ] **Step 5: Run plugin tests**

Run: `npm run build && node --test test/plugin.test.mjs`

Expected: status metadata test passes.

## Task 3: Add Dirty Session Gate Tests

**Files:**
- Modify: `test/plugin.test.mjs`

- [ ] **Step 1: Add dirty session test**

Add after status metadata test:

```js
test("dirty session requires verification before final response", async () => {
  const hooks = await server();
  const context = createToolContext();

  await hooks["tool.execute.after"](
    { sessionID: context.sessionID, tool: "edit" },
    { output: "src/example.ts" },
  );

  const status = await readStatus(hooks, context);

  assert.equal(status.verificationRequired, true);
  assert.equal(status.finalResponse.allowed, false);
  assert.equal(status.finalResponse.reason, "verification pending");
  assert.deepEqual(status.changedFiles, ["src/example.ts"]);
});
```

- [ ] **Step 2: Add quality lifecycle bypass test**

```js
test("quality lifecycle disabled allows final response", async () => {
  const hooks = await server({}, { qualityLifecycle: false });
  const context = createToolContext();

  await hooks["tool.execute.after"](
    { sessionID: context.sessionID, tool: "edit" },
    { output: "src/example.ts" },
  );

  const status = await readStatus(hooks, context);

  assert.equal(status.verificationRequired, true);
  assert.equal(status.finalResponse.allowed, true);
  assert.equal(status.finalResponse.reason, "quality lifecycle disabled");
});
```

- [ ] **Step 3: Run plugin tests**

Run: `npm run build && node --test test/plugin.test.mjs`

Expected: dirty and bypass tests pass.

## Task 4: Harden Check Tool Status Updates

**Files:**
- Modify: `src/index.ts`
- Modify: `test/plugin.test.mjs`

- [ ] **Step 1: Add failed check gate test**

Add after dirty session test:

```js
test("failed rindaman_check keeps final response blocked", async () => {
  const hooks = await server();
  const context = createToolContext({ directory: "/path/that/does/not/exist" });

  await hooks.rindaman_check?.execute({ mode: "check", json: true, strict: false, report: false }, context);
  const status = await readStatus(hooks, context);

  assert.equal(status.lastCheck.status, "failed");
  assert.equal(status.finalResponse.allowed, false);
  assert.equal(status.finalResponse.reason, "verification failed");
});
```

- [ ] **Step 2: Add passing check gate test**

Add after failed check test:

```js
test("passing rindaman_check allows final response", async () => {
  const hooks = await server();
  const context = createToolContext();

  await hooks["tool.execute.after"](
    { sessionID: context.sessionID, tool: "edit" },
    { output: "README.md" },
  );
  await hooks.tool.rindaman_check.execute(
    { mode: "doctor", json: true, strict: false, report: false },
    context,
  );
  const status = await readStatus(hooks, context);

  assert.equal(status.lastCheck.status, "passed");
  assert.equal(status.finalResponse.allowed, true);
  assert.equal(status.finalResponse.reason, "verification passed");
});
```

- [ ] **Step 3: Ensure check execution error is marked failed or error**

In `createRindamanCheckTool`, set status:

```ts
      sessionState.lastCheckStatus = result.error
        ? "error"
        : result.status === 0
          ? "passed"
          : "failed";
```

- [ ] **Step 4: Include final response in check output**

After updating session state, compute:

```ts
      const finalResponse = createFinalResponseGate(
        {
          enabled: true,
          strictResponses: true,
          qualityLifecycle: true,
          verificationRequired: true,
        },
        sessionState,
      );
```

Append:

```ts
        "Final response allowed: " + String(finalResponse.allowed),
        "Final response reason: " + finalResponse.reason,
```

- [ ] **Step 5: Run plugin tests**

Run: `npm run build && node --test test/plugin.test.mjs`

Expected: check gate tests pass.

## Task 5: Strengthen Rule Text and Docs

**Files:**
- Modify: `src/rindaman-rule.ts`
- Modify: `README.md`

- [ ] **Step 1: Update final response rule text**

In `src/rindaman-rule.ts`, replace the `Final response:` section with:

```ts
Final response:
- Summarize changed files.
- List verification commands run and results.
- List remaining risks or skipped checks.
- If verification is required and no passing rindaman_check exists, explicitly state verification is pending or failed.
- Do not imply completion when rindaman_status.finalResponse.allowed is false.
```

- [ ] **Step 2: Update README tool docs**

In README near the OpenCode tools section, add:

```md
`rindaman_status` includes `finalResponse.allowed` and `finalResponse.reason` so the assistant can avoid false completion claims when verification is pending or failed.
```

- [ ] **Step 3: Run plugin tests**

Run: `npm run build && node --test test/plugin.test.mjs`

Expected: plugin tests pass.

## Task 6: Final Verification

**Files:**
- All files above.

- [ ] **Step 1: Run build**

Run: `npm run build`

Expected: TypeScript build passes.

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

Expected: only intended plugin enforcement files are modified.
