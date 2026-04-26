# CLI Fixture Test Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic CLI fixture coverage for Rindaman setup and failure modes.

**Architecture:** Keep tests in `test/cli.test.mjs` and add minimal fixtures under `test/fixtures/`. Production CLI changes are allowed only where tests expose broken or ambiguous behavior.

**Tech Stack:** Node.js, `node:test`, `node:assert/strict`, `spawnSync`, Rindaman CLI JSON output.

---

## File Structure

- Modify: `test/cli.test.mjs` to add helper functions and fixture-backed tests.
- Create: `test/fixtures/typecheck-failure/package.json` for a failing `typecheck` script.
- Create: `test/fixtures/formatter-failure/package.json` with syntax disabled except formatter.
- Create: `test/fixtures/formatter-failure/.prettierrc.json` to activate Prettier detection.
- Create: `test/fixtures/formatter-failure/node_modules/.bin/prettier.cmd` on Windows-compatible fixture path for local binary detection.
- Create: `test/fixtures/formatter-failure/node_modules/.bin/prettier` for POSIX-compatible fixture path.
- Create: `test/fixtures/missing-package/.gitkeep` so the fixture directory is tracked.
- Create: `test/fixtures/no-git-project/package.json` for a package outside git metadata assumptions.
- Create: `test/fixtures/config-precedence/package.json` with package-level Rindaman config.
- Create: `test/fixtures/config-precedence/.rindamanrc.json` with file-level override.
- Modify: `bin/rindaman.cjs` only if needed to make missing `package.json` and no-git cases deterministic.

## Task 1: Add Test Helpers

**Files:**
- Modify: `test/cli.test.mjs`

- [ ] **Step 1: Add helper functions**

Add these functions after the fixture path constants:

```js
function runCli(args, cwd) {
  return spawnSync("node", [cliPath, ...args], {
    cwd,
    encoding: "utf8",
  });
}

function parseJsonOutput(result) {
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
}

function findCheck(output, name) {
  return output.checks.find((check) => check.name === name);
}
```

- [ ] **Step 2: Update existing tests to use helpers**

Replace direct `spawnSync` calls in the first three tests with `runCli` and `parseJsonOutput` where JSON is parsed.

- [ ] **Step 3: Run existing CLI tests**

Run: `npm test -- test/cli.test.mjs`

Expected: existing tests pass.

## Task 2: Add Typecheck Failure Fixture Test

**Files:**
- Create: `test/fixtures/typecheck-failure/package.json`
- Modify: `test/cli.test.mjs`

- [ ] **Step 1: Create fixture package**

```json
{
  "scripts": {
    "typecheck": "node -e \"process.exit(1)\""
  },
  "rindaman": {
    "checks": {
      "semantic": false,
      "syntax": false,
      "hygiene": false
    }
  }
}
```

- [ ] **Step 2: Write failing test**

Add fixture path constant:

```js
const typecheckFailureFixtureDirectory = resolve(
  testDirectory,
  "fixtures",
  "typecheck-failure",
);
```

Add test:

```js
test("CLI check reports typecheck script failures", () => {
  const result = runCli(["check", "--json"], typecheckFailureFixtureDirectory);

  assert.equal(result.status, 1);
  const output = parseJsonOutput(result);
  const typeCheck = findCheck(output, "types");

  assert.equal(output.status, "failed");
  assert.equal(typeCheck.status, "failed");
  assert.equal(typeCheck.exitCode, 1);
});
```

- [ ] **Step 3: Run test**

Run: `npm test -- test/cli.test.mjs`

Expected: pass or reveal CLI issue to fix minimally.

## Task 3: Add Formatter Failure Fixture Test

**Files:**
- Create: `test/fixtures/formatter-failure/package.json`
- Create: `test/fixtures/formatter-failure/.prettierrc.json`
- Create: `test/fixtures/formatter-failure/node_modules/.bin/prettier.cmd`
- Create: `test/fixtures/formatter-failure/node_modules/.bin/prettier`
- Modify: `test/cli.test.mjs`

- [ ] **Step 1: Create formatter fixture package**

```json
{
  "rindaman": {
    "checks": {
      "semantic": false,
      "types": false,
      "hygiene": false
    }
  }
}
```

- [ ] **Step 2: Create Prettier config**

```json
{}
```

- [ ] **Step 3: Create local Prettier failure binaries**

Windows `prettier.cmd`:

```bat
@echo off
exit /b 1
```

POSIX `prettier`:

```sh
#!/bin/sh
exit 1
```

- [ ] **Step 4: Write formatter failure test**

Add fixture path constant:

```js
const formatterFailureFixtureDirectory = resolve(
  testDirectory,
  "fixtures",
  "formatter-failure",
);
```

Add test:

```js
test("CLI check reports formatter failures", () => {
  const result = runCli(["check", "--json", "--all"], formatterFailureFixtureDirectory);

  assert.equal(result.status, 1);
  const output = parseJsonOutput(result);
  const syntaxCheck = findCheck(output, "syntax");

  assert.equal(output.status, "failed");
  assert.equal(output.formatter, "prettier");
  assert.equal(syntaxCheck.status, "failed");
  assert.equal(syntaxCheck.exitCode, 1);
});
```

- [ ] **Step 5: Run test**

Run: `npm test -- test/cli.test.mjs`

Expected: pass or reveal CLI issue to fix minimally.

## Task 4: Add Missing Package and No-Git Tests

