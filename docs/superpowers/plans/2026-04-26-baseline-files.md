# Baseline Files Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add baseline file generation and baseline-aware debt classification to Rindaman.

**Architecture:** Keep implementation in `bin/rindaman.cjs` by reusing existing check orchestration, loading/writing a v1 baseline JSON file, and feeding baseline metadata into debt classification. Extend `test/cli.test.mjs` with temp fixture tests and document the command/config in `README.md`.

**Tech Stack:** Node.js CommonJS CLI, `node:test`, `node:assert/strict`, JSON files, local fixture tests.

---

## File Structure

- Modify: `bin/rindaman.cjs` for command parsing, config defaults, baseline load/write helpers, JSON output, and help text.
- Modify: `test/cli.test.mjs` for baseline command and baseline classification tests.
- Modify: `README.md` for baseline command, config, JSON output, and behavior docs.

## Task 1: Add Baseline Command Failing Test

**Files:**
- Modify: `test/cli.test.mjs`

- [ ] **Step 1: Import readFileSync**

Change the fs import to:

```js
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
```

- [ ] **Step 2: Add baseline command test**

Add after the formatter failure test:

```js
test("CLI baseline writes failed check names", () => {
  const baselinePath = resolve(
    tmpdir(),
    "rindaman-baseline-command-fixture",
    ".rindaman",
    "baseline.json",
  );
  const fixtureDirectory = writeTemporaryJsonFixture(
    "rindaman-baseline-command-fixture",
    {
      scripts: {
        typecheck: "node -e \"process.exit(1)\"",
      },
      rindaman: {
        checks: {
          semantic: false,
          syntax: false,
          hygiene: false,
        },
      },
    },
  );
  const result = runCli(["baseline", "--json"], fixtureDirectory);

  assert.equal(result.status, 0);
  const output = parseJsonOutput(result);
  const baselineFile = JSON.parse(readFileSync(baselinePath, "utf8"));

  assert.equal(output.command, "baseline");
  assert.equal(output.status, "passed");
  assert.deepEqual(output.baseline.checkNames, ["types"]);
  assert.equal(baselineFile.version, 1);
  assert.deepEqual(baselineFile.checks, ["types"]);
});
```

- [ ] **Step 3: Run failing test**

Run: `npm test -- test/cli.test.mjs`

Expected: FAIL because `baseline` is not a known command.

## Task 2: Implement Baseline Command

**Files:**
- Modify: `bin/rindaman.cjs`

- [ ] **Step 1: Add known command**

Change the command set to include baseline:

```js
const KNOWN_COMMANDS = new Set(["check", "audit", "baseline", "doctor", "help"]);
```

- [ ] **Step 2: Add config defaults**

In `createDefaultConfig()`, add:

```js
    baselinePath: ".rindaman/baseline.json",
    useBaseline: true,
```

- [ ] **Step 3: Add flag overrides**

In `applyFlagOverrides(config)`, add:

```js
    baselinePath: readFlagValue("--baseline-path") ?? config.baselinePath,
    useBaseline: flags.has("--no-baseline") ? false : config.useBaseline,
```

- [ ] **Step 4: Add baseline write helper**

Add before `runCheckCommand`:

```js
function writeBaselineFile(projectRoot, config, checkNames) {
  const baselinePath = path.resolve(projectRoot, config.baselinePath);
  const baselineDirectory = path.dirname(baselinePath);
  const baselineFile = {
    version: 1,
    createdAt: new Date().toISOString(),
    checks: checkNames,
  };

  fs.mkdirSync(baselineDirectory, { recursive: true });
  fs.writeFileSync(baselinePath, `${JSON.stringify(baselineFile, null, 2)}\n`);

  return {
    path: baselinePath,
    found: true,
    used: true,
    checkNames,
  };
}
```

- [ ] **Step 5: Extract failed check names helper**

Add before `writeBaselineFile`:

