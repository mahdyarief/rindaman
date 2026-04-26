const fs = require("fs");
const { execSync } = require("child_process");
const path = require("path");

// Regex fallback for the highest-value naming violations (runs even if ESLint fails)
const FORBIDDEN_VAR_NAMES = /\b(?:const|let|var)\s+(data|result|temp|info|stuff|items?|obj|arr|list)\s*=/;
const FORBIDDEN_DESTRUCTURE = /\bconst\s+\{\s*data\s*[,}](?!\s*:\s*\w)/; // const { data } = ... without rename

module.exports = {
  name: "🔴 Category 4: Naming Banalities",
  run(context, reporter) {
    if (context.sourceFiles.length === 0) {
      reporter.pass("No source files changed.");
      return;
    }

    let clean = true;

    // TS Regex
    const FORBIDDEN_VAR_NAMES_TS = /\b(?:const|let|var)\s+(data|result|temp|info|stuff|items?|obj|arr|list)\s*=/;
    const FORBIDDEN_DESTRUCTURE_TS = /\bconst\s+\{\s*data\s*[,}](?!\s*:\s*\w)/;

    // Go Regex
    // Matches e.g. "func Name(data any)" or "var res result" or "item := ..."
    const FORBIDDEN_VAR_NAMES_GO = /:=|var\s+|func\s+.*\(\s*(data|result|res|temp|info|stuff|items?|obj|arr|list)\b/;

    for (const file of context.tsFiles) {
      const lines = fs.readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("import ")) return;

        if (FORBIDDEN_VAR_NAMES_TS.test(line)) {
          const match = line.match(FORBIDDEN_VAR_NAMES_TS);
          reporter.warn(`Generic variable name "${match[1]}" at ${file}:${i + 1}`);
          clean = false;
        }
        if (FORBIDDEN_DESTRUCTURE_TS.test(line)) {
          reporter.warn(`Unaliased "data" destructure at ${file}:${i + 1}`);
          clean = false;
        }
      });
    }

    for (const file of context.goFiles) {
      const lines = fs.readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("import ") || trimmed.startsWith("package ")) return;

        if (FORBIDDEN_VAR_NAMES_GO.test(line)) {
          const match = line.match(FORBIDDEN_VAR_NAMES_GO);
          const name = match[1] || trimmed.split(/\s|:=/)[0];
          if (/^(data|result|res|temp|info|stuff|items?|obj|arr|list)$/.test(name)) {
            reporter.warn(`Generic naming "${name}" at ${file}:${i + 1}`);
            clean = false;
          }
        }
      });
    }

    if (clean) reporter.pass("No severe naming banalities found.");
  },
};
