const fs = require("fs");

module.exports = {
  name: "🔴 Category 3: Debug Artifacts Status",
  run(context, reporter) {
    const tsPatterns = [
      { regex: /console\.log\(/, label: "console.log" },
      { regex: /console\.warn\(/, label: "console.warn" },
      { regex: /\/\/\s*TODO(?!\([a-z]+\):)/i, label: "bare TODO" },
      { regex: /\/\/\s*FIXME/i, label: "FIXME" },
      { regex: /debugger;/, label: "debugger" },
    ];
    
    const goPatterns = [
      { regex: /\bfmt\.Print(ln|f)?\(/, label: "fmt.Print*" },
      { regex: /\blogger\.Debug(f)?\(/, label: "logger.Debug*" },
      { regex: /\/\/\s*TODO(?!\([a-z]+\):)/i, label: "bare TODO" },
      { regex: /\/\/\s*FIXME/i, label: "FIXME" },
    ];

    let clean = true;
    for (const file of context.sourceFiles) {
      const isGo = file.endsWith(".go");
      const patterns = isGo ? goPatterns : tsPatterns;
      
      const lines = fs.readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        for (const { regex, label } of patterns) {
          if (regex.test(line)) {
            if (line.includes("// intentional") || line.includes("// diagnostic")) continue;
            reporter.warn(`Debug artifact [${label}] in ${file}:${i + 1}`);
            clean = false;
          }
        }
      });
    }
    if (clean) reporter.pass("No debug artifacts found.");
  }
};
