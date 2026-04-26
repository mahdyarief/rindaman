const fs = require("fs");
const path = require("path");

function findProjectRoot(filePath) {
  let currentDir = path.dirname(filePath);
  let root = path.parse(currentDir).root;
  while (currentDir !== root) {
    if (fs.existsSync(path.join(currentDir, "package.json"))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  return process.cwd();
}

module.exports = {
  name: "🔴 Category 21: Slopsquatting — Hallucinated Package Names",
  run(context, reporter) {
    const projectRoot =
      context.sourceFiles.length > 0 ? findProjectRoot(context.sourceFiles[0]) : process.cwd();

    let deps = new Set();
    const pkgPaths = [
      path.resolve(projectRoot, "package.json"),
      path.resolve(projectRoot, "client", "package.json"),
      path.resolve(projectRoot, "server", "package.json"),
      path.resolve(projectRoot, "apps", "client", "package.json"),
      path.resolve(projectRoot, "apps", "server", "package.json"),
    ];

    for (const pkgPath of pkgPaths) {
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
          Object.keys(pkg.dependencies || {}).forEach((d) => deps.add(d));
          Object.keys(pkg.devDependencies || {}).forEach((d) => deps.add(d));
          Object.keys(pkg.peerDependencies || {}).forEach((d) => deps.add(d));
        } catch (e) {}
      }
    }

    const slopsquattingPatterns = [
      /_advanced\b/,
      /_pro\b/,
      /_plus\b/,
      /_enhanced\b/,
      /_ultra\b/,
      /^auto[-_]/,
      /^smart[-_]/,
      /_analyzer\b/,
      /_optimizer\b/,
    ];

    const builtins = new Set([
      "fs",
      "path",
      "crypto",
      "events",
      "http",
      "https",
      "os",
      "stream",
      "util",
      "child_process",
      "url",
      "zlib",
      "bun",
    ]);

    const knownPackages = new Set([
      "xlsx",
      "better-auth",
      "drizzle-orm",
      "drizzle-kit",
      "hono",
      "zod",
      "nodemailer",
      "resend",
      "bcryptjs",
      "uuid",
      "nanoid",
      "react",
      "react-dom",
      "react-i18next",
      "react-hook-form",
      "@tanstack/react-query",
      "@tanstack/react-router",
      "@hono/zod-validator",
    ]);
    let slopsquatClean = true;

    for (const file of context.sourceFiles) {
      if (
        !file.endsWith(".ts") &&
        !file.endsWith(".tsx") &&
        !file.endsWith(".js") &&
        !file.endsWith(".jsx")
      )
        continue;

      const lines = fs.readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        const importMatch = line.match(
          /(?:from\s+|require\s*\(\s*|import\s*\(\s*)['"]([^'".][^'"]*)['"]/
        );
        if (!importMatch) return;

        let rawPkg = importMatch[1];
        if (rawPkg.startsWith("node:") || builtins.has(rawPkg) || rawPkg.startsWith("@/")) return;

        let pkgName = rawPkg.startsWith("@")
          ? rawPkg.split("/").slice(0, 2).join("/")
          : rawPkg.split("/")[0];

        if (deps.size > 0 && !deps.has(pkgName) && !knownPackages.has(pkgName)) {
          reporter.fail(
            `Slopsquatting risk: package "${pkgName}" is NOT in package.json at ${file}:${i + 1}`
          );
          slopsquatClean = false;
        } else if (deps.size === 0) {
          const matched = slopsquattingPatterns.find((p) => p.test(pkgName));
          if (matched) {
            reporter.fail(
              `Slopsquatting risk: suspicious package "${pkgName}" at ${file}:${i + 1}`
            );
            slopsquatClean = false;
          }
        }
      });
    }
    if (slopsquatClean) reporter.pass("No hallucinated-package-name patterns found.");
  },
};
