const fs = require("node:fs");
const path = require("node:path");

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

module.exports = {
  readBaselineFile,
  getFailedCheckNames,
  writeBaselineFile,
};
