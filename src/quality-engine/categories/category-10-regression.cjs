const { run } = require("../core/utils.cjs");

// Critical rendering/layout signals that indicate a silent regression
// when a diff touches z-ordering, cursor layering, or annotation rendering.
const REGRESSION_SIGNALS = [
  "zIndex",
  "renderOrder",
  "layerOrder",
  "cursorLayer",
  "annotationLayer",
  "blurLayer",
  "canvasOrder",
  "stackingContext",
];

module.exports = {
  name: "🟡 Category 10: Regression Signals",
  run(context, reporter) {
    const diff = run("git diff main -- '*.ts' '*.tsx' '*.go'");
    if (!diff) {
      reporter.pass("No diff found — regression signals N/A.");
      return;
    }

    const diffLines = diff.split("\n");
    let found = false;

    for (const signal of REGRESSION_SIGNALS) {
      const hits = diffLines
        .filter((l) => l.startsWith("+") && !l.startsWith("+++") && l.includes(signal))
        .slice(0, 3);

      if (hits.length > 0) {
        reporter.warn(`Regression signal [${signal}] modified in diff:`);
        for (const h of hits) {
          reporter.note(`  ${h.trim().slice(0, 100)}`);
        }
        found = true;
      }
    }

    // Flag if CSS z-index changed in any diff file
    const cssZIndex = diffLines.filter(
      (l) => l.startsWith("+") && !l.startsWith("+++") && /z-index\s*:\s*\d+/.test(l),
    );
    if (cssZIndex.length > 0) {
      reporter.warn(`CSS z-index changed — verify layering intent:`);
      for (const h of cssZIndex.slice(0, 3)) {
        reporter.note(`  ${h.trim().slice(0, 100)}`);
      }
      found = true;
    }

    if (!found) {
      reporter.pass("No rendering/layering regression signals found in diff.");
    }
  },
};
