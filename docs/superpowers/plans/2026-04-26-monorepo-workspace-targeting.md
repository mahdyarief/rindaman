# Monorepo Workspace Targeting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add workspace-aware check and baseline execution for simple npm/pnpm monorepos.

**Architecture:** Keep v1 in `bin/rindaman.cjs`, adding helpers for workspace discovery, selection, config merging, and aggregate results. Extend CLI fixture tests with a small monorepo fixture and document the new flags.

**Tech Stack:** Node.js CommonJS CLI, `node:test`, JSON fixture tests, npm/pnpm workspace metadata.

---

## File Structure

- Modify: `bin/rindaman.cjs` for workspace flags, discovery, config merging, command dispatch, and aggregate JSON output.
- Modify: `test/cli.test.mjs` for workspace selection, aggregation, config, baseline, and error tests.
- Create: `test/fixtures/monorepo-project/package.json` as the monorepo root.
- Create: `test/fixtures/monorepo-project/apps/web/package.json` as one workspace.
- Create: `test/fixtures/monorepo-project/packages/api/package.json` as another workspace.
- Create: `test/fixtures/monorepo-project/packages/api/.rindamanrc.json` for workspace config override.
- Modify: `README.md` for workspace flags and JSON output.

## Task 1: Add Monorepo Fixture and Missing Workspace Test

**Files:**
- Modify: `test/cli.test.mjs`
- Create: `test/fixtures/monorepo-project/package.json`
- Create: `test/fixtures/monorepo-project/apps/web/package.json`
- Create: `test/fixtures/monorepo-project/packages/api/package.json`
- Create: `test/fixtures/monorepo-project/packages/api/.rindamanrc.json`

- [ ] **Step 1: Create monorepo root fixture**

`test/fixtures/monorepo-project/package.json`:

