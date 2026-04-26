# Debt Classification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CLI-level debt classification so Rindaman reports introduced, existing, and unknown failures without persistent baselines.

**Architecture:** Implement a small classifier inside `bin/rindaman.cjs` after check execution and before status calculation. Extend fixture-backed CLI tests in `test/cli.test.mjs`; avoid semantic engine rewrites.

**Tech Stack:** Node.js CommonJS CLI, `node:test`, `node:assert/strict`, `spawnSync`, JSON CLI contracts.

---

## File Structure

- Modify: `bin/rindaman.cjs` for config defaults, flag parsing, debt classification, status policy, JSON output, and help text.
- Modify: `test/cli.test.mjs` for JSON shape, classification, audit, config precedence, and invalid flag tests.
- Create: `test/fixtures/debt-config/package.json` for package-level debt config.
- Create: `test/fixtures/debt-config/.rindamanrc.json` for file-level debt config override.
- Modify: `README.md` to document the `debt` JSON section and new flags/config keys.

## Task 1: Add Debt JSON Shape Regression

**Files:**
- Modify: `test/cli.test.mjs`

- [ ] **Step 1: Add assertions to existing fixture-backed JSON test**

Inside `test("CLI check supports fixture-backed JSON output", ...)`, after the existing `output.projectRoot` assertion, add:

```js
  assert.deepEqual(output.debt, {
    mode: "changed-only",
    classification: "none",
    introducedChecks: [],
    existingChecks: [],
    unknownChecks: [],
  });
```

This test should fail before implementation because `output.debt` does not exist.

- [ ] **Step 2: Run targeted test**

Run: `npm test -- test/cli.test.mjs`

Expected: FAIL with an assertion showing `output.debt` is `undefined`.

## Task 2: Implement Debt Config Defaults and JSON Shape

**Files:**
- Modify: `bin/rindaman.cjs`

- [ ] **Step 1: Extend default config**

In `createDefaultConfig()`, add:

```js
    debtMode: "changed-only",
    failOnExistingDebt: false,
```

- [ ] **Step 2: Add flag value validation helper**

Add near `readFlagValue`:

```js
function readDebtModeFlag() {
  const debtMode = readFlagValue("--debt-mode");

  if (!debtMode) {
    return undefined;
  }

  if (!["changed-only", "all"].includes(debtMode)) {
    throw new Error(`Invalid --debt-mode value: ${debtMode}`);
  }

  return debtMode;
}
```

- [ ] **Step 3: Apply flag overrides**

In `applyFlagOverrides(config)`, add:

```js
    debtMode: readDebtModeFlag() ?? config.debtMode,
    failOnExistingDebt: flags.has("--fail-existing")
      ? true
      : config.failOnExistingDebt,
```

- [ ] **Step 4: Implement empty debt classifier**

Add before `getOverallStatus`:

```js
function createDebtResult(config, changedOnly, targetFiles, checks) {
  const failedChecks = checks.filter((check) => check.status === "failed");
  const debtResult = {
    mode: config.debtMode,
    classification: "none",
    introducedChecks: [],
    existingChecks: [],
    unknownChecks: [],
  };

  if (failedChecks.length === 0) {
    return debtResult;
  }

  const failedCheckNames = failedChecks.map((check) => check.name);

  if (config.debtMode === "changed-only" && changedOnly && targetFiles.length > 0) {
    debtResult.introducedChecks = failedCheckNames;
    debtResult.classification = "introduced";
    return debtResult;
  }

  debtResult.unknownChecks = failedCheckNames;
  debtResult.classification = "unknown";
  return debtResult;
}
```

- [ ] **Step 5: Include debt in result**

In `runCheckCommand`, after checks are collected and before `status`, add:

```js
  const debt = createDebtResult(config, config.changedOnly, targetFiles, checks);
```

Then add `debt` to the `result` object after `checks`.

- [ ] **Step 6: Run targeted tests**

Run: `npm test -- test/cli.test.mjs`

Expected: tests pass or reveal only status-policy gaps handled in later tasks.

## Task 3: Add Classification Tests

**Files:**
- Modify: `test/cli.test.mjs`

- [ ] **Step 1: Add introduced classification assertion**

In `test("CLI check reports typecheck script failures", ...)`, after `assert.equal(output.status, "failed");`, add:

```js
  assert.equal(output.debt.classification, "introduced");
  assert.deepEqual(output.debt.introducedChecks, ["types"]);
  assert.deepEqual(output.debt.unknownChecks, []);
```

- [ ] **Step 2: Add unknown classification assertion**

In `test("CLI check reports formatter failures", ...)`, after `assert.equal(output.status, "failed");`, add:

```js
  assert.equal(output.debt.classification, "unknown");
  assert.deepEqual(output.debt.introducedChecks, []);
  assert.deepEqual(output.debt.unknownChecks, ["syntax"]);
```

- [ ] **Step 3: Add audit non-blocking unknown debt test**

Add after formatter failure test:

