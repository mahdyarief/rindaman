#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

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

const KNOWN_COMMANDS = new Set(["check", "audit", "baseline", "doctor", "help"]);
const rawArgs = process.argv.slice(2);
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
const jsonOutput = flags.has("--json");

function readFlagValue(flagName) {
  const flagIndex = commandArgs.indexOf(flagName);

  if (flagIndex === -1) {
    return undefined;
  }

  return commandArgs[flagIndex + 1];
}

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

function colorize(color, message) {
  return jsonOutput ? message : `${color}${message}${RESET}`;
}

function print(message) {
  if (!jsonOutput) {
    console.log(message);
  }
}

function printError(message) {
  if (!jsonOutput) {
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

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function createDefaultConfig() {
  return {
    changedOnly: true,
    strictWarnings: false,
    writeReport: false,
    reportPath: ".rindaman/report.md",
    allowPackageInstall: false,
    baseRef: undefined,
    debtMode: "changed-only",
    failOnExistingDebt: false,
    baselinePath: ".rindaman/baseline.json",
    useBaseline: true,
    ignorePatterns: ["dist/**", "coverage/**", "node_modules/**", ".git/**"],
    checks: {
      semantic: true,
      types: true,
      syntax: true,
      hygiene: true,
    },
  };
}

function readConfig(projectRoot) {
  const packageJson =
    readJsonFile(path.join(projectRoot, "package.json")) ?? {};
  const packageConfig = packageJson.rindaman ?? {};
  const fileConfig =
    readJsonFile(path.join(projectRoot, ".rindamanrc.json")) ?? {};
  const defaultConfig = createDefaultConfig();

  return {
    ...defaultConfig,
    ...packageConfig,
    ...fileConfig,
    checks: {
      ...defaultConfig.checks,
      ...(packageConfig.checks ?? {}),
      ...(fileConfig.checks ?? {}),
    },
    ignorePatterns:
      fileConfig.ignorePatterns ??
      packageConfig.ignorePatterns ??
      defaultConfig.ignorePatterns,
  };
}

function applyFlagOverrides(config) {
  return {
    ...config,
    changedOnly: flags.has("--all")
      ? false
      : flags.has("--changed-only")
        ? true
        : config.changedOnly,
    strictWarnings: flags.has("--strict") ? true : config.strictWarnings,
    writeReport: flags.has("--report")
      ? true
      : flags.has("--no-report")
        ? false
        : config.writeReport,
    reportPath: readFlagValue("--report-path") ?? config.reportPath,
    allowPackageInstall: flags.has("--allow-install")
      ? true
      : config.allowPackageInstall,
    baseRef: readFlagValue("--base") ?? config.baseRef,
    debtMode: readDebtModeFlag() ?? config.debtMode,
    failOnExistingDebt: flags.has("--fail-existing")
      ? true
      : config.failOnExistingDebt,
    baselinePath: readFlagValue("--baseline-path") ?? config.baselinePath,
    useBaseline: flags.has("--no-baseline") ? false : config.useBaseline,
  };
}

function detectPackageManager(projectRoot) {
  if (fs.existsSync(path.join(projectRoot, "bun.lockb"))) {
    return "bun";
  }

  if (fs.existsSync(path.join(projectRoot, "pnpm-lock.yaml"))) {
    return "pnpm";
  }

  if (fs.existsSync(path.join(projectRoot, "yarn.lock"))) {
    return "yarn";
  }

  return "npm";
}

function getWindowsCommandName(commandName) {
  if (process.platform !== "win32") {
    return commandName;
  }

  if (["npm", "pnpm", "yarn", "bun"].includes(commandName)) {
    return `${commandName}.cmd`;
  }

  return commandName;
}

function executeCommand(commandName, args, options = {}) {
  const startTime = Date.now();
  const finalCommandName = getWindowsCommandName(commandName);
  const needsWindowsShell =
    process.platform === "win32" && finalCommandName.endsWith(".cmd");
  let result = spawnSync(finalCommandName, args, {
    cwd: options.cwd ?? process.cwd(),
    encoding: "utf8",
    stdio: options.inherit ? "inherit" : "pipe",
    shell: needsWindowsShell,
    env: {
      ...process.env,
      ...(options.env ?? {}),
    },
  });

  if (result.error?.code === "ENOENT" && process.platform === "win32") {
    result = spawnSync(commandName, args, {
      cwd: options.cwd ?? process.cwd(),
      encoding: "utf8",
      stdio: options.inherit ? "inherit" : "pipe",
      env: {
        ...process.env,
        ...(options.env ?? {}),
      },
      shell: true,
    });
  }

  return {
    result,
    durationMs: Date.now() - startTime,
    command: [commandName, ...args].join(" "),
  };
}

function getLocalBinaryPath(projectRoot, binaryName) {
  const extension = process.platform === "win32" ? ".cmd" : "";
  return path.join(
    projectRoot,
    "node_modules",
    ".bin",
    `${binaryName}${extension}`,
  );
}

function executeLocalBinary(projectRoot, binaryName, args, inherit) {
  const binaryPath = getLocalBinaryPath(projectRoot, binaryName);

  if (!fs.existsSync(binaryPath)) {
    return {
      status: "skipped",
      severity: "warning",
      command: [binaryName, ...args].join(" "),
      reason: `${binaryName} is not installed locally`,
      exitCode: null,
      durationMs: 0,
    };
  }

  const executedCommand = executeCommand(binaryPath, args, {
    cwd: projectRoot,
    inherit,
  });

  return {
    status: executedCommand.result.status === 0 ? "passed" : "failed",
    severity: "blocker",
    command: executedCommand.command,
    reason: null,
    exitCode: executedCommand.result.status,
    durationMs: executedCommand.durationMs,
    stdout: executedCommand.result.stdout ?? "",
    stderr: executedCommand.result.stderr ?? "",
  };
}

function getPackageScriptCommand(packageManager, scriptName) {
  if (packageManager === "npm") {
    return {
      commandName: "npm",
      args: ["run", scriptName],
    };
  }

  return {
    commandName: packageManager,
    args: [scriptName],
  };
}

function executePackageScript(
  projectRoot,
  packageManager,
  scriptName,
  inherit,
) {
  const packageJson = readJsonFile(path.join(projectRoot, "package.json"));

  if (!packageJson) {
    return {
      status: "skipped",
      severity: "warning",
      command: scriptName,
      reason: "package.json not found",
      exitCode: null,
      durationMs: 0,
    };
  }

  if (!packageJson.scripts || !packageJson.scripts[scriptName]) {
    return {
      status: "skipped",
      severity: "warning",
      command: scriptName,
      reason: `script "${scriptName}" not found`,
      exitCode: null,
      durationMs: 0,
    };
  }

  const scriptCommand = getPackageScriptCommand(packageManager, scriptName);
  const executedCommand = executeCommand(
    scriptCommand.commandName,
    scriptCommand.args,
    {
      cwd: projectRoot,
      inherit,
    },
  );

  return {
    status: executedCommand.result.status === 0 ? "passed" : "failed",
    severity: "blocker",
    command: executedCommand.command,
    reason: null,
    exitCode: executedCommand.result.status,
    durationMs: executedCommand.durationMs,
    stdout: executedCommand.result.stdout ?? "",
    stderr: executedCommand.result.stderr ?? "",
  };
}

function readGitOutput(projectRoot, gitArgs) {
  const executedCommand = executeCommand("git", gitArgs, {
    cwd: projectRoot,
  });

  if (executedCommand.result.status !== 0) {
    return "";
  }

  return (executedCommand.result.stdout ?? "").trim();
}

function detectBaseRef(projectRoot, config) {
  if (config.baseRef) {
    return config.baseRef;
  }

  const candidateRefs = [
    "upstream/main",
    "origin/main",
    "main",
    "master",
    "HEAD",
  ];

  for (const candidateRef of candidateRefs) {
    if (readGitOutput(projectRoot, ["rev-parse", "--verify", candidateRef])) {
      return candidateRef;
    }
  }

  return "HEAD";
}

function getChangedFiles(projectRoot, baseRef) {
  const diffOutput = readGitOutput(projectRoot, [
    "diff",
    baseRef,
    "--name-only",
    "--diff-filter=ACMR",
  ]);
  const statusOutput = readGitOutput(projectRoot, ["status", "--porcelain"]);

  const diffFiles = diffOutput ? diffOutput.split(/\r?\n/) : [];
  const statusFiles = statusOutput
    ? statusOutput
        .split(/\r?\n/)
        .map((line) => line.slice(3).trim())
        .filter(Boolean)
    : [];

  return [...new Set([...diffFiles, ...statusFiles])].filter((changedFile) =>
    fs.existsSync(path.join(projectRoot, changedFile)),
  );
}

function getExplicitTargetFiles(projectRoot) {
  const flagsWithValues = new Set([
    "--base",
    "--report-path",
    "--debt-mode",
    "--baseline-path",
  ]);
  const explicitTargetFiles = [];

  for (let argumentIndex = 0; argumentIndex < commandArgs.length; argumentIndex += 1) {
    const commandArgument = commandArgs[argumentIndex];

    if (flagsWithValues.has(commandArgument)) {
      argumentIndex += 1;
      continue;
    }

    if (commandArgument.startsWith("--")) {
      continue;
    }

    if (fs.existsSync(path.join(projectRoot, commandArgument))) {
      explicitTargetFiles.push(commandArgument);
    }
  }

  return explicitTargetFiles;
}

function isJavaScriptOrTypeScriptFile(filePath) {
  return /\.(ts|tsx|js|jsx|mts|cts|mjs|cjs)$/.test(filePath);
}

function normalizePathForMatch(filePath) {
  return filePath.replace(/\\/g, "/");
}

function matchesIgnorePattern(filePath, pattern) {
  const normalizedFilePath = normalizePathForMatch(filePath);
  const normalizedPattern = normalizePathForMatch(pattern);

  if (normalizedPattern.endsWith("/**")) {
    return normalizedFilePath.startsWith(normalizedPattern.slice(0, -3));
  }

  if (normalizedPattern.startsWith("**/")) {
    return normalizedFilePath.endsWith(normalizedPattern.slice(3));
  }

  return (
    normalizedFilePath === normalizedPattern ||
    normalizedFilePath.startsWith(`${normalizedPattern}/`)
  );
}

function filterIgnoredFiles(files, ignorePatterns) {
  return files.filter(
    (file) =>
      !ignorePatterns.some((ignorePattern) =>
        matchesIgnorePattern(file, ignorePattern),
      ),
  );
}

function detectFormatter(projectRoot) {
  if (
    fs.existsSync(path.join(projectRoot, "biome.json")) ||
    fs.existsSync(path.join(projectRoot, "biome.jsonc"))
  ) {
    return "biome";
  }

  const prettierConfigFiles = [
    ".prettierrc",
    ".prettierrc.json",
    ".prettierrc.js",
    ".prettierrc.cjs",
    ".prettierrc.mjs",
    "prettier.config.js",
    "prettier.config.cjs",
    "prettier.config.mjs",
  ];

  if (
    prettierConfigFiles.some((configFile) =>
      fs.existsSync(path.join(projectRoot, configFile)),
    )
  ) {
    return "prettier";
  }

  const packageJson = readJsonFile(path.join(projectRoot, "package.json"));

  if (packageJson?.prettier) {
    return "prettier";
  }

  return undefined;
}

function createSkippedCheck(name, reason, severity = "warning") {
  return {
    name,
    status: "skipped",
    severity,
    command: null,
    reason,
    exitCode: null,
    durationMs: 0,
  };
}

function createCheckResult(name, checkResult) {
  return {
    name,
    status: checkResult.status,
    severity: checkResult.severity,
    command: checkResult.command ?? null,
    reason: checkResult.reason ?? null,
    exitCode:
      typeof checkResult.exitCode === "number" ? checkResult.exitCode : null,
    durationMs: checkResult.durationMs ?? 0,
    stdout: flags.has("--include-output")
      ? (checkResult.stdout ?? "")
      : undefined,
    stderr: flags.has("--include-output")
      ? (checkResult.stderr ?? "")
      : undefined,
  };
}

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

function createDebtResult(config, changedOnly, targetFiles, checks, baseline) {
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

  if (
    config.debtMode === "changed-only" &&
    changedOnly &&
    targetFiles.length > 0
  ) {
    debtResult.introducedChecks = unclassifiedCheckNames;
    debtResult.classification = existingCheckNames.length > 0 ? "mixed" : "introduced";
    return debtResult;
  }

  debtResult.unknownChecks = unclassifiedCheckNames;
  debtResult.classification = existingCheckNames.length > 0 ? "mixed" : "unknown";
  return debtResult;
}

function runSemanticCheck(projectRoot, targetFiles, config, inherit) {
  const enginePath = path.resolve(
    __dirname,
    "..",
    "src",
    "quality-engine",
    "engine.cjs",
  );

  if (!fs.existsSync(enginePath)) {
    return {
      status: "failed",
      severity: "blocker",
      command: `node ${enginePath}`,
      reason: "quality engine not found",
      exitCode: EXIT_RUNTIME_ERROR,
      durationMs: 0,
    };
  }

  const executedCommand = executeCommand("node", [enginePath, ...targetFiles], {
    cwd: projectRoot,
    inherit,
    env: {
      RINDAMAN_WRITE_REPORT: config.writeReport ? "1" : "0",
      RINDAMAN_REPORT_PATH: config.reportPath,
    },
  });

  return {
    status: executedCommand.result.status === 0 ? "passed" : "failed",
    severity: "blocker",
    command: executedCommand.command,
    reason: null,
    exitCode: executedCommand.result.status,
    durationMs: executedCommand.durationMs,
    stdout: executedCommand.result.stdout ?? "",
    stderr: executedCommand.result.stderr ?? "",
  };
}

function runTypeCheck(projectRoot, packageManager, inherit) {
  return executePackageScript(
    projectRoot,
    packageManager,
    "typecheck",
    inherit,
  );
}

function runSyntaxCheck(
  projectRoot,
  formatter,
  targetFiles,
  changedOnly,
  inherit,
) {
  if (!formatter) {
    return createSkippedCheck("syntax", "No Biome or Prettier config found");
  }

  if (formatter === "biome") {
    return executeLocalBinary(
      projectRoot,
      "biome",
      ["check", ...(changedOnly ? targetFiles : ["."])],
      inherit,
    );
  }

  return executeLocalBinary(
    projectRoot,
    "prettier",
    ["--check", ...(changedOnly ? targetFiles : ["."])],
    inherit,
  );
}

function runHygieneCheck(projectRoot, inherit) {
  return executeLocalBinary(projectRoot, "knip", [], inherit);
}

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

function getExitCodeForStatus(status, auditMode) {
  if (auditMode) {
    return EXIT_OK;
  }

  if (status === "failed") {
    return EXIT_QUALITY_BLOCKER;
  }

  return EXIT_OK;
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

function getFailedCheckNames(checks) {
  return checks
    .filter((check) => check.status === "failed")
    .map((check) => check.name);
}

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

function createCheckCommandResult(auditMode, projectRoot, config) {
  const packageManager = detectPackageManager(projectRoot);
  const baseRef = detectBaseRef(projectRoot, config);
  const explicitTargetFiles = getExplicitTargetFiles(projectRoot);
  const allChangedFiles = config.changedOnly
    ? explicitTargetFiles.length > 0
      ? explicitTargetFiles
      : getChangedFiles(projectRoot, baseRef)
    : [];
  const changedFiles = filterIgnoredFiles(
    allChangedFiles,
    config.ignorePatterns,
  );
  const targetFiles = config.changedOnly
    ? changedFiles.filter(isJavaScriptOrTypeScriptFile)
    : [];
  const inheritOutput = !jsonOutput;
  const formatter = detectFormatter(projectRoot);

  const checks = [];

  if (config.checks.semantic) {
    checks.push(
      createCheckResult(
        "semantic",
        runSemanticCheck(projectRoot, targetFiles, config, inheritOutput),
      ),
    );
  } else {
    checks.push(createSkippedCheck("semantic", "Disabled by config", "info"));
  }

  if (config.checks.types) {
    checks.push(
      createCheckResult(
        "types",
        runTypeCheck(projectRoot, packageManager, inheritOutput),
      ),
    );
  } else {
    checks.push(createSkippedCheck("types", "Disabled by config", "info"));
  }

  if (config.checks.syntax) {
    checks.push(
      createCheckResult(
        "syntax",
        runSyntaxCheck(
          projectRoot,
          formatter,
          targetFiles,
          config.changedOnly,
          inheritOutput,
        ),
      ),
    );
  } else {
    checks.push(createSkippedCheck("syntax", "Disabled by config", "info"));
  }

  if (config.checks.hygiene) {
    checks.push(
      createCheckResult("hygiene", runHygieneCheck(projectRoot, inheritOutput)),
    );
  } else {
    checks.push(createSkippedCheck("hygiene", "Disabled by config", "info"));
  }

  const baseline = readBaselineFile(projectRoot, config);
  const debt = createDebtResult(
    config,
    config.changedOnly,
    targetFiles,
    checks,
    baseline,
  );
  const status = getOverallStatus(checks, config, debt);

  return {
    command: auditMode ? "audit" : "check",
    status: auditMode && status === "failed" ? "audit_failed" : status,
    projectRoot,
    packageManager,
    baseRef,
    changedOnly: config.changedOnly,
    changedFiles,
    targetFiles,
    formatter: formatter ?? null,
    reportPath: config.writeReport
      ? path.resolve(projectRoot, config.reportPath)
      : null,
    checks,
    baseline,
    debt,
    policy: {
      strictWarnings: config.strictWarnings,
      allowPackageInstall: config.allowPackageInstall,
      writeReport: config.writeReport,
      debtMode: config.debtMode,
      failOnExistingDebt: config.failOnExistingDebt,
      baselinePath: config.baselinePath,
      useBaseline: config.useBaseline,
      ignorePatterns: config.ignorePatterns,
    },
  };
}

function runCheckCommand(auditMode) {
  const projectRoot = findProjectRoot(process.cwd());
  const config = applyFlagOverrides(readConfig(projectRoot));
  const result = createCheckCommandResult(auditMode, projectRoot, config);

  printSection(auditMode ? "Rindaman Audit" : "Rindaman Check");
  print(`[Rindaman] Project root: ${result.projectRoot}`);
  print(`[Rindaman] Package manager: ${result.packageManager}`);
  print(`[Rindaman] Base ref: ${result.baseRef}`);
  print(`[Rindaman] Changed files: ${result.changedFiles.length}`);

  if (jsonOutput) {
    writeJsonResult(result);
  } else {
    printHumanSummary(result);
  }

  process.exit(getExitCodeForStatus(result.status, auditMode));
}

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

function runDoctorCommand() {
  const projectRoot = findProjectRoot(process.cwd());
  const config = applyFlagOverrides(readConfig(projectRoot));
  const packageManager = detectPackageManager(projectRoot);
  const packageJsonExists = fs.existsSync(
    path.join(projectRoot, "package.json"),
  );
  const gitAvailable = Boolean(readGitOutput(projectRoot, ["--version"]));
  const formatter = detectFormatter(projectRoot);

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
        executePackageScript(projectRoot, packageManager, "typecheck", false)
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

  if (jsonOutput) {
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
  if (command === "help" || flags.has("--help")) {
    printHelp();
    process.exit(EXIT_OK);
  }

  if (command === "check") {
    runCheckCommand(false);
  }

  if (command === "audit") {
    runCheckCommand(true);
  }

  if (command === "baseline") {
    runBaselineCommand();
  }

  if (command === "doctor") {
    runDoctorCommand();
  }

  printError(`Unknown command: ${command}`);
  printHelp();
  process.exit(EXIT_RUNTIME_ERROR);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  if (jsonOutput) {
    writeJsonResult({
      command,
      status: "error",
      error: message,
    });
  } else {
    printError(message);
  }

  process.exit(EXIT_RUNTIME_ERROR);
}
