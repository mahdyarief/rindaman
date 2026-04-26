# CLI Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the CLI into focused internal modules while preserving all current behavior.

**Architecture:** Move CLI responsibilities from `bin/rindaman.cjs` into small CommonJS modules under `src/cli/`. Keep `bin/rindaman.cjs` as a thin executable that parses args, composes helpers, and exits with current behavior.

**Tech Stack:** Node.js CommonJS CLI, `node:test`, existing integration test suite.

---

## File Structure

- Create: `src/cli/args.cjs` for command parsing and flag helpers.
- Create: `src/cli/config.cjs` for config defaults, file reads, and overrides.
- Create: `src/cli/workspaces.cjs` for workspace discovery and selection.
- Create: `src/cli/baseline.cjs` for baseline read/write helpers.
- Create: `src/cli/policy.cjs` for debt classification and status policy.
- Create: `src/cli/check-runner.cjs` for check execution and result assembly.
- Modify: `bin/rindaman.cjs` to use the extracted helpers.

## Task 1: Extract Arguments Module

**Files:**
- Create: `src/cli/args.cjs`
- Modify: `bin/rindaman.cjs`

- [ ] **Step 1: Create args module**

Create `src/cli/args.cjs` with:

```js
const KNOWN_COMMANDS = new Set(["check", "audit", "baseline", "doctor", "help"]);

function createCliArgs(rawArgs) {
  const firstArg = rawArgs[0];
  const command = firstArg && KNOWN_COMMANDS.has(firstArg) ? firstArg : "check";
  const commandArgs =
    command === "check" &&
    firstArg &&
    !firstArg.startsWith("--") &&
    !KNOWN_COMMANDS.has(firstArg)
      ? rawArgs
      : rawArgs.slice(command === "check" && firstArg !== "check" ? 0 : 1);
  const flags = new Set(
    commandArgs.filter((argument) => argument.startsWith("--")),
  );

  return {
    rawArgs,
    command,
    commandArgs,
    flags,
    jsonOutput: flags.has("--json"),
  };
}

function readFlagValue(commandArgs, flagName) {
  const flagIndex = commandArgs.indexOf(flagName);

  if (flagIndex === -1) {
    return undefined;
  }

  return commandArgs[flagIndex + 1];
}

function readDebtModeFlag(commandArgs) {
  const debtMode = readFlagValue(commandArgs, "--debt-mode");

  if (!debtMode) {
    return undefined;
  }

  if (!["changed-only", "all"].includes(debtMode)) {
    throw new Error(`Invalid --debt-mode value: ${debtMode}`);
  }

  return debtMode;
}

module.exports = {
  createCliArgs,
  readFlagValue,
  readDebtModeFlag,
};
```

- [ ] **Step 2: Update entrypoint to use args module**

In `bin/rindaman.cjs`, replace inline command parsing with imports from `src/cli/args.cjs` and build `cliArgs = createCliArgs(process.argv.slice(2))`.

- [ ] **Step 3: Run CLI tests**

Run: `npm test -- test/cli.test.mjs`

Expected: all CLI tests still pass.

## Task 2: Extract Config Module

**Files:**
- Create: `src/cli/config.cjs`
- Modify: `bin/rindaman.cjs`

- [ ] **Step 1: Create config module**

Move these functions into `src/cli/config.cjs`:

- `readJsonFile`
- `createDefaultConfig`
- `readConfig`
- `readWorkspaceConfig`
- `applyFlagOverrides`

Export them as:

```js
module.exports = {
  readJsonFile,
  createDefaultConfig,
  readConfig,
  readWorkspaceConfig,
  applyFlagOverrides,
};
```

Make `applyFlagOverrides` accept explicit dependencies:

```js
function applyFlagOverrides(config, cliArgs, readFlagValue, readDebtModeFlag) {
```

- [ ] **Step 2: Update entrypoint imports**

