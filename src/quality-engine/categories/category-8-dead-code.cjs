const fs = require("fs");

module.exports = {
  name: "🟡 Category 8: Dead Code",
  run(context, reporter) {
    let deadCodeClean = true;
    for (const file of context.tsFiles) {
      const lines = fs.readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (/^\s*\/\/\s*(const|let|var|function|return|if|for|import|export|type|interface)\b/.test(line)) {
          reporter.warn(`Commented-out code at ${file}:${i + 1}`);
          reporter.note(`→ ${line.trim().slice(0, 80)}`);
          deadCodeClean = false;
        }
        if (
          /\b(isDebug|debugMode|showBoundingBox|showHitArea|devMode)\b/.test(line)
        ) {
          reporter.warn(`Debug prop/flag detected at ${file}:${i + 1}`);
          reporter.note(`→ ${line.trim().slice(0, 80)}`);
          deadCodeClean = false;
        }
      });
    }
    if (deadCodeClean) reporter.pass("No obvious dead code or debug flags found.");
    reporter.note("Tip: run 'npx ts-prune' for unused exports and 'npx biome check .' for unused imports.");
  }
};
