const fs = require("fs");

// CQS: a function should either command (mutate state) OR query (return a value), not both.
// Exemptions scoped tightly to React hooks that explicitly return handlers (not all handle*/use*).
const MUTATION_PATTERNS = [
  /\b(setState|setCount|setError|setLoading|setIsOpen|setData|setSelected)\s*\(/,
  /\bdispatch\s*\(/,
  /\bref\.current\s*=/,
  /\bthis\.\w+\s*=/,
  /\bdb\.\w+\s*\(/,
  /\brepository\.\w+\s*\(/,
];

// These return-types signal a pure query and should NOT be flagged even with mutations
const QUERY_EXEMPTIONS = /:\s*(boolean|string|number|string\[\]|number\[\]|void|Promise<void>)\s*[{=]/;

module.exports = {
  name: "🔴 Category 15: Command-Query Violations",
  run(context, reporter) {
    if (context.sourceFiles.length === 0) {
      reporter.pass("No source files changed.");
      return;
    }

    let clean = true;

    for (const file of context.sourceFiles) {
      const isGo = file.endsWith(".go");
      const content = fs.readFileSync(file, "utf8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        let isFn = false, fnName = "";
        if (isGo) {
          const fnMatch = trimmed.match(/^func\s+(?:\([^)]+\)\s+)?(\w+)\s*\(/);
          if (fnMatch) { isFn = true; fnName = fnMatch[1]; }
        } else {
          const fnMatch = trimmed.match(/^(?:export\s+)?(?:async\s+)?function\s+([a-z]\w+)/) ||
                        trimmed.match(/^(?:export\s+)?const\s+([a-z]\w+)\s*=\s*(?:async\s+)?\(/);
          if (fnMatch) { 
            isFn = true; 
            fnName = fnMatch[1]; 
            if (fnName.startsWith("upsert") || fnName.startsWith("save") || fnName.startsWith("create") || fnName.startsWith("seed")) continue;
          }
        }
        
        if (!isFn || fnName.startsWith("use")) continue;

        // Collect body
        let depth = 0, started = false, bodyLines = [];
        for (let j = i; j < Math.min(i + 100, lines.length); j++) {
          const l = lines[j];
          const opens = (l.match(/\{/g) || []).length, closes = (l.match(/\}/g) || []).length;
          if (opens > 0) started = true;
          if (started) {
            depth += opens - closes;
            bodyLines.push(l);
            if (depth <= 0) break;
          }
        }
        const bodyLinesJoined = bodyLines.join("\n");

        const hasMutation = isGo ? 
          /\.(Update|Delete|Create|Set|Add)\b|\w+\.\w+\s*=/.test(bodyLinesJoined) :
          MUTATION_PATTERNS.some(p => p.test(bodyLinesJoined));

        const hasReturn = isGo ?
          /\breturn\s+([^\s;]+)/.test(bodyLinesJoined) :
          /\breturn\s+[^\s;{]/.test(bodyLinesJoined);

        if (hasMutation && hasReturn) {
          let isExempt = false;
          if (isGo) {
            // In Go, return error is okay for a command. (T, error) is a query.
            // Check return signature on the line i
            const sig = lines[i].slice(lines[i].lastIndexOf(")") + 1).trim();
            isExempt = sig.startsWith("error") || sig === "{" || sig === "";
          } else {
            isExempt = QUERY_EXEMPTIONS.test(line);
          }

          if (!isExempt) {
            reporter.warn(`CQS violation: "${fnName}" mutates and returns in ${file}:${i + 1}`);
            clean = false;
          }
        }
      }
    }

    if (clean) reporter.pass("No Command-Query violations found.");
  },
};