In `bin/rindaman.cjs`, import the config module and pass `cliArgs.commandArgs`, `cliArgs.flags`, and flag helpers into `applyFlagOverrides`.

- [ ] **Step 3: Run tests**

Run: `npm test -- test/cli.test.mjs`

Expected: all CLI tests still pass.

## Task 3: Extract Workspace Module

**Files:**
- Create: `src/cli/workspaces.cjs`
- Modify: `bin/rindaman.cjs`

- [ ] **Step 1: Create workspace module**

Move these functions into `src/cli/workspaces.cjs`:

- `normalizePathForMatch`
- `readPackageWorkspacePatterns`
- `readPnpmWorkspacePatterns`
- `expandWorkspacePattern`
- `discoverWorkspaces`
- `selectWorkspace`

Export them as:

```js
module.exports = {
  normalizePathForMatch,
  readPackageWorkspacePatterns,
  readPnpmWorkspacePatterns,
  expandWorkspacePattern,
  discoverWorkspaces,
  selectWorkspace,
};
```

- [ ] **Step 2: Update entrypoint callers**

Replace local workspace helper references in `bin/rindaman.cjs` with imports from the module.

- [ ] **Step 3: Run tests**

Run: `npm test -- test/cli.test.mjs`

Expected: workspace tests still pass.

## Task 4: Extract Baseline and Policy Modules

**Files:**
- Create: `src/cli/baseline.cjs`
- Create: `src/cli/policy.cjs`
- Modify: `bin/rindaman.cjs`

- [ ] **Step 1: Create baseline module**

Move these functions into `src/cli/baseline.cjs`:

- `readBaselineFile`
- `writeBaselineFile`
- `getFailedCheckNames`

Export them as:

```js
module.exports = {
  readBaselineFile,
  writeBaselineFile,
  getFailedCheckNames,
};
```

- [ ] **Step 2: Create policy module**

Move these functions into `src/cli/policy.cjs`:

- `createDebtResult`
- `getOverallStatus`
- `getExitCodeForStatus`
- `getWorkspaceAggregateStatus`

Export them as:

```js
module.exports = {
  createDebtResult,
  getOverallStatus,
  getExitCodeForStatus,
  getWorkspaceAggregateStatus,
};
```

- [ ] **Step 3: Update entrypoint imports**

Replace inline baseline and policy helper usage with module imports.

- [ ] **Step 4: Run tests**

Run: `npm test -- test/cli.test.mjs`

Expected: all CLI tests still pass.

## Task 5: Extract Check Runner Module

**Files:**
- Create: `src/cli/check-runner.cjs`
- Modify: `bin/rindaman.cjs`

- [ ] **Step 1: Create check-runner module**

Move these functions into `src/cli/check-runner.cjs`:

- `getWindowsCommandName`
- `executeCommand`
- `detectPackageManager`
- `readGitOutput`
- `detectBaseRef`
- `getChangedFiles`
- `getExplicitTargetFiles`
- `isJavaScriptOrTypeScriptFile`
- `matchesIgnorePattern`
- `filterIgnoredFiles`
- `detectFormatter`
- `createSkippedCheck`
- `createCheckResult`
- `runSemanticCheck`
- `runTypeCheck`
- `runSyntaxCheck`
- `runHygieneCheck`
- `createCheckCommandResult`
- `createWorkspaceAggregateResult`

Export only the functions used by `bin/rindaman.cjs` directly.

- [ ] **Step 2: Keep helper injection explicit**

Pass imported helpers into `createCheckCommandResult` and `createWorkspaceAggregateResult` rather than depending on hidden globals. This keeps the refactor behavior-preserving and makes the module testable.

- [ ] **Step 3: Shrink entrypoint**

Leave `bin/rindaman.cjs` with:

- color/print helpers
- top-level command handlers
- imported modules
- error serialization

- [ ] **Step 4: Run full tests**

Run: `npm test`

Expected: all tests pass.

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

Expected: only intended CLI refactor files are modified.
