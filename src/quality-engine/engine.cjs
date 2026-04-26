// ignore-sandi-metz
const { Context } = require("./core/context.cjs");
const { Reporter } = require("./core/reporter.cjs");
const { Runner } = require("./core/runner.cjs");

// Import Categories (Formal SKILL.md Numbering)
const cat1 = require("./categories/category-1-scope.cjs");
const cat2 = require("./categories/category-2-type-safety.cjs");
const cat3 = require("./categories/category-3-debug-artifacts.cjs");
const cat4 = require("./categories/category-4-naming.cjs");
const cat5 = require("./categories/category-5-docs.cjs");
const cat6 = require("./categories/category-6-structural.cjs");
const cat7 = require("./categories/category-7-magic-numbers.cjs");
const cat8 = require("./categories/category-8-dead-code.cjs");
const cat9 = require("./categories/category-9-comments.cjs");
const cat10 = require("./categories/category-10-regression.cjs");
const cat11 = require("./categories/category-11-history.cjs");
const cat12 = require("./categories/category-12-test-slop.cjs");
const cat13 = require("./categories/category-13-theater.cjs");
const cat14 = require("./categories/category-14-imports.cjs");
const cat15 = require("./categories/category-15-cqs.cjs");
const cat16 = require("./categories/category-16-lod.cjs");
const cat17 = require("./categories/category-17-stubs.cjs");
const cat18 = require("./categories/category-18-god-functions.cjs");
const cat19 = require("./categories/category-19-deep-nesting.cjs");
const cat20 = require("./categories/category-20-dead-code-after-terminal.cjs");
const cat21 = require("./categories/category-21-slopsquatting.cjs");
const cat22 = require("./categories/category-22-sandi-metz.cjs");
const cat23 = require("./categories/category-23-security.cjs");
const cat24 = require("./categories/category-24-functional-purity.cjs");
const cat25 = require("./categories/category-25-formatting-noise.cjs");
const unusedDetector = require("./detectors/unused.cjs");

async function main() {
  const context = new Context(process.argv.slice(2));
  const reporter = new Reporter();
  const runner = new Runner(context, reporter);

  const categories = [
    cat1, cat2, cat3, cat4, cat5, cat6, cat7, cat8, cat9,
    cat10, cat11, cat12, cat13, cat14, cat15, cat16, cat17,
    cat18, cat19, cat20, cat21, cat22, cat23, cat24, cat25
  ];

  runner.run(categories);
  console.log("\n\x1b[36m=== Pillar 4: Unused Detection ===\x1b[0m");
  unusedDetector.run(context, reporter);
  return { context, reporter, runner };
}

main().then(({ runner }) => {
  runner.finish();
}).catch(err => {
  console.error("Quality Engine Error:", err);
  process.exit(1);
});
