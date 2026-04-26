const fs = require("fs");

module.exports = {
  name: "🔴 Category 2: Type Safety Bypasses",
  run(context, reporter) {
    if (context.sourceFiles.length === 0) {
      reporter.pass("No source files changed.");
      return;
    }

    let clean = true;

    for (const file of context.tsFiles) {
      // Skip generated files
      if (/\.gen\.(ts|tsx)$/.test(file)) continue;

      const content = fs.readFileSync(file, "utf8");
      const lines = content.split("\n");

      lines.forEach((line, i) => {
        const trimmed = line.trim();
        const loc = `${file}:${i + 1}`;
        if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;

        // 1. @ts-ignore
        if (/@ts-ignore/.test(line)) {
          const prevLine = lines[i - 1]?.trim() ?? "";
          if (!prevLine.startsWith("//")) {
            reporter.fail(`@ts-ignore with no justification at ${loc}`);
            clean = false;
          }
        }

        // 2. @ts-expect-error
        if (/@ts-expect-error\s*$/.test(line)) {
          reporter.fail(`@ts-expect-error with no inline comment at ${loc}`);
          clean = false;
        }

        // 3. Double-cast
        if (/\bas\s+unknown\s+as\s+/.test(line) && !trimmed.startsWith("//")) {
          reporter.warn(`Double-cast "as unknown as" at ${loc}`);
          clean = false;
        }

        // 4. as any
        if (/\bas\s+any\b/.test(line) && !trimmed.startsWith("//")) {
          reporter.fail(`"as any" cast at ${loc}`);
          clean = false;
        }
      });
    }

    for (const file of context.goFiles) {
      const content = fs.readFileSync(file, "utf8");
      const lines = content.split("\n");

      lines.forEach((line, i) => {
        const trimmed = line.trim();
        const loc = `${file}:${i + 1}`;
        if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;

        // Pattern for any/interface{} in Go (e.g., variables or parameters)
        // Skip common standard patterns like map[string]any or []any which are idiomatic
        if (
          (/\bany\b/.test(line) || /\binterface\{\}/.test(line)) &&
          !/(map\[string\]|\[\])(any|interface\{\})/.test(line) &&
          !/(SendSuccess|SendError|SendTemplate|ExecuteTemplate|Log|Decode)\(/.test(line) &&
          !trimmed.includes("// intentional")
        ) {
          // Check if it's a generic parameter or return type specifically
          if (/\bfunc\s+.*(any|interface\{\})/.test(line)) {
            reporter.warn(`Generic "any" or "interface{}" in function signature at ${loc}`);
            clean = false;
          }
        }
      });
    }

    if (clean) reporter.pass("No severe type bypasses found.");
  },
};