```js
function getFailedCheckNames(checks) {
  return checks
    .filter((check) => check.status === "failed")
    .map((check) => check.name);
}
```

- [ ] **Step 6: Add baseline command runner**

Add before `runDoctorCommand`:

```js
function runBaselineCommand() {
  const projectRoot = findProjectRoot(process.cwd());
  const config = applyFlagOverrides(readConfig(projectRoot));
  const checkResult = createCheckCommandResult(true, projectRoot, config);
  const baseline = writeBaselineFile(
    projectRoot,
    config,
    getFailedCheckNames(checkResult.checks),
  );
  const result = {
    command: "baseline",
    status: "passed",
    projectRoot,
    baseline,
    checks: checkResult.checks,
  };

  if (jsonOutput) {
    writeJsonResult(result);
  } else {
    printSection("Rindaman Baseline");
    console.log(`[Rindaman] Baseline: ${baseline.path}`);
    console.log(`[Rindaman] Checks: ${baseline.checkNames.join(", ") || "none"}`);
  }

  process.exit(EXIT_OK);
}
```

- [ ] **Step 7: Extract check result creation**

Refactor current `runCheckCommand(auditMode)` by moving all logic before output/exit into a new `createCheckCommandResult(auditMode, projectRoot, config)` function. It must return the same object currently assigned to `result`.

Keep `runCheckCommand(auditMode)` responsible for project root/config creation, printing JSON/human output, and exiting.

- [ ] **Step 8: Dispatch baseline command**

In the bottom command dispatcher, add before doctor:

```js
  if (command === "baseline") {
    runBaselineCommand();
  }
```

- [ ] **Step 9: Run targeted tests**

Run: `npm test -- test/cli.test.mjs`

Expected: baseline command test passes or reveals small integration issues.

## Task 3: Add Baseline Metadata to Check Output

**Files:**
- Modify: `bin/rindaman.cjs`
- Modify: `test/cli.test.mjs`

- [ ] **Step 1: Add missing baseline assertion**

In `CLI check supports fixture-backed JSON output`, after the `output.debt` assertion, add:

```js
  assert.equal(output.baseline.found, false);
  assert.equal(output.baseline.used, false);
  assert.deepEqual(output.baseline.checkNames, []);
```

- [ ] **Step 2: Add baseline load helper**

Add before `createDebtResult`:

```js
function readBaselineFile(projectRoot, config) {
  const baselinePath = path.resolve(projectRoot, config.baselinePath);

  if (!config.useBaseline) {
    return {
      path: baselinePath,
      found: fs.existsSync(baselinePath),
      used: false,
      checkNames: [],
    };
  }

  if (!fs.existsSync(baselinePath)) {
    return {
      path: baselinePath,
      found: false,
      used: false,
      checkNames: [],
    };
  }

  try {
    const baselineFile = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
    const checkNames = Array.isArray(baselineFile.checks)
      ? baselineFile.checks.filter((checkName) => typeof checkName === "string")
      : [];

    return {
      path: baselinePath,
      found: true,
      used: baselineFile.version === 1,
      checkNames: baselineFile.version === 1 ? checkNames : [],
    };
  } catch (_error) {
    return {
      path: baselinePath,
      found: true,
      used: false,
      checkNames: [],
    };
  }
}
```

- [ ] **Step 3: Include baseline in check result**

Inside `createCheckCommandResult`, call:

```js
  const baseline = readBaselineFile(projectRoot, config);
```

Add `baseline` to the returned result object.

- [ ] **Step 4: Run targeted tests**

Run: `npm test -- test/cli.test.mjs`

Expected: pass.

## Task 4: Classify Existing Debt With Baseline

**Files:**
- Modify: `bin/rindaman.cjs`
- Modify: `test/cli.test.mjs`

- [ ] **Step 1: Add baseline-aware classification test**

Add after baseline command test:

