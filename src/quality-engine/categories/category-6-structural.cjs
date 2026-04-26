const fs = require("fs");

// Flags premature abstractions: single-method classes, unnecessary wrappers,
// and generic over-engineering class names with no real implementation breadth.
module.exports = {
  name: "🟡 Category 6: Structural Over-Engineering",
  run(context, reporter) {
    let clean = true;

    for (const file of context.tsFiles) {
      if (file.includes("node_modules") || file.includes(".d.ts")) continue;
      const content = fs.readFileSync(file, "utf8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // 1. Class with suspicious name — collect its public methods
        const classMatch = line.match(/^(?:export\s+)?(?:abstract\s+)?class\s+(\w+(?:Factory|Strategy|Adapter|Provider|Processor|Handler|Manager|Helper))\b/);
        if (classMatch) {
          const className = classMatch[1];
          // Count public methods in the next 60 lines
          let publicMethodCount = 0;
          for (let j = i + 1; j < Math.min(i + 60, lines.length); j++) {
            const l = lines[j].trim();
            if (/^(?:public\s+|async\s+|static\s+)*\w+\s*\(/.test(l) && !l.startsWith("//") && !l.startsWith("constructor")) {
              publicMethodCount++;
            }
            if (/^}/.test(l) && j > i + 2) break;
          }
          if (publicMethodCount === 1) {
            reporter.warn(`Single-method class "${className}" at ${file}:${i + 1} — consider a plain function`);
            clean = false;
          }
        }

        // 2. Wrapper function that only delegates to another function
        const wrapperMatch = line.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/);
        if (wrapperMatch) {
          const fnName = wrapperMatch[1];
          // Look for a single-statement body that just calls another fn with same args
          const bodyLine = lines[i + 1]?.trim() || "";
          const nextLine = lines[i + 2]?.trim() || "";
          if (
            bodyLine === "{" &&
            /^return\s+\w+\s*\(/.test(nextLine) &&
            (lines[i + 3]?.trim() === "}" || lines[i + 3]?.trim() === "};")
          ) {
            reporter.warn(`Wrapper function "${fnName}" at ${file}:${i + 1} only delegates — consider inlining`);
            clean = false;
          }
        }
      }
    }

    if (clean) reporter.pass("No obvious structural over-engineering found.");
  },
};
