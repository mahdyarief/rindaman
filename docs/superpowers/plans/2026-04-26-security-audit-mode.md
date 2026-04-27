# Security Audit Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only security audit check to Rindaman that surfaces vulnerability severity counts and can block by policy.

**Architecture:** Extend the modular CLI by adding security audit execution to `src/cli/check-runner.cjs` and policy evaluation to `src/cli/policy.cjs`. Reuse existing CLI result assembly and fixture-backed tests rather than introducing a new command surface.

**Tech Stack:** Node.js CommonJS CLI, `npm audit --json`, Node `node:test`, existing modular CLI helpers.

---

## File Structure

- Modify: `src/cli/config.cjs` for security config defaults and override merging.
- Modify: `src/cli/check-runner.cjs` for `npm audit --json` execution and normalized severity summaries.
- Modify: `src/cli/policy.cjs` for security severity blocking rules.
- Modify: `bin/rindaman.cjs` only if output wiring needs the new security check summary.
- Modify: `test/cli.test.mjs` for security audit tests.
- Modify: `README.md` for configuration and behavior docs.

## Task 1: Add Security Config Defaults

**Files:**
- Modify: `src/cli/config.cjs`

- [ ] **Step 1: Extend default config**

In `createDefaultConfig()`, add:

```js
    security: {
      failOnModerate: false,
      failOnHigh: true,
      failOnCritical: true,
    },
```

and extend checks with:

```js
      security: true,
```

- [ ] **Step 2: Merge nested security config**

In both `readConfig()` and `readWorkspaceConfig()`, merge the nested `security` object like the existing `checks` object:

```js
    security: {
      ...defaultConfig.security,
      ...(packageConfig.security ?? {}),
      ...(fileConfig.security ?? {}),
    },
```

and in `readWorkspaceConfig()` use `rootConfig.security` as the base.

- [ ] **Step 3: Run type-safe regression check**

Run: `npm test -- test/cli.test.mjs`

Expected: existing tests continue passing.

## Task 2: Add Security Check Failing Tests

**Files:**
- Modify: `test/cli.test.mjs`

- [ ] **Step 1: Add audit output helper**

Add after `findCheck`:

```js
function findSecurityCheck(output) {
  return findCheck(output, "security");
}
```

- [ ] **Step 2: Add skipped security test**

Add near the other CLI tests:

```js
test("CLI security check skips when no lockfile exists", () => {
  const fixtureDirectory = writeTemporaryJsonFixture(
    "rindaman-security-skip-fixture",
    {
      rindaman: {
        checks: {
          semantic: false,
          types: false,
          syntax: false,
          hygiene: false,
          security: true,
        },
      },
    },
  );
  const result = runCli(["check", "--json", "--all"], fixtureDirectory);

  assert.equal(result.status, 0);
  const output = parseJsonOutput(result);
  const securityCheck = findSecurityCheck(output);

  assert.equal(securityCheck.status, "skipped");
  assert.match(securityCheck.reason, /lockfile not found/i);
});
```

- [ ] **Step 3: Add normalized severity fixture test**

Add:

```js
test("CLI security check summarizes severity counts", () => {
  const fixtureDirectory = writeTemporaryJsonFixture(
    "rindaman-security-summary-fixture",
    {
      rindaman: {
        checks: {
          semantic: false,
          types: false,
          syntax: false,
          hygiene: false,
          security: true,
        },
      },
    },
  );
  writeFileSync(resolve(fixtureDirectory, "package-lock.json"), "{}\n");
  writeFileSync(
    resolve(fixtureDirectory, "npm.cmd"),
    [
      "@echo off",
      "if \"%1\"==\"audit\" (",
      "  if \"%2\"==\"--json\" (",
      "    <nul set /p=^{\"metadata\":{\"vulnerabilities\":{\"info\":0,\"low\":0,\"moderate\":2,\"high\":1,\"critical\":0}}^}",
      "    exit /b 1",
      "  )",
      ")",
      "exit /b 0",
      "",
    ].join("\r\n"),
  );
  const result = runCli(["check", "--json", "--all"], fixtureDirectory);

  const output = parseJsonOutput(result);
  const securityCheck = findSecurityCheck(output);

  assert.equal(securityCheck.status, "failed");
  assert.deepEqual(securityCheck.summary, {
    moderate: 2,
    high: 1,
    critical: 0,
  });
});
```