```js
test("CLI check classifies baseline failures as existing", () => {
  const fixtureDirectory = writeTemporaryJsonFixture(
    "rindaman-existing-baseline-fixture",
    {
      scripts: {
        typecheck: "node -e \"process.exit(1)\"",
      },
      rindaman: {
        checks: {
          semantic: false,
          syntax: false,
          hygiene: false,
        },
      },
    },
  );
  mkdirSync(resolve(fixtureDirectory, ".rindaman"), { recursive: true });
  writeFileSync(
    resolve(fixtureDirectory, ".rindaman", "baseline.json"),
    `${JSON.stringify({ version: 1, createdAt: "2026-04-26T00:00:00.000Z", checks: ["types"] }, null, 2)}\n`,
  );

  const result = runCli(["check", "--json", "--all"], fixtureDirectory);

  assert.equal(result.status, 0);
  const output = parseJsonOutput(result);

  assert.equal(output.debt.classification, "existing");
  assert.deepEqual(output.debt.existingChecks, ["types"]);
  assert.deepEqual(output.debt.unknownChecks, []);
});
```

- [ ] **Step 2: Update debt classifier signature**

Change `createDebtResult(config, changedOnly, targetFiles, checks)` to:

```js
function createDebtResult(config, changedOnly, targetFiles, checks, baseline) {
```

- [ ] **Step 3: Classify baseline matches as existing**

Replace failed name handling inside `createDebtResult` with:

```js
  const baselineCheckNames = new Set(baseline.used ? baseline.checkNames : []);
  const failedCheckNames = failedChecks.map((check) => check.name);
  const existingCheckNames = failedCheckNames.filter((checkName) =>
    baselineCheckNames.has(checkName),
  );
  const unclassifiedCheckNames = failedCheckNames.filter(
    (checkName) => !baselineCheckNames.has(checkName),
  );

  debtResult.existingChecks = existingCheckNames;

  if (unclassifiedCheckNames.length === 0) {
    debtResult.classification = "existing";
    return debtResult;
  }
```

Then use `unclassifiedCheckNames` instead of `failedCheckNames` for introduced or unknown checks.

- [ ] **Step 4: Pass baseline to classifier**

Update the call to:

```js
  const debt = createDebtResult(config, config.changedOnly, targetFiles, checks, baseline);
```

- [ ] **Step 5: Add mixed classification**

At the end of classification, if existing checks and introduced/unknown checks both exist, set `classification` to `mixed`.

- [ ] **Step 6: Run targeted tests**

Run: `npm test -- test/cli.test.mjs`

Expected: baseline existing test passes.

## Task 5: Existing Debt Exit Policy and Baseline Flags

**Files:**
- Modify: `bin/rindaman.cjs`
- Modify: `test/cli.test.mjs`

- [ ] **Step 1: Add fail-existing test**

Add after existing baseline test:

```js
test("CLI check can fail existing baseline debt", () => {
  const fixtureDirectory = writeTemporaryJsonFixture(
    "rindaman-fail-existing-baseline-fixture",
    {
      scripts: {
        typecheck: "node -e \"process.exit(1)\"",
      },
      rindaman: {
        checks: {
          semantic: false,
          syntax: false,
          hygiene: false,
        },
      },
    },
  );
  mkdirSync(resolve(fixtureDirectory, ".rindaman"), { recursive: true });
  writeFileSync(
    resolve(fixtureDirectory, ".rindaman", "baseline.json"),
    `${JSON.stringify({ version: 1, createdAt: "2026-04-26T00:00:00.000Z", checks: ["types"] }, null, 2)}\n`,
  );

  const result = runCli(
    ["check", "--json", "--all", "--fail-existing"],
    fixtureDirectory,
  );

  assert.equal(result.status, 1);
  const output = parseJsonOutput(result);

  assert.equal(output.status, "failed");
  assert.deepEqual(output.debt.existingChecks, ["types"]);
});
```

- [ ] **Step 2: Add no-baseline test**

