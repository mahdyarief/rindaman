const fs = require("fs");

const NESTING_KEYWORDS = /^\s*(if|else\s+if|for|while|switch|try)\b/;

// JSX lines that look like brace-depth but aren't logic nesting
const JSX_LINE = /^\s*(<\/?[A-Za-z][A-Za-z0-9.]*|<>|<\/>|\/>|^\s*\);\s*$)/;

module.exports = {
  name: "🟡 Category 19: Deep Nesting",
  run(context, reporter) {
    const tsKeywords = /^\s*(if|else\s+if|for|while|switch|try)\b/;
    const goKeywords = /^\s*(if|else\s+if|for|switch|select)\b/;
    const JSX_LINE = /^\s*(<\/?[A-Za-z][A-Za-z0-9.]*|<>|<\/>|\/>|^\s*\);\s*$)/;
    
    const THRESHOLD = 4;
    let clean = true;

    for (const file of context.sourceFiles) {
      const isTsx = file.endsWith(".tsx");
      const isGo = file.endsWith(".go");
      const keywords = isGo ? goKeywords : tsKeywords;
      
      const lines = fs.readFileSync(file, "utf8").split("\n");

      let logicDepth = 0, peakLogicDepth = 0, peakLine = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (isTsx && JSX_LINE.test(trimmed)) continue;

        const opens = (line.match(/\{/g) || []).length;
        const closes = (line.match(/\}/g) || []).length;
        logicDepth += opens - closes;
        if (logicDepth < 0) logicDepth = 0;

        if (keywords.test(line) && logicDepth > peakLogicDepth) {
          peakLogicDepth = logicDepth;
          peakLine = i + 1;
        }
      }

      if (peakLogicDepth > THRESHOLD) {
        reporter.warn(`Deep nesting (~${peakLogicDepth}) in ${file}:${peakLine}`);
        clean = false;
      }
    }

    if (clean) reporter.pass("No excessive control-flow nesting found.");
  },
};