- [ ] **Step 4: Run tests to see failure shape**

Run: `npm test -- test/cli.test.mjs`

Expected: FAIL because the security check does not exist yet.

## Task 3: Implement Security Check Runner

**Files:**
- Modify: `src/cli/check-runner.cjs`

- [ ] **Step 1: Add audit availability helper**

Add near the lockfile helpers:

```js
function hasSupportedAuditLockfile(projectRoot) {
  return fs.existsSync(path.join(projectRoot, "package-lock.json"));
}
```

- [ ] **Step 2: Add audit summary parser**

Add:

```js
function readAuditSummary(auditOutput) {
  const parsedAudit = JSON.parse(auditOutput);
  const vulnerabilities = parsedAudit?.metadata?.vulnerabilities ?? {};

  return {
    moderate: Number(vulnerabilities.moderate ?? 0),
    high: Number(vulnerabilities.high ?? 0),
    critical: Number(vulnerabilities.critical ?? 0),
  };
}
```

- [ ] **Step 3: Add security runner**

Add:

```js
function runSecurityCheck(projectRoot, inherit) {
  if (!hasSupportedAuditLockfile(projectRoot)) {
    return {
      status: "skipped",
      severity: "warning",
      command: "npm audit --json",
      reason: "lockfile not found",
      exitCode: null,
      durationMs: 0,
      summary: {
        moderate: 0,
        high: 0,
        critical: 0,
      },
    };
  }

  const executedCommand = executeCommand("npm", ["audit", "--json"], {
    cwd: projectRoot,
    inherit,
  });

  try {
    const summary = readAuditSummary(executedCommand.result.stdout ?? "{}");
    return {
      status:
        summary.moderate > 0 || summary.high > 0 || summary.critical > 0
          ? "failed"
          : "passed",
      severity: "blocker",
      command: executedCommand.command,
      reason: null,
      exitCode: executedCommand.result.status,
      durationMs: executedCommand.durationMs,
      stdout: executedCommand.result.stdout ?? "",
      stderr: executedCommand.result.stderr ?? "",
      summary,
    };
  } catch (_error) {
    return {
      status: "failed",
      severity: "blocker",
      command: executedCommand.command,
      reason: "invalid audit output",
      exitCode: executedCommand.result.status,
      durationMs: executedCommand.durationMs,
      stdout: executedCommand.result.stdout ?? "",
      stderr: executedCommand.result.stderr ?? "",
      summary: {
        moderate: 0,
        high: 0,
        critical: 0,
      },
    };
  }
}
```

- [ ] **Step 4: Extend check result serializer**

In `createCheckResult`, include:

```js
    summary: checkResult.summary ?? undefined,
```

- [ ] **Step 5: Add security check into result assembly**

In `createCheckCommandResult`, after hygiene, add:

```js
  if (config.checks.security) {
    checks.push(
      createCheckResult(
        "security",
        runSecurityCheck(executionRoot, inheritOutput),
        cliArgs.flags,
      ),
    );
  } else {
    checks.push(createSkippedCheck("security", "Disabled by config", "info"));
  }
```

- [ ] **Step 6: Export the new helpers only if needed**

Only export `runSecurityCheck` or `readAuditSummary` if another file requires them.

- [ ] **Step 7: Run tests**

Run: `npm test -- test/cli.test.mjs`

Expected: security check tests pass or reveal policy gaps.

## Task 4: Apply Security Blocking Policy

**Files:**
- Modify: `src/cli/policy.cjs`
- Modify: `test/cli.test.mjs`

- [ ] **Step 1: Add moderate-only non-blocking test**

Add:

```js
test("CLI security check does not block on moderate-only by default", () => {
  const fixtureDirectory = writeTemporaryJsonFixture(
    "rindaman-security-moderate-fixture",
    {
      rindaman: {
        checks: {
          semantic: false,
          types: false,
          syntax: false,
          hygiene: false,
          security: true,
        },
      },
    },
  );
  writeFileSync(resolve(fixtureDirectory, "package-lock.json"), "{}\n");
  writeFileSync(
    resolve(fixtureDirectory, "npm.cmd"),
    [
      "@echo off",
      "if \"%1\"==\"audit\" (",
      "  if \"%2\"==\"--json\" (",
      "    <nul set /p=^{\"metadata\":{\"vulnerabilities\":{\"info\":0,\"low\":0,\"moderate\":2,\"high\":0,\"critical\":0}}^}",
      "    exit /b 1",
      "  )",
      ")",
      "exit /b 0",
      "",
    ].join("\r\n"),
  );

  const result = runCli(["check", "--json", "--all"], fixtureDirectory);
  const output = parseJsonOutput(result);

  assert.equal(result.status, 0);
  assert.equal(output.status, "passed");
});
```

- [ ] **Step 2: Add failOnModerate override test**

Add:

```js
test("CLI security config can block on moderate vulnerabilities", () => {
  const fixtureDirectory = writeTemporaryJsonFixture(
    "rindaman-security-fail-moderate-fixture",
    {
      rindaman: {
        checks: {
          semantic: false,
          types: false,
          syntax: false,
          hygiene: false,
          security: true,
        },
        security: {
          failOnModerate: true,
          failOnHigh: true,
          failOnCritical: true,
        },
      },
    },
  );
  writeFileSync(resolve(fixtureDirectory, "package-lock.json"), "{}\n");
  writeFileSync(
    resolve(fixtureDirectory, "npm.cmd"),
    [
      "@echo off",
      "if \"%1\"==\"audit\" (",
      "  if \"%2\"==\"--json\" (",
      "    <nul set /p=^{\"metadata\":{\"vulnerabilities\":{\"info\":0,\"low\":0,\"moderate\":1,\"high\":0,\"critical\":0}}^}",
      "    exit /b 1",
      "  )",
      ")",
      "exit /b 0",
      "",
    ].join("\r\n"),
  );

  const result = runCli(["check", "--json", "--all"], fixtureDirectory);

  assert.equal(result.status, 1);
  const output = parseJsonOutput(result);
  assert.equal(output.status, "failed");
});
```

- [ ] **Step 3: Extend policy evaluation**

In `getOverallStatus`, detect the security check:

```js
  const securityCheck = checks.find((check) => check.name === "security");
  const securitySummary = securityCheck?.summary ?? {
    moderate: 0,
    high: 0,
    critical: 0,
  };
  const hasBlockingSecurity =
    (config.security.failOnModerate && securitySummary.moderate > 0) ||
    (config.security.failOnHigh && securitySummary.high > 0) ||
    (config.security.failOnCritical && securitySummary.critical > 0);
```

Then block before skipped-check logic:

```js
  if (hasBlockingDebt || hasBlockingSecurity) {
    return "failed";
  }
```

- [ ] **Step 4: Run tests**

Run: `npm test -- test/cli.test.mjs`

Expected: policy tests pass.

## Task 5: Document Security Audit Mode

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add security check to config examples**

In both config examples, add:

```json
  "checks": {
    "security": true
  },
  "security": {
    "failOnModerate": false,
    "failOnHigh": true,
    "failOnCritical": true
  }
```

- [ ] **Step 2: Add security audit section**

Add a short section after baseline docs:

```md
### Security audit

Rindaman can run `npm audit --json` as a read-only security check when `package-lock.json` is present.

By default, high and critical vulnerabilities block `check`, while moderate vulnerabilities are reported without blocking.
```

- [ ] **Step 3: Add JSON summary note**

Add that the `security` check includes a `summary` object with `moderate`, `high`, and `critical` counts.

- [ ] **Step 4: Run tests**

Run: `npm test -- test/cli.test.mjs`

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

Expected: only intended security-audit files are modified.
