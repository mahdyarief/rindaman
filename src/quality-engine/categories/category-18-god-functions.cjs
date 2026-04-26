const fs = require("fs");

module.exports = {
  name: "🟡 Category 18: God Functions",
  run(context, reporter) {
    const GOD_FUNCTION_LINE_THRESHOLD = 100;
    const GOD_FUNCTION_CC_THRESHOLD = 15;
    
    let godClean = true;
    for (const file of context.tsFiles) {
      const content = fs.readFileSync(file, "utf8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!/(?:^|\s)(?:async\s+)?function\s+\w|(?:const|let)\s+\w+\s*=\s*(?:async\s+)?\(/.test(line)) continue;

        let depth = 0;
        let started = false;
        let logicLines = 0;
        let ccCount = 0;

        for (let j = i; j < Math.min(i + 200, lines.length); j++) {
          const l = lines[j].trim();
          const opens = (lines[j].match(/\{/g) || []).length;
          const closes = (lines[j].match(/\}/g) || []).length;
          if (opens > 0) started = true;
          if (started) {
            depth += opens - closes;
            if (l && !l.startsWith("//") && !l.startsWith("*") && l !== "{" && l !== "}") logicLines++;
            const branchMatches = lines[j].match(/\b(if|else if|for|while|switch|catch)\b/g) || [];
            ccCount += branchMatches.length;
          }
          if (started && depth <= 0) break;
        }

        if (logicLines > GOD_FUNCTION_LINE_THRESHOLD || ccCount > GOD_FUNCTION_CC_THRESHOLD) {
          const fnName = (line.match(/function\s+(\w+)/) || line.match(/(?:const|let)\s+(\w+)/))?.[1] || "(anonymous)";
          reporter.arch("GOD", `God function [${fnName}] at ${file}:${i + 1} — ${logicLines} logic lines, ~${ccCount} branches`);
          godClean = false;
        }
      }
    }
    if (godClean) reporter.pass("No god functions found.");
  }
};
