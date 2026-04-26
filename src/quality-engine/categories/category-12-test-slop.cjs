const fs = require("fs");

const HOLLOW_ASSERTIONS = [
  { regex: /\.toBeDefined\(\)/, label: "toBeDefined()" },
  { regex: /\.toBeTruthy\(\)/, label: "toBeTruthy()" },
  { regex: /\.toBeNull\(\)/, label: "toBeNull() — likely meaningless if value is always null" },
  { regex: /\.toEqual\(\[\]\)/, label: "toEqual([]) — proves nothing about correct behavior" },
  { regex: /\.toEqual\(\{\}\)/, label: "toEqual({}) — proves nothing about correct behavior" },
  { regex: /expect\(.*\)\.not\.toThrow\(\)/, label: "not.toThrow() — passes even if function noops" },
];

const INTERNAL_SPY = /expect\(.*spy.*\)\.toHaveBeenCalled\(\)|expect\(.*mock.*\)\.toHaveBeenCalled\(\)/i;
const MOCK_OF_SUT = /vi\.mock\(['"]\.\.?\//; // mocking a local module (relative path) = mocking own code

module.exports = {
  name: "🟡 Category 12: Test Slop",
  run(context, reporter) {
    if (context.testFiles.length === 0) {
      reporter.note("No test files changed — skipping.");
      reporter.pass("Test slop N/A.");
      return;
    }

    let clean = true;

    const vagueNames = [
      { regex: /it\(\s*['"]should work['"]/i, label: "should work" },
      { regex: /it\(\s*['"]should handle['"]/i, label: "should handle the case" },
      { regex: /it\(\s*['"]should do['"]/i, label: "should do" },
      { regex: /it\(\s*['"]test\s*\d/i, label: "test N" },
      { regex: /it\(\s*['"]\s*['"]/, label: "empty test name" },
    ];

    for (const file of context.testFiles) {
      const lines = fs.readFileSync(file, "utf8").split("\n");

      lines.forEach((line, i) => {
        const loc = `${file}:${i + 1}`;

        // Vague test names
        for (const { regex, label } of vagueNames) {
          if (regex.test(line)) {
            reporter.warn(`Vague test name ["${label}"] at ${loc}`);
            clean = false;
          }
        }

        // Snapshot abuse
        if (/toMatchSnapshot\(\)|toMatchInlineSnapshot/.test(line)) {
          reporter.warn(`Snapshot test at ${loc} — verifies "nothing changed", not correctness`);
          clean = false;
        }

        // Hollow assertions
        for (const { regex, label } of HOLLOW_ASSERTIONS) {
          if (regex.test(line)) {
            reporter.warn(`Hollow assertion [${label}] at ${loc}`);
            clean = false;
          }
        }

        // Spying on internals without verifying args
        if (INTERNAL_SPY.test(line)) {
          reporter.warn(`Spy-on-internals pattern at ${loc} — assert what the user sees, not internal calls`);
          clean = false;
        }

        // Mocking the module under test (relative path mock)
        if (MOCK_OF_SUT.test(line)) {
          reporter.warn(`Relative module mock at ${loc} — are you mocking the system under test?`);
          clean = false;
        }
      });

      // Test blocks without expect()
      let inBlock = false, blockStart = -1, hasExpect = false, depth = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/\bit\s*\(/.test(line) && !inBlock) {
          inBlock = true; blockStart = i + 1; hasExpect = false; depth = 0;
        }
        if (inBlock) {
          depth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
          if (/expect\(/.test(line)) hasExpect = true;
          if (depth <= 0 && blockStart !== -1) {
            if (!hasExpect) {
              reporter.warn(`Test block without expect() at ${file}:${blockStart}`);
              clean = false;
            }
            inBlock = false;
          }
        }
      }
    }

    if (clean) reporter.pass("No test slop patterns found.");
  },
};