**Files:**
- Create: `test/fixtures/missing-package/.gitkeep`
- Create: `test/fixtures/no-git-project/package.json`
- Modify: `test/cli.test.mjs`
- Modify: `bin/rindaman.cjs` only if no-git detection crashes or misreports.

- [ ] **Step 1: Create no-git fixture package**

```json
{
  "rindaman": {
    "checks": {
      "semantic": false,
      "types": false,
      "syntax": false,
      "hygiene": false
    }
  }
}
```

- [ ] **Step 2: Add fixture path constants**

```js
const missingPackageFixtureDirectory = resolve(
  testDirectory,
  "fixtures",
  "missing-package",
);
const noGitFixtureDirectory = resolve(testDirectory, "fixtures", "no-git-project");
```

- [ ] **Step 3: Write missing package doctor test**

```js
test("CLI doctor reports missing package.json", () => {
  const result = runCli(["doctor", "--json"], missingPackageFixtureDirectory);

  assert.equal(result.status, 3);
  const output = parseJsonOutput(result);
  const packageCheck = findCheck(output, "package_json");

  assert.equal(output.status, "failed");
  assert.equal(packageCheck.status, "failed");
});
```

- [ ] **Step 4: Write no-git check test**

```js
test("CLI check does not crash outside a git repo", () => {
  const result = runCli(["check", "--json"], noGitFixtureDirectory);

  assert.equal(result.status, 0);
  const output = parseJsonOutput(result);

  assert.equal(output.command, "check");
  assert.equal(output.status, "passed");
  assert.deepEqual(output.changedFiles, []);
});
```

- [ ] **Step 5: Run tests**

Run: `npm test -- test/cli.test.mjs`

Expected: pass or reveal CLI issue to fix minimally.

## Task 5: Add Skipped Tool and Strict Warning Tests

**Files:**
- Modify: `test/cli.test.mjs`

- [ ] **Step 1: Write skipped tool default warning test**

Use the existing `minimal-project` fixture:

```js
test("CLI check treats skipped local tools as warnings by default", () => {
  const result = runCli(["check", "--json"], minimalFixtureDirectory);

  assert.equal(result.status, 0);
  const output = parseJsonOutput(result);

  assert.equal(output.status, "passed");
  assert.deepEqual(
    output.checks.map((check) => check.status),
    ["skipped", "skipped", "skipped", "skipped"],
  );
  assert.deepEqual(
    output.checks.map((check) => check.severity),
    ["warning", "warning", "warning", "warning"],
  );
});
```

- [ ] **Step 2: Write strict skipped warning test**

```js
test("CLI strict mode treats skipped checks as failures", () => {
  const result = runCli(["check", "--json", "--strict"], minimalFixtureDirectory);

  assert.equal(result.status, 1);
  const output = parseJsonOutput(result);

  assert.equal(output.status, "failed");
  assert.equal(output.policy.strictWarnings, true);
});
```

- [ ] **Step 3: Run tests**

Run: `npm test -- test/cli.test.mjs`

Expected: pass.

## Task 6: Add Config Precedence Test

**Files:**
- Create: `test/fixtures/config-precedence/package.json`
- Create: `test/fixtures/config-precedence/.rindamanrc.json`
- Modify: `test/cli.test.mjs`

- [ ] **Step 1: Create package-level config fixture**

```json
{
  "rindaman": {
    "changedOnly": false,
    "strictWarnings": false,
    "reportPath": ".rindaman/from-package.md",
    "ignorePatterns": ["package-ignore/**"],
    "checks": {
      "semantic": false,
      "types": true,
      "syntax": true,
      "hygiene": true
    }
  }
}
```

- [ ] **Step 2: Create file-level config override**

```json
{
  "changedOnly": true,
  "strictWarnings": false,
  "reportPath": ".rindaman/from-file.md",
  "ignorePatterns": ["file-ignore/**"],
  "checks": {
    "types": false,
    "syntax": false,
    "hygiene": false
  }
}
```

- [ ] **Step 3: Write config precedence test**

Add fixture path constant:

```js
const configPrecedenceFixtureDirectory = resolve(
  testDirectory,
  "fixtures",
  "config-precedence",
);
```

Add test:

```js
test("CLI config precedence applies defaults, package config, file config, then flags", () => {
  const result = runCli(
    ["check", "--json", "--all", "--strict", "--report-path", ".rindaman/from-flag.md"],
    configPrecedenceFixtureDirectory,
  );

  assert.equal(result.status, 1);
  const output = parseJsonOutput(result);
  const semanticCheck = findCheck(output, "semantic");
  const typesCheck = findCheck(output, "types");

  assert.equal(output.changedOnly, false);
  assert.equal(output.policy.strictWarnings, true);
  assert.equal(output.reportPath, null);
  assert.deepEqual(output.policy.ignorePatterns, ["file-ignore/**"]);
  assert.equal(semanticCheck.status, "skipped");
  assert.equal(semanticCheck.severity, "info");
  assert.equal(typesCheck.status, "skipped");
  assert.equal(typesCheck.reason, "Disabled by config");
});
```

- [ ] **Step 4: Run tests**

Run: `npm test -- test/cli.test.mjs`

Expected: pass.

## Task 7: Final Verification

**Files:**
- No new files unless prior tasks exposed a required CLI fix.

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

Expected: package dry-run succeeds and includes expected project files.

- [ ] **Step 5: Inspect git status**

Run: `git status --short`

Expected: only intended fixture, test, plan, and possible CLI files are modified.
