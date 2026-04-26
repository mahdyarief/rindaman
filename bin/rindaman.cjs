#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const {
  createCliArgs,
  readFlagValue,
  readDebtModeFlag,
  readWorkspaceTarget,
  shouldRunAllWorkspaces,
} = require("../src/cli/args.cjs");
const {
  readJsonFile,
  readConfig,
  readWorkspaceConfig,
  applyFlagOverrides,
} = require("../src/cli/config.cjs");
const {
  normalizePathForMatch,
  discoverWorkspaces,
  selectWorkspace,
} = require("../src/cli/workspaces.cjs");
const {
  readBaselineFile,
  getFailedCheckNames,
  writeBaselineFile,
} = require("../src/cli/baseline.cjs");
const {
  createDebtResult,
  getOverallStatus,
  getExitCodeForStatus,
  getWorkspaceAggregateStatus,
} = require("../src/cli/policy.cjs");
const {
  detectPackageManager,
  detectFormatter,
  executePackageScript,
  getLocalBinaryPath,
  createCheckCommandResult,
  createWorkspaceAggregateResult,
} = require("../src/cli/check-runner.cjs");

const EXIT_OK = 0;
const EXIT_QUALITY_BLOCKER = 1;
const EXIT_RUNTIME_ERROR = 2;
const EXIT_SETUP_INCOMPLETE = 3;
const EXIT_UNSAFE_BLOCKED = 4;

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const BLUE = "\x1b[36m";
const RESET = "\x1b[0m";

const cliArgs = createCliArgs(process.argv.slice(2));

function colorize(color, message) {
  return cliArgs.jsonOutput ? message : `${color}${message}${RESET}`;
}

function print(message) {
  if (!cliArgs.jsonOutput) {
    console.log(message);
  }
}

function printError(message) {
  if (!cliArgs.jsonOutput) {
    console.error(colorize(RED, `[Rindaman] ${message}`));
  }
}

function printSection(message) {
  print(`\n${colorize(BLUE, `=== ${message} ===`)}`);
}

function findProjectRoot(startDirectory) {
  let currentDirectory = startDirectory;

  while (currentDirectory) {
    if (
      fs.existsSync(path.join(currentDirectory, "package.json")) ||
      fs.existsSync(path.join(currentDirectory, ".git"))
    ) {
      return currentDirectory;
    }

    const parentDirectory = path.dirname(currentDirectory);

    if (parentDirectory === currentDirectory) {
      return startDirectory;
    }

    currentDirectory = parentDirectory;
  }

  return startDirectory;
}

function writeJsonResult(result) {
  console.log(JSON.stringify(result, null, 2));
}

function printHumanSummary(result) {
  printSection("Summary");

  for (const check of result.checks) {
    const suffix = check.reason ? ` - ${check.reason}` : "";
    const color =
      check.status === "passed"
        ? GREEN
        : check.status === "failed"
          ? RED
          : YELLOW;
    console.log(
      colorize(color, `[Rindaman] ${check.name}: ${check.status}${suffix}`),
    );
  }

  console.log(`[Rindaman] Status: ${result.status}`);

  if (result.reportPath) {
    console.log(`[Rindaman] Report: ${result.reportPath}`);
  }
}

function createResolvedConfig(projectRoot, workspace) {
  const config = workspace
    ? readWorkspaceConfig(projectRoot, workspace.root)
    : readConfig(projectRoot);

  return applyFlagOverrides(config, cliArgs, readFlagValue, readDebtModeFlag);
}

function createSingleCheckResult(auditMode, projectRoot) {
  const workspaceTarget = readWorkspaceTarget(cliArgs.commandArgs);
  const workspace = workspaceTarget
    ? selectWorkspace(projectRoot, workspaceTarget, readJsonFile)
    : undefined;
  const config = createResolvedConfig(projectRoot, workspace);

  return createCheckCommandResult(
    auditMode,
    projectRoot,
    config,
    workspace,
    cliArgs,
    readBaselineFile,
    createDebtResult,
    getOverallStatus,
    normalizePathForMatch,
    readJsonFile,
  );
}

