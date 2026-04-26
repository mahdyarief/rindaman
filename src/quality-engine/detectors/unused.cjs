const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function getLocalBinary(rootDir, binaryName) {
  const extension = process.platform === "win32" ? ".cmd" : "";
  return path.join(rootDir, "node_modules", ".bin", binaryName + extension);
}

function runKnip(rootDir) {
  const localKnip = getLocalBinary(rootDir, "knip");

  if (!fs.existsSync(localKnip)) {
    return { status: null, stdout: "", stderr: "knip is not installed locally; skipped to avoid package auto-install." };
  }

  let result = spawnSync(localKnip, [], {
    cwd: rootDir,
    encoding: "utf8",
    stdio: "pipe",
  });

  return result;
}

module.exports = {
  name: "🔵 Pillar 4: Unused Detection (knip)",
  run(context, reporter) {
    reporter.note("Running comprehensive unused scan via knip...");

    const rootDir = context.projectRoot || process.cwd();
    const result = runKnip(rootDir);

    if (result && result.status === 0) {
      reporter.pass("No unused files, dependencies, or exports found.");
      return;
    }

    const output = [result && result.stdout, result && result.stderr].filter(Boolean).join("\n").trim();
    if (output) {
      reporter.warn("Knip found dead code or unused files. Check output:");
      reporter.note(output);
    } else {
      reporter.warn("Could not execute Unused Detector (knip failed to run).");
    }
  },
};