Add after fail-existing test:

```js
test("CLI check can ignore an existing baseline", () => {
  const fixtureDirectory = writeTemporaryJsonFixture(
    "rindaman-no-baseline-fixture",
    {
      scripts: {
        typecheck: "node -e \"process.exit(1)\"",
      },
      rindaman: {
        checks: {
          semantic: false,
          syntax: false,
          hygiene: false,
        },
      },
    },
  );
  mkdirSync(resolve(fixtureDirectory, ".rindaman"), { recursive: true });
  writeFileSync(
    resolve(fixtureDirectory, ".rindaman", "baseline.json"),
    `${JSON.stringify({ version: 1, createdAt: "2026-04-26T00:00:00.000Z", checks: ["types"] }, null, 2)}\n`,
  );

  const result = runCli(
    ["check", "--json", "--all", "--no-baseline"],
    fixtureDirectory,
  );

  assert.equal(result.status, 1);
  const output = parseJsonOutput(result);

  assert.equal(output.baseline.found, true);
  assert.equal(output.baseline.used, false);
  assert.deepEqual(output.debt.unknownChecks, ["types"]);
});
```

- [ ] **Step 3: Add invalid baseline JSON test**

Add after no-baseline test:

```js
test("CLI check ignores invalid baseline JSON", () => {
  const fixtureDirectory = writeTemporaryJsonFixture(
    "rindaman-invalid-baseline-fixture",
    {
      rindaman: {
        checks: {
          semantic: false,
          types: false,
          syntax: false,
          hygiene: false,
        },
      },
    },
  );
  mkdirSync(resolve(fixtureDirectory, ".rindaman"), { recursive: true });
  writeFileSync(resolve(fixtureDirectory, ".rindaman", "baseline.json"), "not json\n");

  const result = runCli(["check", "--json"], fixtureDirectory);

  assert.equal(result.status, 0);
  const output = parseJsonOutput(result);

  assert.equal(output.baseline.found, true);
  assert.equal(output.baseline.used, false);
  assert.deepEqual(output.baseline.checkNames, []);
});
```

- [ ] **Step 4: Implement status from debt**

Replace `getOverallStatus(checks, config)` with a version accepting debt:

```js
function getOverallStatus(checks, config, debt) {
  const hasBlockingDebt =
    debt.introducedChecks.length > 0 ||
    debt.unknownChecks.length > 0 ||
    (config.failOnExistingDebt && debt.existingChecks.length > 0);
  const hasSkippedCheck = checks.some((check) => check.status === "skipped");

  if (hasBlockingDebt) {
    return "failed";
  }

  if (config.strictWarnings && hasSkippedCheck) {
    return "failed";
  }

  return "passed";
}
```

- [ ] **Step 5: Update status call**

Call:

```js
  const status = getOverallStatus(checks, config, debt);
```

- [ ] **Step 6: Run targeted tests**

Run: `npm test -- test/cli.test.mjs`

Expected: pass.

## Task 6: Documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add baseline command to command list**

Add:

```bash
rindaman baseline
rindaman baseline --json
```

- [ ] **Step 2: Add baseline JSON field to output list**

Add:

```md
- `baseline`
```

- [ ] **Step 3: Add baseline docs section**

Add after debt classification docs:

```md
### Baseline files

Use `rindaman baseline --json` to record the current failed check names in `.rindaman/baseline.json`.

When baseline use is enabled, failed checks listed in the baseline are classified as existing debt. Existing debt does not block by default; pass `--fail-existing` to block it.
```

- [ ] **Step 4: Update config examples**

Add:

```json
  "baselinePath": ".rindaman/baseline.json",
  "useBaseline": true,
```

- [ ] **Step 5: Add CLI flag examples**

Add:

```bash
rindaman check --json --baseline-path .rindaman/baseline.json
rindaman check --json --no-baseline
```

## Task 7: Final Verification

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

Expected: only intended baseline files are modified.
