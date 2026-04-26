const fs = require("fs");
const path = require("path");

const BUZZWORD_IN_COMMENT = /\/\/.*\b(optimized|efficient|seamless|robust|ensures|provides|scalable|maintainable|enterprise.grade|production.ready)\b/i;
const REDUNDANT_PARAM = /@param\s+\{?[\w<>[\]|, ]+\}?\s+(\w+)\s+-\s+[Tt]he\s+\1/;
const REDUNDANT_RETURNS = /@returns?\s+[Tt]he\s+(processed\s+)?(data|result|item|value|response)/i;
const README_BOILERPLATE = [
  "Welcome to our", "This project is built with", "Getting started with this amazing",
  "A modern, scalable", "Built with cutting-edge", "Seamlessly integrates",
  "Provides a robust", "Ensures code quality",
];

module.exports = {
  name: "🔴 Category 5: Documentation Bloat",
  run(context, reporter) {
    let clean = true;

    // 1. README boilerplate scan
    const readmePath = path.join(process.cwd(), "README.md");
    if (fs.existsSync(readmePath)) {
      const readmeLines = fs.readFileSync(readmePath, "utf8").split("\n");
      readmeLines.forEach((line, i) => {
        if (README_BOILERPLATE.some((b) => line.includes(b))) {
          reporter.fail(`README boilerplate at line ${i + 1}: "${line.trim().slice(0, 80)}"`);
          clean = false;
        }
      });
    }

    for (const file of context.tsFiles) {
      const content = fs.readFileSync(file, "utf8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 2. Buzzword in inline comment
        if (BUZZWORD_IN_COMMENT.test(line)) {
          reporter.warn(`Buzzword in comment at ${file}:${i + 1}: "${line.trim().slice(0, 80)}"`);
          clean = false;
        }

        // 3. TSDoc block analysis
        if (!line.includes("/**")) continue;
        // Collect the block
        const blockLines = [];
        for (let j = i; j < Math.min(i + 40, lines.length); j++) {
          blockLines.push(lines[j]);
          if (lines[j].includes("*/")) break;
        }
        const block = blockLines.join("\n");

        // 3a. @param <name> - The <name> (restates param name)
        if (REDUNDANT_PARAM.test(block)) {
          reporter.fail(`Redundant @param doc at ${file}:${i + 1} ("@param x - The x")`);
          clean = false;
        }

        // 3b. @returns The data/result/value
        if (REDUNDANT_RETURNS.test(block)) {
          reporter.fail(`Redundant @returns doc at ${file}:${i + 1} ("@returns The data")`);
          clean = false;
        }

        // 3c. Doc block longer than 8 lines over a short function (< 3 logic lines)
        const blockLineCount = blockLines.length;
        if (blockLineCount > 8) {
          const afterBlock = lines.slice(i + blockLineCount, i + blockLineCount + 6).join("\n");
          const logicLineCount = afterBlock
            .split("\n")
            .filter((l) => {
              const t = l.trim();
              return t && !t.startsWith("//") && t !== "{" && t !== "}" && !t.startsWith("*");
            }).length;
          if (logicLineCount <= 3) {
            reporter.warn(`Over-documented simple function at ${file}:${i + 1} (${blockLineCount}-line doc, ${logicLineCount} logic lines)`);
            clean = false;
          }
        }
      }
    }

    if (clean) reporter.pass("No documentation bloat found.");
  },
};
