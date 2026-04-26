const fs = require("fs");

const IMPURE_PATTERNS = [
  {
    regex: /\b\w+\.push\s*\(/,
    label: "Array Mutation (.push)",
    rule: "Use immutable spread operator [...array, item] or .flatMap() for performant single-pass transformations instead of .push()",
  },
  {
    regex: /\b\w+\.(?:splice|shift|unshift)\s*\(/,
    label: "Array Mutation (.splice / .shift / .unshift)",
    rule: "Use immutable array methods (slice, filter) or spread syntax",
  },
  {
    regex: /\bdelete\s+[\w\[\]\.]*[\.\[][\w\[\]\.]*/,
    label: "Object Mutation (delete)",
    rule: "Return a new object without the key using destructing instead of `delete`",
  },
  {
    regex: /\bObject\.assign\s*\(/,
    label: "Legacy Object Assignment",
    rule: "Use object spread syntax: { ...obj1, ...obj2 } instead of Object.assign",
  },
  {
    regex: /\.filter\s*\([^)]+\)\s*\.map\s*\([^)]+\)/,
    label: "Double-Pass Array Transformation (.filter().map())",
    rule: "Use a single-pass .flatMap() for optimal performance and memory",
  },
];

module.exports = {
  name: "🔴 Category 24: Functional Purity & Immutability",
  run(context, reporter) {
    if (context.tsFiles.length === 0) {
      reporter.pass("No TypeScript/TSX files changed.");
      return;
    }

    let clean = true;

    for (const file of context.tsFiles) {
      const lines = fs.readFileSync(file, "utf8").split("\n");

      lines.forEach((line, i) => {
        const trimmed = line.trim();
        // Skip comments and imports
        if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*") || trimmed.startsWith("import ")) return;

        const loc = `${file}:${i + 1}`;

        for (const { regex, label, rule } of IMPURE_PATTERNS) {
          if (regex.test(line)) {
            // New: Basic check for string encapsulation by checking if it happens between quotes
            // This is a naive check but clears the majority of log/error false positives.
            const matchIndex = line.indexOf(line.match(regex)[0]);
            const textBefore = line.slice(0, matchIndex);
            const quoteCount = (textBefore.match(/['"`]/g) || []).length;
            if (quoteCount % 2 !== 0) continue;

            reporter.warn(`${label} at ${loc}`);
            reporter.note(`↳ ${rule}`);
            reporter.note(`→ ${trimmed.slice(0, 80)}`);
            clean = false;
          }
        }
      });
    }

    if (clean) reporter.pass("No functional purity violations found. Immutability respected.");
  },
};
