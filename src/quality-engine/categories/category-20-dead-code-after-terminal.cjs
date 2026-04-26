const fs = require("fs");

module.exports = {
  name: "🟡 Category 20: Dead Code After Return/Throw",
  run(context, reporter) {
    const tsTerminalRegex = /^\s*(return|throw)\b/;
    const goTerminalRegex = /^\s*(return|panic)\b/;
    
    let clean = true;

    for (const file of context.sourceFiles) {
      const isGo = file.endsWith(".go");
      const terminalRegex = isGo ? goTerminalRegex : tsTerminalRegex;
      
      const lines = fs.readFileSync(file, "utf8").split("\n");
      for (let i = 0; i < lines.length - 1; i++) {
        const currentLine = lines[i];
        if (!terminalRegex.test(currentLine)) continue;
        
        const currentTrimmed = currentLine.trim();
        const nextLine = lines[i + 1];
        const nextTrimmed = nextLine.trim();

        // Check for single-line if statement without braces (TS only)
        if (!isGo) {
          const prevTrimmed = i > 0 ? lines[i-1].trim() : "";
          const isGuardedByIf = /^(if|else|try|catch|finally)\b/.test(prevTrimmed) && !prevTrimmed.endsWith("{");
          const startsWithIf = /^(if|else|try|catch|finally)\b/.test(currentTrimmed);
          if (isGuardedByIf || startsWithIf) continue;
        }

        if (
          nextTrimmed &&
          !currentTrimmed.endsWith("(") &&
          !currentTrimmed.endsWith("{") &&
          !currentTrimmed.endsWith("[") &&
          !currentTrimmed.endsWith(".") &&
          !currentTrimmed.endsWith("?.") &&
          !currentTrimmed.endsWith("=>") &&
          !currentTrimmed.endsWith(",") &&
          !nextTrimmed.startsWith(".") &&
          !nextTrimmed.startsWith("?.") &&
          !nextTrimmed.startsWith("?") &&
          !nextTrimmed.startsWith(":") &&
          !nextTrimmed.startsWith("}") &&
          !nextTrimmed.startsWith("//") &&
          !nextTrimmed.startsWith("*") &&
          !nextTrimmed.startsWith("case ") &&
          !nextTrimmed.startsWith("default:")
        ) {
          reporter.warn(`Dead code after terminal statement at ${file}:${i + 2}`);
          clean = false;
        }
      }
    }
    if (clean) reporter.pass("No dead code after terminal found.");
  }
};