function runCheckCommand(auditMode) {
  const projectRoot = findProjectRoot(process.cwd());

  if (shouldRunAllWorkspaces(cliArgs.flags)) {
    const aggregateResult = createWorkspaceAggregateResult(
      auditMode,
      projectRoot,
      cliArgs,
      discoverWorkspaces,
      readWorkspaceConfig,
      applyFlagOverrides,
      readFlagValue,
      readDebtModeFlag,
      readBaselineFile,
      createDebtResult,
      getOverallStatus,
      getWorkspaceAggregateStatus,
      normalizePathForMatch,
      readJsonFile,
    );

    if (cliArgs.jsonOutput) {
      writeJsonResult(aggregateResult);
    } else {
      printHumanSummary({ checks: [], status: aggregateResult.status });
    }

    process.exit(
      getExitCodeForStatus(
        aggregateResult.status,
        auditMode,
        EXIT_OK,
        EXIT_QUALITY_BLOCKER,
      ),
    );
  }

  const result = createSingleCheckResult(auditMode, projectRoot);

  printSection(auditMode ? "Rindaman Audit" : "Rindaman Check");
  print(`[Rindaman] Project root: ${result.projectRoot}`);
  print(`[Rindaman] Package manager: ${result.packageManager}`);
  print(`[Rindaman] Base ref: ${result.baseRef}`);
  print(`[Rindaman] Changed files: ${result.changedFiles.length}`);

  if (cliArgs.jsonOutput) {
    writeJsonResult(result);
  } else {
    printHumanSummary(result);
  }

  process.exit(
    getExitCodeForStatus(
      result.status,
      auditMode,
      EXIT_OK,
      EXIT_QUALITY_BLOCKER,
    ),
  );
}

function runBaselineCommand() {
  const projectRoot = findProjectRoot(process.cwd());

  if (shouldRunAllWorkspaces(cliArgs.flags)) {
    const workspaces = discoverWorkspaces(projectRoot, readJsonFile);
    const workspaceResults = workspaces.map((workspace) => {
      const workspaceConfig = createResolvedConfig(projectRoot, workspace);
      const checkResult = createCheckCommandResult(
        true,
        projectRoot,
        workspaceConfig,
        workspace,
        cliArgs,
        readBaselineFile,
        createDebtResult,
        getOverallStatus,
        normalizePathForMatch,
        readJsonFile,
      );
      const baseline = writeBaselineFile(
        workspace.root,
        workspaceConfig,
        getFailedCheckNames(checkResult.checks),
      );

      return {
        command: "baseline",
        status: "passed",
        projectRoot,
        workspace,
        baseline,
        checks: checkResult.checks,
      };
    });
    const result = {
      command: "baseline",
      status: "passed",
      projectRoot,
      workspaces: workspaceResults,
    };

    if (cliArgs.jsonOutput) {
      writeJsonResult(result);
    } else {
      printSection("Rindaman Baseline");
      console.log(`[Rindaman] Workspaces: ${workspaceResults.length}`);
    }

    process.exit(EXIT_OK);
  }

  const workspaceTarget = readWorkspaceTarget(cliArgs.commandArgs);
  const workspace = workspaceTarget
    ? selectWorkspace(projectRoot, workspaceTarget, readJsonFile)
    : undefined;
  const config = createResolvedConfig(projectRoot, workspace);
  const executionRoot = workspace?.root ?? projectRoot;
  const checkResult = createCheckCommandResult(
    true,
    projectRoot,
    config,
    workspace,
    cliArgs,
    readBaselineFile,
    createDebtResult,
    getOverallStatus,
    normalizePathForMatch,
    readJsonFile,
  );
  const baseline = writeBaselineFile(
    executionRoot,
    config,
    getFailedCheckNames(checkResult.checks),
  );
  const result = {
    command: "baseline",
    status: "passed",
    projectRoot,
    workspace: workspace ?? null,
    baseline,
    checks: checkResult.checks,
  };

  if (cliArgs.jsonOutput) {
    writeJsonResult(result);
  } else {
    printSection("Rindaman Baseline");
    console.log(`[Rindaman] Baseline: ${baseline.path}`);
    console.log(`[Rindaman] Checks: ${baseline.checkNames.join(", ") || "none"}`);
  }

  process.exit(EXIT_OK);
}

