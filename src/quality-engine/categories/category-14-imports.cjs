const fs = require("fs");

// Detects: star imports, default lodash-style imports, missing `import type`,
// and duplicate imports from the same module path.
module.exports = {
  name: "🟡 Category 14: Import Slop",
  run(context, reporter) {
    let clean = true;

    for (const file of context.tsFiles) {
      const lines = fs.readFileSync(file, "utf8").split("\n");
      const seenSources = new Map(); // source -> first line number

      lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (!trimmed.startsWith("import ")) return;
        const loc = `${file}:${i + 1}`;

        // 1. Namespace / star imports
        if (/import\s+\*\s+as\s+/.test(trimmed)) {
          reporter.warn(`Namespace import (import * as) at ${loc} — prefer named imports`);
          reporter.note(`→ ${trimmed.slice(0, 80)}`);
          clean = false;
        }

        // 2. Default import of heavy utility libraries (use named imports instead)
        const defaultLibMatch = trimmed.match(/^import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/);
        if (defaultLibMatch) {
          const [, alias, src] = defaultLibMatch;
          const heavyLibs = ["lodash", "ramda", "underscore", "rxjs", "moment", "dayjs"];
          if (heavyLibs.some((lib) => src === lib || src.startsWith(`${lib}/`))) {
            reporter.warn(`Default import of "${src}" at ${loc} — use named import { ${alias} }`);
            clean = false;
          }
        }

        // 3. Type-only imports not using `import type`
        // Flag: `import { SomeType }` from a known types file without `type` keyword
        const namedImportMatch = trimmed.match(/^import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/);
        if (namedImportMatch && !trimmed.startsWith("import type")) {
          const [, names, src] = namedImportMatch;
          // Heuristic: if source is a types/interfaces file and all names are PascalCase
          const isPureTypeSource = /\/(types|interfaces|models|schemas|dtos?)\b/.test(src);
          const allPascal = names.split(",").map((n) => n.trim().split(/\s+as\s+/)[0].trim())
            .every((n) => /^[A-Z]/.test(n) && !/[a-z][A-Z]/.test(n.slice(1)));
          if (isPureTypeSource && allPascal) {
            reporter.warn(`Missing "import type" for type-only import at ${loc}`);
            reporter.note(`→ ${trimmed.slice(0, 80)}`);
            clean = false;
          }
        }

        // 4. Duplicate imports from the same source
        const srcMatch = trimmed.match(/from\s+['"]([^'"]+)['"]/);
        if (srcMatch) {
          const src = srcMatch[1];
          if (seenSources.has(src)) {
            reporter.warn(`Duplicate import from "${src}" at ${loc} (first at line ${seenSources.get(src)})`);
            clean = false;
          } else {
            seenSources.set(src, i + 1);
          }
        }
      });
    }

    if (clean) reporter.pass("No import slop found.");
  },
};
