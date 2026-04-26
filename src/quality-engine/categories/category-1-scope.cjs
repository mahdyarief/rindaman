const fs = require("fs");

module.exports = {
  name: "🔴 Category 1: Scope Creep",
  run(context, reporter) {
    const scopeSensitivePatterns = [
      { pattern: "tailwind.config", label: "Tailwind config" },
      { pattern: "vite.config", label: "Vite config" },
      { pattern: "vitest.config", label: "Vitest config" },
      { pattern: "drizzle.config", label: "Drizzle config" },
      { pattern: "postcss.config", label: "PostCSS config" },
      { pattern: "docker-compose", label: "Docker Compose" },
      { pattern: "tsconfig", label: "TypeScript config" },
      { pattern: "package.json", label: "package.json" },
      { pattern: "package-lock.json", label: "package-lock.json" },
      { pattern: ".gitignore", label: ".gitignore" },
      { pattern: "src/main.tsx", label: "Root entrypoint (main.tsx)" },
      { pattern: "index.html", label: "Root HTML" },
    ];

    let scopeClean = true;
    for (const f of context.diffFiles) {
      const match = scopeSensitivePatterns.find((p) => f.includes(p.pattern));
      if (match) {
        reporter.warn(`Out-of-scope file modified: ${f} (${match.label})`);
        scopeClean = false;
      }
    }

    // Diff size alarm
    const { run } = require("../core/utils.cjs");
    const diffCmd = context.isExplicit 
      ? `git diff main --shortstat -- ${context.changedFiles.join(" ")}`
      : `git diff main --shortstat`;
    const diffStat = run(diffCmd);
    const linesChanged = diffStat.match(/(\d+) insertion|(\d+) deletion/g);
    const totalLines = (linesChanged || []).reduce((sum, m) => {
      const n = parseInt(m.match(/\d+/)[0], 10);
      return sum + n;
    }, 0);
    if (totalLines > 300) {
      reporter.warn(`Large diff: ${totalLines} lines changed`);
      scopeClean = false;
    }

    if (scopeClean) reporter.pass("No out-of-scope config or entrypoint files modified.");
  }
};