```json
{
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
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

- [ ] **Step 2: Create web workspace fixture**

`test/fixtures/monorepo-project/apps/web/package.json`:

```json
{
  "name": "@rindaman/web",
  "private": true,
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

- [ ] **Step 3: Create API workspace fixture**

`test/fixtures/monorepo-project/packages/api/package.json`:

```json
{
  "name": "@rindaman/api",
  "private": true,
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

- [ ] **Step 4: Create API workspace config override**

`test/fixtures/monorepo-project/packages/api/.rindamanrc.json`:

```json
{
  "debtMode": "all"
}
```

- [ ] **Step 5: Add fixture path constant**

Add near other fixture constants:

```js
const monorepoFixtureDirectory = resolve(
  testDirectory,
  "fixtures",
  "monorepo-project",
);
```

- [ ] **Step 6: Add missing workspace JSON error test**

Add near CLI argument tests:

```js
test("CLI rejects missing workspace target with JSON error", () => {
  const result = runCli(
    ["check", "--json", "--workspace", "missing"],
    monorepoFixtureDirectory,
  );

  assert.equal(result.status, 2);
  const output = parseJsonOutput(result);

  assert.equal(output.status, "error");
  assert.match(output.error, /Workspace not found: missing/);
});
```

- [ ] **Step 7: Run failing test**

Run: `npm test -- test/cli.test.mjs`

Expected: FAIL because `--workspace` is not implemented.

## Task 2: Implement Workspace Discovery and Selection

**Files:**
- Modify: `bin/rindaman.cjs`

- [ ] **Step 1: Include workspace flags in value flags**

In `getExplicitTargetFiles`, add `--workspace` to `flagsWithValues`.

- [ ] **Step 2: Add workspace flag readers**

Add near `readDebtModeFlag`:

```js
function readWorkspaceTarget() {
  return readFlagValue("--workspace");
}

function shouldRunAllWorkspaces() {
  return flags.has("--workspaces");
}
```

- [ ] **Step 3: Add package workspace pattern reader**

Add before `detectPackageManager`:

```js
function readPackageWorkspacePatterns(projectRoot) {
  const packageJson = readJsonFile(path.join(projectRoot, "package.json"));
  const workspaces = packageJson?.workspaces;

  if (Array.isArray(workspaces)) {
    return workspaces;
  }

  if (Array.isArray(workspaces?.packages)) {
    return workspaces.packages;
  }

  return [];
}
```

- [ ] **Step 4: Add pnpm workspace pattern reader**

Add after package workspace reader:

```js
function readPnpmWorkspacePatterns(projectRoot) {
  const workspacePath = path.join(projectRoot, "pnpm-workspace.yaml");

  if (!fs.existsSync(workspacePath)) {
    return [];
  }

  const workspaceFile = fs.readFileSync(workspacePath, "utf8");
  const packageLines = workspaceFile
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "));

  return packageLines.map((line) => line.slice(2).replace(/^['\"]|['\"]$/g, ""));
}
```

- [ ] **Step 5: Add one-level workspace expansion**

Add after pnpm reader:

```js
function expandWorkspacePattern(projectRoot, workspacePattern) {
  if (!workspacePattern.endsWith("/*")) {
    return fs.existsSync(path.join(projectRoot, workspacePattern))
      ? [workspacePattern]
      : [];
  }

  const parentPattern = workspacePattern.slice(0, -2);
  const parentDirectory = path.join(projectRoot, parentPattern);

  if (!fs.existsSync(parentDirectory)) {
    return [];
  }

  return fs
    .readdirSync(parentDirectory, { withFileTypes: true })
    .filter((directoryEntry) => directoryEntry.isDirectory())
    .map((directoryEntry) => normalizePathForMatch(path.join(parentPattern, directoryEntry.name)))
    .filter((workspacePath) => fs.existsSync(path.join(projectRoot, workspacePath, "package.json")));
}
```

- [ ] **Step 6: Add workspace discovery**

Add after expansion helper:

```js
function discoverWorkspaces(projectRoot) {
  const workspacePatterns = [
    ...readPackageWorkspacePatterns(projectRoot),
    ...readPnpmWorkspacePatterns(projectRoot),
  ];
  const workspacePaths = [...new Set(
    workspacePatterns.flatMap((workspacePattern) =>
      expandWorkspacePattern(projectRoot, workspacePattern),
    ),
  )].sort();

  return workspacePaths.map((workspacePath) => {
    const workspaceRoot = path.join(projectRoot, workspacePath);
    const workspacePackageJson = readJsonFile(path.join(workspaceRoot, "package.json")) ?? {};

    return {
      name: workspacePackageJson.name ?? workspacePath,
      path: workspacePath,
      root: workspaceRoot,
    };
  });
}
```

- [ ] **Step 7: Add workspace selection**

Add after discovery:

```js
function selectWorkspace(projectRoot, workspaceTarget) {
  const workspaces = discoverWorkspaces(projectRoot);
  const normalizedTarget = normalizePathForMatch(workspaceTarget);
  const workspace = workspaces.find(
    (candidateWorkspace) =>
      candidateWorkspace.name === workspaceTarget ||
      candidateWorkspace.path === normalizedTarget,
  );

  if (!workspace) {
    throw new Error(`Workspace not found: ${workspaceTarget}`);
  }

  return workspace;
}
```

- [ ] **Step 8: Run targeted tests**

Run: `npm test -- test/cli.test.mjs`

Expected: missing workspace test passes after dispatch integration in Task 3.

## Task 3: Run Check For One Workspace

**Files:**
- Modify: `bin/rindaman.cjs`
- Modify: `test/cli.test.mjs`

- [ ] **Step 1: Add config composition helper**

Add after `readConfig`:

```js
function readWorkspaceConfig(projectRoot, workspaceRoot) {
  const rootConfig = readConfig(projectRoot);
  const workspacePackageJson = readJsonFile(path.join(workspaceRoot, "package.json")) ?? {};
  const workspacePackageConfig = workspacePackageJson.rindaman ?? {};
  const workspaceFileConfig = readJsonFile(path.join(workspaceRoot, ".rindamanrc.json")) ?? {};

  return {
    ...rootConfig,
    ...workspacePackageConfig,
    ...workspaceFileConfig,
    baselinePath:
      workspaceFileConfig.baselinePath ??
      workspacePackageConfig.baselinePath ??
      ".rindaman/baseline.json",
    checks: {
      ...rootConfig.checks,
      ...(workspacePackageConfig.checks ?? {}),
      ...(workspaceFileConfig.checks ?? {}),
    },
    ignorePatterns:
      workspaceFileConfig.ignorePatterns ??
      workspacePackageConfig.ignorePatterns ??
      rootConfig.ignorePatterns,
  };
}
```

- [ ] **Step 2: Add workspace to check result**

Change `createCheckCommandResult(auditMode, projectRoot, config)` to accept an optional fourth parameter:

```js
function createCheckCommandResult(auditMode, projectRoot, config, workspace) {
```

Use:

```js
  const executionRoot = workspace?.root ?? projectRoot;
```

Then replace execution-root-sensitive calls to use `executionRoot` for package manager, changed files, explicit target files, formatter, script execution, semantic checks, baseline reads, and report paths. Keep `projectRoot` as the monorepo root in the returned object.

Add `workspace: workspace ?? null` to the returned object.

- [ ] **Step 3: Update runCheckCommand for single workspace**

In `runCheckCommand`, read:

```js
  const workspaceTarget = readWorkspaceTarget();
  const workspace = workspaceTarget ? selectWorkspace(projectRoot, workspaceTarget) : undefined;
  const config = applyFlagOverrides(
    workspace ? readWorkspaceConfig(projectRoot, workspace.root) : readConfig(projectRoot),
  );
  const result = createCheckCommandResult(auditMode, projectRoot, config, workspace);
```

- [ ] **Step 4: Add path workspace test**

Add near workspace tests:

```js
test("CLI check can target a workspace by path", () => {
  const result = runCli(
    ["check", "--json", "--workspace", "packages/api"],
    monorepoFixtureDirectory,
  );

  assert.equal(result.status, 1);
  const output = parseJsonOutput(result);

  assert.equal(output.workspace.name, "@rindaman/api");
  assert.equal(output.workspace.path, "packages/api");
  assert.equal(output.debt.mode, "all");
});
```

- [ ] **Step 5: Add name workspace test**

```js
test("CLI check can target a workspace by package name", () => {
  const result = runCli(
    ["check", "--json", "--workspace", "@rindaman/web"],
    monorepoFixtureDirectory,
  );

  assert.equal(result.status, 0);
  const output = parseJsonOutput(result);

  assert.equal(output.workspace.name, "@rindaman/web");
  assert.equal(output.workspace.path, "apps/web");
});
```

- [ ] **Step 6: Run targeted tests**

Run: `npm test -- test/cli.test.mjs`

Expected: single workspace tests pass.

## Task 4: Run Check For All Workspaces

**Files:**
- Modify: `bin/rindaman.cjs`
- Modify: `test/cli.test.mjs`

- [ ] **Step 1: Add aggregate status helper**

Add before `runCheckCommand`:

```js
function getWorkspaceAggregateStatus(workspaceResults) {
  return workspaceResults.some((workspaceResult) =>
    ["failed", "audit_failed", "error"].includes(workspaceResult.status),
  )
    ? "failed"
    : "passed";
}
```

- [ ] **Step 2: Add workspace check aggregation**

Add before `runCheckCommand`:

```js
function createWorkspaceAggregateResult(auditMode, projectRoot) {
  const workspaces = discoverWorkspaces(projectRoot);

  if (workspaces.length === 0) {
    throw new Error("No workspaces found");
  }

  const workspaceResults = workspaces.map((workspace) => {
    const workspaceConfig = applyFlagOverrides(readWorkspaceConfig(projectRoot, workspace.root));
    return createCheckCommandResult(auditMode, projectRoot, workspaceConfig, workspace);
  });
  const status = getWorkspaceAggregateStatus(workspaceResults);

  return {
    command: auditMode ? "audit" : "check",
    status: auditMode && status === "failed" ? "audit_failed" : status,
    projectRoot,
    workspaces: workspaceResults,
  };
}
```

- [ ] **Step 3: Dispatch --workspaces in runCheckCommand**

At the top of `runCheckCommand`, after project root resolution:

```js
  if (shouldRunAllWorkspaces()) {
    const aggregateResult = createWorkspaceAggregateResult(auditMode, projectRoot);

    if (jsonOutput) {
      writeJsonResult(aggregateResult);
    } else {
      printHumanSummary({ checks: [], status: aggregateResult.status });
    }

    process.exit(getExitCodeForStatus(aggregateResult.status, auditMode));
  }
```

- [ ] **Step 4: Add all workspace test**

```js
test("CLI check can run all workspaces", () => {
  const result = runCli(["check", "--json", "--workspaces"], monorepoFixtureDirectory);

  assert.equal(result.status, 1);
  const output = parseJsonOutput(result);

  assert.equal(output.command, "check");
  assert.equal(output.status, "failed");
  assert.deepEqual(
    output.workspaces.map((workspaceResult) => workspaceResult.workspace.path),
    ["apps/web", "packages/api"],
  );
});
```

- [ ] **Step 5: Run targeted tests**

Run: `npm test -- test/cli.test.mjs`

Expected: all workspace aggregation passes.

## Task 5: Workspace Baseline Command

**Files:**
- Modify: `bin/rindaman.cjs`
- Modify: `test/cli.test.mjs`

- [ ] **Step 1: Update baseline command for workspace target**

In `runBaselineCommand`, support `--workspace` by selecting a workspace, reading workspace config, passing workspace into `createCheckCommandResult`, and writing the baseline under the workspace root.

- [ ] **Step 2: Add all-workspaces baseline aggregation**

If `--workspaces` is present, run baseline generation for every workspace and return:

```js
{
  command: "baseline",
  status: "passed",
  projectRoot,
  workspaces: baselineResults
}
```

- [ ] **Step 3: Add workspace baseline path test**

```js
test("CLI baseline writes workspace-local baselines", () => {
  const result = runCli(
    ["baseline", "--json", "--workspace", "packages/api"],
    monorepoFixtureDirectory,
  );

  assert.equal(result.status, 0);
  const output = parseJsonOutput(result);

  assert.equal(output.workspace.path, "packages/api");
  assert.match(output.baseline.path, /packages[\\/]api[\\/]\.rindaman[\\/]baseline\.json$/);
  assert.deepEqual(output.baseline.checkNames, ["types"]);
});
```

- [ ] **Step 4: Run targeted tests**

Run: `npm test -- test/cli.test.mjs`

Expected: workspace baseline behavior passes.

## Task 6: Documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add workspace command examples**

Add to CLI examples:

```bash
rindaman check --workspace packages/api --json
rindaman check --workspaces --json
rindaman baseline --workspaces --json
```

- [ ] **Step 2: Add workspace section**

Add after baseline docs:

```md
### Monorepo workspaces

Use `--workspace <name-or-path>` to run against one workspace, or `--workspaces` to run every detected workspace.

Rindaman detects workspaces from root `package.json` workspaces and `pnpm-workspace.yaml`. Workspace runs use workspace-local scripts, config, and baselines, with root config as the fallback.
```

- [ ] **Step 3: Run targeted tests**

Run: `npm test -- test/cli.test.mjs`

Expected: tests still pass.

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

Expected: only intended monorepo files are modified.
