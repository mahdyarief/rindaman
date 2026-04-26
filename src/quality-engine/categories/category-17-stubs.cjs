const fs = require("fs");

module.exports = {
  name: "🔴 Category 17: Stub / Placeholder Functions",
  run(context, reporter) {
    const stubBodyRegex = /(?:function\s+\w+|=>)\s*\{\s*\}/;
    const ellipsisStubRegex = /(?:function\s+\w+|=>)\s*\{\s*\.\.\.\s*\}/;

    let stubClean = true;
    for (const file of context.tsFiles) {
      const content = fs.readFileSync(file, "utf8");
      const lines = content.split("\n");
      lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
        if (stubBodyRegex.test(line)) {
          reporter.fail(`Stub function (empty body) at ${file}:${i + 1}`);
          stubClean = false;
        }
        if (ellipsisStubRegex.test(line)) {
          reporter.fail(`Ellipsis stub at ${file}:${i + 1}`);
          stubClean = false;
        }
      });
    }
    if (stubClean) reporter.pass("No stub/placeholder function bodies found.");
  }
};
