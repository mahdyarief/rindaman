const { run } = require("../core/utils.cjs");

module.exports = {
  name: "🟢 Category 11: Commit History Hygiene",
  run(context, reporter) {
    if (context.isExplicit) {
      reporter.pass("History check skipped in explicit file mode.");
      return;
    }
    const commitLog = run("git log main..HEAD --oneline");
    if (!commitLog) {
      reporter.pass("No commits ahead of main.");
      return;
    }

    const commits = commitLog.split("\n");
    const junkKeywords = ["fix lint", "fix type", "debug", "temp", "wip", "test commit", "fix fix", "complete rebase", "resolve conflict", "cleanup", "minor fix"];
    const conventionalCommitRegex = /^[0-9a-f]+\s+(feat|fix|refactor|perf|test|chore|docs|style|build|ci)(\(.+\))?(!)?: .+/;

    let historyClean = true;
    for (const commit of commits) {
      if (junkKeywords.some(k => commit.toLowerCase().includes(k))) {
        reporter.warn(`Junk commit: "${commit.slice(0, 72)}"`);
        historyClean = false;
      }
      if (!conventionalCommitRegex.test(commit)) {
        reporter.warn(`Non-conventional format: "${commit.slice(0, 72)}"`);
        historyClean = false;
      }
    }
    if (historyClean) reporter.pass("Commit names are clean and follow conventional format.");

    if (commits.length > 5) reporter.warn(`${commits.length} commits ahead of main — consider squashing.`);
    else reporter.pass(`${commits.length} commit(s) ahead of main — reasonable.`);
  }
};
