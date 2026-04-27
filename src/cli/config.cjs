const fs = require("node:fs");
const path = require("node:path");

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
    security: {
      failOnModerate: false,
      failOnHigh: true,
      failOnCritical: true,
    },
    ignorePatterns: ["dist/**", "coverage/**", "node_modules/**", ".git/**"],
    checks: {
      semantic: true,
      types: true,
      syntax: true,
      hygiene: true,
      security: true,
    },
  };
}

function readConfig(projectRoot) {
  const packageJson = readJsonFile(path.join(projectRoot, "package.json")) ?? {};
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
    security: {
      ...defaultConfig.security,
      ...(packageConfig.security ?? {}),
      ...(fileConfig.security ?? {}),
    },
    ignorePatterns:
      fileConfig.ignorePatterns ??
      packageConfig.ignorePatterns ??
      defaultConfig.ignorePatterns,
  };
}

function readWorkspaceConfig(projectRoot, workspaceRoot) {
  const rootConfig = readConfig(projectRoot);
  const workspacePackageJson =
    readJsonFile(path.join(workspaceRoot, "package.json")) ?? {};
  const workspacePackageConfig = workspacePackageJson.rindaman ?? {};
  const workspaceFileConfig =
    readJsonFile(path.join(workspaceRoot, ".rindamanrc.json")) ?? {};

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
    security: {
      ...rootConfig.security,
      ...(workspacePackageConfig.security ?? {}),
      ...(workspaceFileConfig.security ?? {}),
    },
    ignorePatterns:
      workspaceFileConfig.ignorePatterns ??
      workspacePackageConfig.ignorePatterns ??
      rootConfig.ignorePatterns,
  };
}

function applyFlagOverrides(config, cliArgs, readFlagValue, readDebtModeFlag) {
  return {
    ...config,
    changedOnly: cliArgs.flags.has("--all")
      ? false
      : cliArgs.flags.has("--changed-only")
        ? true
        : config.changedOnly,
    strictWarnings: cliArgs.flags.has("--strict") ? true : config.strictWarnings,
    writeReport: cliArgs.flags.has("--report")
      ? true
      : cliArgs.flags.has("--no-report")
        ? false
        : config.writeReport,
    reportPath: readFlagValue(cliArgs.commandArgs, "--report-path") ?? config.reportPath,
    allowPackageInstall: cliArgs.flags.has("--allow-install")
      ? true
      : config.allowPackageInstall,
    baseRef: readFlagValue(cliArgs.commandArgs, "--base") ?? config.baseRef,
    debtMode: readDebtModeFlag(cliArgs.commandArgs) ?? config.debtMode,
    failOnExistingDebt: cliArgs.flags.has("--fail-existing")
      ? true
      : config.failOnExistingDebt,
    baselinePath:
      readFlagValue(cliArgs.commandArgs, "--baseline-path") ?? config.baselinePath,
    useBaseline: cliArgs.flags.has("--no-baseline") ? false : config.useBaseline,
  };
}

module.exports = {
  readJsonFile,
  createDefaultConfig,
  readConfig,
  readWorkspaceConfig,
  applyFlagOverrides,
};
