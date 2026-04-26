const fs = require("fs");

const MAGIC_IN_CALLS = [
  // setTimeout/setInterval with raw ms
  /\b(?:setTimeout|setInterval)\s*\([^,]+,\s*(\d{3,})\s*\)/,
  // zIndex with high numbers
  /zIndex\s*[=:]\s*(\d{3,})/,
  // maxLength, minLength in JSX
  /(?:maxLength|minLength|maxSize|maxCount)\s*[={]\s*(\d{3,})/,
];

// Numbers that are always self-explaining in context
const WHITELIST = new Set([
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 16, 20, 24, 30, 32,
  60, 64, 100, 128, 200, 201, 204, 256, 300, 301, 302, 400, 401,
  403, 404, 409, 422, 429, 500, 502, 503, 512, 1000, 1024,
  1440, 1080, 1920, 2560, 3000, 3001, 5173, 8080, 8000, 65535,
]);

module.exports = {
  name: "🟡 Category 7: Magic Numbers",
  run(context, reporter) {
    if (context.sourceFiles.length === 0) {
      reporter.pass("No source files changed.");
      return;
    }

    const COMPARISON_MAGIC = /(?:>|<|>=|<=|===|!==|==|!=)\s*(\d{2,})/;
    let clean = true;

    for (const file of context.sourceFiles) {
      const lines = fs.readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("import ") || trimmed.startsWith("package ")) return;
        const loc = `${file}:${i + 1}`;

        // Check comparisons
        const cmpMatch = COMPARISON_MAGIC.exec(line);
        if (cmpMatch) {
          const num = Number(cmpMatch[1]);
          if (!WHITELIST.has(num)) {
            reporter.warn(`Magic number (${num}) in comparison at ${loc}`);
            clean = false;
          }
        }

        // Check function calls (setTimeout, zIndex, maxLength, or Go timeouts)
        for (const regex of MAGIC_IN_CALLS) {
          const match = regex.exec(line);
          if (match) {
            const num = Number(match[1]);
            if (!WHITELIST.has(num)) {
              reporter.warn(`Magic number (${num}) in call/prop at ${loc}`);
              clean = false;
            }
          }
        }
      });
    }

    if (clean) reporter.pass("No unexplained magic numbers found.");
  },
};