function runDoctorCommand() {
  const projectRoot = findProjectRoot(process.cwd());
  const config = createResolvedConfig(projectRoot);
  const packageManager = detectPackageManager(projectRoot);
  const packageJsonExists = fs.existsSync(
    path.join(projectRoot, "package.json"),
  );
  const gitAvailable = true;
  const formatter = detectFormatter(projectRoot, readJsonFile);

  const checks = [
    {
      name: "node",
      status: "passed",
      detail: process.version,
    },
    {
      name: "package_json",
      status: packageJsonExists ? "passed" : "failed",
    },
    {
      name: "git",
      status: gitAvailable ? "passed" : "skipped",
    },
    {
      name: "typecheck_script",
      status:
        executePackageScript(projectRoot, packageManager, "typecheck", false, readJsonFile)
          .status === "skipped"
          ? "skipped"
          : "passed",
    },
    {
      name: "formatter_config",
      status: formatter ? "passed" : "skipped",
      detail: formatter ?? null,
    },
    {
      name: "biome_binary",
      status: fs.existsSync(getLocalBinaryPath(projectRoot, "biome"))
        ? "passed"
        : "skipped",
    },
    {
      name: "prettier_binary",
      status: fs.existsSync(getLocalBinaryPath(projectRoot, "prettier"))
        ? "passed"
        : "skipped",
    },
    {
      name: "knip_binary",
      status: fs.existsSync(getLocalBinaryPath(projectRoot, "knip"))
        ? "passed"
        : "skipped",
    },
  ];

  const status = checks.some((check) => check.status === "failed")
    ? "failed"
    : "passed";
  const result = {
    command: "doctor",
    status,
    projectRoot,
    packageManager,
    config,
    checks,
  };

  if (cliArgs.jsonOutput) {
    writeJsonResult(result);
  } else {
    printSection("Rindaman Doctor");

    for (const check of checks) {
      const suffix = check.detail ? ` - ${check.detail}` : "";
      const color =
        check.status === "passed"
          ? GREEN
          : check.status === "failed"
            ? RED
            : YELLOW;
      console.log(
        colorize(color, `[Rindaman] ${check.name}: ${check.status}${suffix}`),
      );
    }
  }

  process.exit(status === "passed" ? EXIT_OK : EXIT_SETUP_INCOMPLETE);
}

function printHelp() {
  console.log(
    [
      "Rindaman - OpenCode strict quality governor",
      "",
      "Usage:",
      "  rindaman check [--json] [--include-output] [--strict] [--changed-only] [--all] [--report]",
      "  rindaman audit [--json] [--include-output]",
      "  rindaman baseline [--json]",
      "  rindaman doctor [--json]",
      "  rindaman help",
      "",
      "Options:",
      "  --json             Print structured JSON output",
      "  --include-output   Include captured stdout/stderr in JSON output",
      "  --strict           Treat skipped checks as failures",
      "  --changed-only     Run file-scoped checks against changed JS/TS files",
      "  --all              Run broad checks where supported",
      "  --base <ref>       Compare changed files against a specific base ref",
      "  --report           Write .rindaman/report.md through the semantic engine",
      "  --report-path <p>  Write report to a custom path when --report is enabled",
      "  --debt-mode <mode> Classify debt with changed-only or all mode",
      "  --fail-existing    Treat existing debt as blocking",
      "  --baseline-path <p> Read or write a custom baseline file path",
      "  --no-baseline      Ignore an existing baseline file",
      "",
      "Exit codes:",
      `  ${EXIT_OK} passed or audit completed`,
      `  ${EXIT_QUALITY_BLOCKER} quality blockers found`,
      `  ${EXIT_RUNTIME_ERROR} runtime error`,
      `  ${EXIT_SETUP_INCOMPLETE} setup incomplete`,
      `  ${EXIT_UNSAFE_BLOCKED} unsafe operation blocked`,
    ].join("\n"),
  );
}

try {
  if (cliArgs.command === "help" || cliArgs.flags.has("--help")) {
    printHelp();
    process.exit(EXIT_OK);
  }

  if (cliArgs.command === "check") {
    runCheckCommand(false);
  }

  if (cliArgs.command === "audit") {
    runCheckCommand(true);
  }

  if (cliArgs.command === "baseline") {
    runBaselineCommand();
  }

  if (cliArgs.command === "doctor") {
    runDoctorCommand();
  }

  printError(`Unknown command: ${cliArgs.command}`);
  printHelp();
  process.exit(EXIT_RUNTIME_ERROR);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  if (cliArgs.jsonOutput) {
    writeJsonResult({
      command: cliArgs.command,
      status: "error",
      error: message,
    });
  } else {
    printError(message);
  }

  process.exit(EXIT_RUNTIME_ERROR);
}
