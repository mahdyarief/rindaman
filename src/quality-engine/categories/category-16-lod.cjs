const fs = require("fs");

module.exports = {
  name: "🟡 Category 16: Law of Demeter Violations",
  run(context, reporter) {
    const lodChainRegex = /\b[a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*(?:\([^)]*\))?){3,}/g;
    const lodExclusions = [
      "console.", "path.", "fs.", "window.", "document.", "navigator.",
      "e.target.", "e.dataTransfer.", "res.json().", "api.", "router.",
      "queryClient.", "this.props.", "this.state.", "editor.", "screen.",
      "expect.", "page.", "_", "import.meta.", "info.row.original.",
      " LANDING_COPY.", "vibe_blocks.", "features.", "agentic.", "db.", "editorState.", "view.state.",
    ];

    let lodClean = true;
    for (const file of context.tsFiles) {
      const lines = fs.readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("import ") || trimmed.startsWith("type ") || trimmed.startsWith("interface ")) return;

        const matches = line.match(lodChainRegex) || [];
        for (const match of matches) {
          const excluded = lodExclusions.some((e) => match.startsWith(e));
          if (!excluded) {
            reporter.warn(`Law of Demeter violation at ${file}:${i + 1}: "${match.slice(0, 60)}"`);
            lodClean = false;
          }
        }
      });
    }
    if (lodClean) reporter.pass("No Law of Demeter violations found.");
  }
};
