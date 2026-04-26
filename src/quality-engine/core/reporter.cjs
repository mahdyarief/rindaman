const fs = require("fs");
const path = require("path");
const { RED, YELLOW, GREEN, RESET, BOLD, DIM } = require("./utils.cjs");

class Reporter {
  constructor() {
    this.issues = { red: 0, yellow: 0 };
    this.archIssues = { god: 0, bloated: 0, tolerable: 0 };
    this.reportLines = {
      red: [],
      yellow: [],
      god: [],
      bloated: [],
      tolerable: [],
    };
    this.currentIssue = null;
  }

  pass(msg) {
    console.log(`${GREEN}  ✔ ${msg}${RESET}`);
  }

  warn(msg) {
    console.log(`${YELLOW}  ⚠  ${msg}${RESET}`);
    this.issues.yellow++;
    this.currentIssue = { msg, notes: [] };
    this.reportLines.yellow.push(this.currentIssue);
  }

  fail(msg) {
    console.log(`${RED}  ✘ ${msg}${RESET}`);
    this.issues.red++;
    this.currentIssue = { msg, notes: [] };
    this.reportLines.red.push(this.currentIssue);
  }

  arch(type, msg) {
    const symbol = type === "GOD" ? "🛡️" : type === "BLOATED" ? "☢️" : "🌱";
    const color = type === "GOD" || type === "BLOATED" ? YELLOW : DIM;
    console.log(`${color}  [${type}] ${symbol} ${msg}${RESET}`);

    this.currentIssue = { msg: `[${type}] ${msg}`, notes: [] };

    if (type === "GOD") {
      this.archIssues.god++;
      this.reportLines.god.push(this.currentIssue);
    } else if (type === "BLOATED") {
      this.archIssues.bloated++;
      this.reportLines.bloated.push(this.currentIssue);
    } else if (type === "TOLERABLE") {
      this.archIssues.tolerable++;
      this.reportLines.tolerable.push(this.currentIssue);
    }
  }

  section(title) {
    console.log(`\n${BOLD}${title}${RESET}`);
    this.currentIssue = null;
  }

  note(msg) {
    console.log(`${DIM}     ${msg}${RESET}`);
    if (this.currentIssue) {
      this.currentIssue.notes.push(msg);
    }
  }

  generateMarkdown(outputPath) {
    let md = "# Code Quality Check Results\n\n";

    md += "## 🔴 Red Issues (Must Be Fix)\n";
    if (this.reportLines.red.length === 0) {
      md += "None detected. ✅\n";
    } else {
      for (const issue of this.reportLines.red) {
        md += `- **${issue.msg}**\n`;
        for (const n of issue.notes) md += `  - ${n}\n`;
      }
    }

    md += "\n## 🟡 Yellow Issues (Recommend to handle with human observation)\n";
    if (this.reportLines.yellow.length === 0) {
      md += "None detected. ✅\n";
    } else {
      for (const issue of this.reportLines.yellow) {
        md += `- **${issue.msg}**\n`;
        for (const n of issue.notes) md += `  - ${n}\n`;
      }
    }

    md += "\n## 🏛️ Architectural Debt (Informational)\n";

    md += "\n### 🛡️ God Functions\n";
    if (this.reportLines.god.length === 0) {
      md += "None detected. ✅\n";
    } else {
      for (const issue of this.reportLines.god) {
        md += `- **${issue.msg}**\n`;
        for (const n of issue.notes) md += `  - ${n}\n`;
      }
    }

    md += "\n### ☢️ Bloated Methods (Priority Fix)\n";
    if (this.reportLines.bloated.length === 0) {
      md += "None detected. ✅\n";
    } else {
      for (const issue of this.reportLines.bloated) {
        md += `- **${issue.msg}**\n`;
        for (const n of issue.notes) md += `  - ${n}\n`;
      }
    }

    md += "\n### 🌱 Tolerable Debt (Technical Growth)\n";
    if (this.reportLines.tolerable.length === 0) {
      md += "None detected. ✅\n";
    } else {
      md +=
        "<details>\n<summary>Click to view tolerable architectural debt</summary>\n\n";
      for (const issue of this.reportLines.tolerable) {
        md += `- **${issue.msg}**\n`;
        for (const n of issue.notes) md += `  - ${n}\n`;
      }
      md += "\n</details>\n";
    }

    md += `\n## Summary\n`;
    md += `- 🔴 **Red Issues (Must Be Fix)**: ${this.issues.red}\n`;
    md += `- 🟡 **Yellow Issues (Recommend to handle with human observation)**: ${this.issues.yellow}\n`;
    md += `- 🏛️ **Architectural Debt (Informational)**: ${this.archIssues.god + this.archIssues.bloated + this.archIssues.tolerable}\n`;
    md += `  - *God Functions*: ${this.archIssues.god}\n`;
    md += `  - *Bloated Methods*: ${this.archIssues.bloated}\n`;
    md += `  - *Tolerable Debt*: ${this.archIssues.tolerable}\n`;

    if (this.issues.red > 0) {
      md +=
        "\n> [!CAUTION]\n> **CRITICAL: MUST BE FIX.** Red issues are blocking and must be resolved before submission.\n";
    } else if (this.issues.yellow > 500) {
      md +=
        "\n> [!CAUTION]\n> **DEBT LIMIT EXCEEDED.** Fix yellow issues to bring debt under control.\n";
    } else if (
      this.issues.yellow > 0 ||
      this.archIssues.god > 0 ||
      this.archIssues.bloated > 0
    ) {
      md +=
        "\n> [!WARNING]\n> **REVIEW RECOMMENDED.** Review yellow warnings and architectural debt. Choose structural improvements wisely.\n";
    } else {
      md += "\n> [!TIP]\n> PR looks clean! Excellent work.\n";
    }

    fs.writeFileSync(outputPath, md);
  }
}

module.exports = { Reporter };