```js
test("CLI audit reports unknown debt without failing", () => {
  const result = runCli(
    ["audit", "--json", "--all"],
    formatterFailureFixtureDirectory,
  );

  assert.equal(result.status, 0);
  const output = parseJsonOutput(result);

  assert.equal(output.command, "audit");
  assert.equal(output.status, "audit_failed");
  assert.equal(output.debt.classification, "unknown");
  assert.deepEqual(output.debt.unknownChecks, ["syntax"]);
});
```

- [ ] **Step 4: Run targeted tests**

Run: `npm test -- test/cli.test.mjs`

Expected: introduced classification may fail if the fixture has no changed target file; Task 4 fixes that deliberately.

## Task 4: Make Introduced Classification Deterministic

**Files:**
- Modify: `test/cli.test.mjs`

- [ ] **Step 1: Add helper to create changed target fixture**

Add after `writeTemporaryJsonFixture`:

```js
function writeTemporaryChangedFileFixture(directoryName, packageJson) {
  const temporaryDirectory = writeTemporaryJsonFixture(directoryName, packageJson);

  writeFileSync(resolve(temporaryDirectory, "changed.js"), "const changed = true;\n");

  return temporaryDirectory;
}
```

- [ ] **Step 2: Update typecheck failure test to use temp changed fixture**

Replace the fixture directory in `CLI check reports typecheck script failures` with:

```js
  const fixtureDirectory = writeTemporaryChangedFileFixture(
    "rindaman-typecheck-introduced-fixture",
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
  const result = runCli(
    ["check", "--json", "changed.js"],
    fixtureDirectory,
  );
```

- [ ] **Step 3: Run targeted tests**

Run: `npm test -- test/cli.test.mjs`

Expected: introduced and unknown classification tests pass.

## Task 5: Add Config and Flag Precedence Tests

**Files:**
- Create: `test/fixtures/debt-config/package.json`
- Create: `test/fixtures/debt-config/.rindamanrc.json`
- Modify: `test/cli.test.mjs`

- [ ] **Step 1: Create debt config package fixture**

`test/fixtures/debt-config/package.json`:

```json
{
  "rindaman": {
    "debtMode": "all",
    "failOnExistingDebt": false,
    "checks": {
      "semantic": false,
      "types": false,
      "syntax": false,
      "hygiene": false
    }
  }
}
```

- [ ] **Step 2: Create debt config file override**

`test/fixtures/debt-config/.rindamanrc.json`:

```json
{
  "debtMode": "changed-only",
  "failOnExistingDebt": false
}
```

- [ ] **Step 3: Add fixture path constant**

Add near the other fixture constants:

```js
const debtConfigFixtureDirectory = resolve(
  testDirectory,
  "fixtures",
  "debt-config",
);
```

- [ ] **Step 4: Add debt config precedence test**

Add near the existing config precedence test:

```js
test("CLI debt config precedence applies package, file, then flags", () => {
  const result = runCli(
    ["check", "--json", "--debt-mode", "all", "--fail-existing"],
    debtConfigFixtureDirectory,
  );

  assert.equal(result.status, 0);
  const output = parseJsonOutput(result);

  assert.equal(output.debt.mode, "all");
  assert.equal(output.policy.failOnExistingDebt, true);
});
```

- [ ] **Step 5: Run targeted tests**

Run: `npm test -- test/cli.test.mjs`

Expected: pass after policy output includes `failOnExistingDebt`.

## Task 6: Implement Policy Output and Invalid Flag Handling

**Files:**
- Modify: `bin/rindaman.cjs`
- Modify: `test/cli.test.mjs`

- [ ] **Step 1: Add failOnExistingDebt to policy output**

In the `policy` object, add:

```js
      debtMode: config.debtMode,
      failOnExistingDebt: config.failOnExistingDebt,
```

- [ ] **Step 2: Add invalid debt mode test**

Add near CLI argument tests:

```js
test("CLI rejects invalid debt mode with JSON error", () => {
  const result = runCli(
    ["check", "--json", "--debt-mode", "invalid"],
    minimalFixtureDirectory,
  );

  assert.equal(result.status, 2);
  const output = parseJsonOutput(result);

  assert.equal(output.status, "error");
  assert.match(output.error, /Invalid --debt-mode value: invalid/);
});
```

- [ ] **Step 3: Run targeted tests**

Run: `npm test -- test/cli.test.mjs`

Expected: pass.

## Task 7: Document Debt Classification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update JSON output fields**

In the JSON result field list, add:

```md
- `debt`
```

- [ ] **Step 2: Add debt classification section**

After the JSON output section, add:

```md
### Debt classification

Rindaman reports failed checks in a `debt` object:

- `introducedChecks` — failures tied to changed target files
- `existingChecks` — reserved for baseline-aware classification
- `unknownChecks` — failures that cannot be safely tied to changed files

By default, `check` blocks introduced and unknown debt. `audit` reports the same classification but exits successfully.
```

- [ ] **Step 3: Update config examples**

Add to both config examples:

```json
  "debtMode": "changed-only",
  "failOnExistingDebt": false,
```

- [ ] **Step 4: Update CLI flags docs**

Add to the CLI flag example or options docs:

```bash
rindaman check --json --debt-mode changed-only
rindaman check --json --fail-existing
```

## Task 8: Final Verification

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

Expected: only intended debt-classification files are modified.
