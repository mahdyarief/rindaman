// ignore-sandi-metz
const { run } = require("../core/utils.cjs");

// Threshold: if whitespace-ignored diff is less than this fraction of the
// full diff, the PR is mostly formatting churn, not logic.
const NOISE_RATIO_THRESHOLD = 0.25;

// A PR with fewer than this many real changed lines is too small to ratio-check.
const MIN_LINES_FOR_RATIO = 20;

function parseShortstat(stat) {
  if (!stat) return { insertions: 0, deletions: 0 };
  const ins = stat.match(/(\d+) insertion/);
  const del = stat.match(/(\d+) deletion/);
  return {
    insertions: ins ? parseInt(ins[1], 10) : 0,
    deletions: del ? parseInt(del[1], 10) : 0,
  };
}

module.exports = {
  name: "🔴 Category 25: Formatting Noise",
  run(context, reporter) {
    const filesFilter = context.isExplicit ? `-- ${context.changedFiles.join(" ")}` : "";
    const fullStat = run(`git diff main --shortstat ${filesFilter}`);
    const nwStat   = run(`git diff main -w --shortstat ${filesFilter}`); // -w = ignore all whitespace

    const full = parseShortstat(fullStat);
    const nw   = parseShortstat(nwStat);

    const fullTotal = full.insertions + full.deletions;
    const nwTotal   = nw.insertions   + nw.deletions;

    if (fullTotal < MIN_LINES_FOR_RATIO) {
      reporter.pass(`Diff is small (${fullTotal} lines) — formatting noise check skipped.`);
      return;
    }

    const realRatio = fullTotal > 0 ? nwTotal / fullTotal : 1;
    const noisePercent = Math.round((1 - realRatio) * 100);

    if (realRatio < NOISE_RATIO_THRESHOLD) {
      reporter.fail(
        `Formatting noise: ${noisePercent}% of the diff is whitespace/indentation churn ` +
        `(${fullTotal} total lines, only ${nwTotal} survive -w). ` +
        `Revert indentation changes and rebase — do not ship formatting as a feature.`
      );
      return;
    }

    // Secondary check: warn if import-only lines dominate the diff
    const importFilter = context.isExplicit ? context.tsFiles.join(" ") : "'*.ts' '*.tsx'";
    const importLines = run(`git diff main -U0 -- ${importFilter} | grep -cE '^[+-]import ' || true`);
    const importCount = parseInt(importLines, 10) || 0;
    if (importCount > 30) {
      reporter.warn(
        `${importCount} import lines changed — verify these are not just reorder churn. ` +
        `Import reordering without logic change belongs in a dedicated chore commit, not a feature PR.`
      );
    } else {
      reporter.pass(`Import churn within acceptable range (${importCount} import lines changed).`);
    }

    reporter.pass(
      `Formatting noise ratio OK: ${noisePercent}% whitespace (${fullTotal} total → ${nwTotal} real lines).`
    );
  },
};
