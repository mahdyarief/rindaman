const fs = require("fs");
const path = require("path");
const { run } = require("./utils.cjs");

class Context {
  constructor(explicitFiles = []) {
    this.isExplicit = explicitFiles.length > 0;
    
    const diffRaw = run("git diff main --name-only")
      .split("\n")
      .map((f) => f.trim())
      .filter((f) => f.length > 0);

    this.diffFiles = this.isExplicit 
      ? diffRaw.filter(f => explicitFiles.includes(f))
      : diffRaw;

    // Collect all source files currently tracked by git or provided via CLI
    const allFiles = this.isExplicit 
      ? explicitFiles.filter(f => fs.existsSync(f))
      : run("git ls-files").split("\n").filter(Boolean);
    
    const ignorePath = path.join(__dirname, "..", ".slopignore");
    const ignorePatterns = [];
    if (fs.existsSync(ignorePath)) {
      fs.readFileSync(ignorePath, "utf8")
        .split("\n")
        .map(l => l.trim())
        .filter(l => l && !l.startsWith("#"))
        .forEach(pattern => {
          const isNegative = pattern.startsWith("!");
          const raw = isNegative ? pattern.slice(1) : pattern;
          // Simple glob-to-regex or substring matching
          ignorePatterns.push({ isNegative, raw });
        });
    }

    const sourceFilePaths = allFiles.filter(f => {
      const isSource = f.endsWith(".ts") || f.endsWith(".tsx") || f.endsWith(".go") || f.endsWith(".js") || f.endsWith(".jsx");
      if (!isSource) return false;

      // Apply ignore patterns
      let ignored = false;
      for (const { isNegative, raw } of ignorePatterns) {
        if (f.includes(raw) || (raw.startsWith("*") && f.endsWith(raw.slice(1)))) {
          ignored = !isNegative;
        }
      }
      if (ignored) return false;

      // Built-in safety (overridable via !)
      if (f.includes("node_modules/") || f.includes("vendor/")) return false;

      return true;
    });

    this.sourceFiles = sourceFilePaths.filter(f => {
      try {
        const stats = fs.statSync(f);
        if (stats.size > 200 * 1024) return false; 
        
        const fd = fs.openSync(f, 'r');
        const buffer = Buffer.alloc(100);
        fs.readSync(fd, buffer, 0, 100, 0);
        fs.closeSync(fd);
        const header = buffer.toString('utf8');
        
        if (header.includes("Code generated") || 
            header.includes("DO NOT EDIT") ||
            header.includes("@generated")) {
          return false;
        }
        return true;
      } catch (e) {
        return false;
      }
    });

    this.tsFiles = this.sourceFiles.filter(f => f.endsWith(".ts") || f.endsWith(".tsx"));
    this.goFiles = this.sourceFiles.filter(f => f.endsWith(".go"));

    this.changedFiles = Array.from(new Set([...this.diffFiles, ...allFiles]))
      .filter((f) => fs.existsSync(f));

    this.testFiles = this.changedFiles.filter(
      (f) =>
        (f.includes(".test.") || f.includes(".spec.") || f.endsWith("_test.go")) &&
        !f.includes("node_modules"),
    );

    this.sourceFiles = [...this.tsFiles, ...this.goFiles];
  }
}

module.exports = { Context };
