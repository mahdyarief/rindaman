const fs = require("fs");
const { execSync } = require("child_process");
const path = require("path");

// Regex fallback for most obvious defensive theater patterns
const GUARANTEED_NULL_GUARD = /if\s*\(\s*!(\w+)\s*\)\s*return/;
const PRIOR_CONSTRUCTION = /const\s+\w+\s*=\s*\w+\s*\||\w+\s*\?\?\s*/;

module.exports = {
  name: "🟡 Category 13: Defensive Programming Theater",
  run(context, reporter) {
    if (context.tsFiles.length === 0) {
      reporter.pass("No TypeScript files changed.");
      return;
    }

    let clean = true;

    // Primary: ESLint no-unnecessary-condition + no-explicit-any
    try {
      const configPath = path.resolve(__dirname, "../../slop_eslint_config.cjs");
      const eslintBin = path.join(__dirname, "../../node_modules/eslint/bin/eslint.js");
      let eslintOutput = "";
      const CHUNK_SIZE = 40;
      for (let i = 0; i < context.tsFiles.length; i += CHUNK_SIZE) {
        const chunk = context.tsFiles.slice(i, i + CHUNK_SIZE);
        const filesArg = chunk.map((f) => `"${f}"`).join(" ");
        try {
          eslintOutput += execSync(
            `node.exe "${eslintBin}" --no-error-on-unmatched-pattern -c "${configPath}" ${filesArg} 2>&1`,
            { stdio: ["pipe", "pipe", "pipe"] },
          ).toString();
        } catch (e) {
          eslintOutput += e.stdout ? e.stdout.toString() : "";
        }
      }
      if (eslintOutput.includes("no-unnecessary-condition")) {
        reporter.fail("Defensive theater detected: unnecessary null-guard or condition (ESLint).");
        clean = false;
      }
    } catch {
      reporter.note("ESLint check unavailable — using regex fallback for defensive theater.");
    }

    // Fallback: flag `if (!val) return` patterns where val was just constructed
    for (const file of context.tsFiles) {
      const lines = fs.readFileSync(file, "utf8").split("\n");
      for (let i = 1; i < lines.length; i++) {
        const prev = lines[i - 1].trim();
        const curr = lines[i].trim();
        // Previous line constructs a value, next line guards it as if it can be null
        const constructsValue = /^const\s+(\w+)\s*=\s*(?:new\s+\w+|build\w+|create\w+|get\w+|make\w+)\s*\(/.exec(prev);
        if (constructsValue) {
          const varName = constructsValue[1];
          if (new RegExp(`if\\s*\\(!\\s*${varName}\\s*\\)`).test(curr)) {
            reporter.warn(`Unnecessary null-guard on "${varName}" at ${file}:${i + 1} — it was just constructed above`);
            clean = false;
          }
        }
      }
    }

    if (clean) reporter.pass("No defensive programming theater found.");
  },
};
