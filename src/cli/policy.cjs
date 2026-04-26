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

function getExitCodeForStatus(status, auditMode, EXIT_OK, EXIT_QUALITY_BLOCKER) {
  if (auditMode) {
    return EXIT_OK;
  }

  if (status === "failed") {
    return EXIT_QUALITY_BLOCKER;
  }

  return EXIT_OK;
}

function getWorkspaceAggregateStatus(workspaceResults) {
  return workspaceResults.some((workspaceResult) =>
    ["failed", "audit_failed", "error"].includes(workspaceResult.status),
  )
    ? "failed"
    : "passed";
}

module.exports = {
  createDebtResult,
  getOverallStatus,
  getExitCodeForStatus,
  getWorkspaceAggregateStatus,
};
