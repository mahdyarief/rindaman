const { RED, YELLOW, GREEN, RESET, BOLD, DIM } = require("./utils.cjs");
const path = require("path");

class Runner {
  constructor(context, reporter) {
    this.context = context;
    this.reporter = reporter;
  }

  run(categories) {
    for (const cat of categories) {
      if (cat.run) {
        this.reporter.section(cat.name);
        cat.run(this.context, this.reporter);
      }
    }
  }

  finish() {
    const configuredReportPath = process.env.RINDAMAN_REPORT_PATH;
    const reportPath = configuredReportPath ? path.resolve(process.cwd(), configuredReportPath) : path.join(process.cwd(), ".rindaman", "report.md");
    if (process.env.RINDAMAN_WRITE_REPORT !== "0") {
      require("fs").mkdirSync(path.dirname(reportPath), { recursive: true });
      this.reporter.generateMarkdown(reportPath);
    }

    const { red, yellow } = this.reporter.issues;
    const { archIssues } = this.reporter;
    const totalArch = archIssues.god + archIssues.bloated + archIssues.tolerable;

    console.log(`\n${BOLD}📊 Quality Summary:${RESET}`);
    console.log(`${red > 0 ? RED : GREEN}  🔴 Red Issues (Must Be Fix): ${red}${RESET}`);
    console.log(`${yellow > 0 ? YELLOW : GREEN}  🟡 Yellow Issues (Recommend to handle with human observation): ${yellow}${RESET}`);
    console.log(`${totalArch > 0 ? DIM : GREEN}  🏛️ Architectural Debt (Informational): ${totalArch}${RESET}`);
    if (totalArch > 0) {
      console.log(`${DIM}     - God Functions: ${archIssues.god}\n     - Bloated Methods: ${archIssues.bloated}\n     - Tolerable Debt: ${archIssues.tolerable}${RESET}`);
    }

    if (red > 0) {
      console.log(`\n${RED}${BOLD}  ✘ CRITICAL: MUST BE FIX. Red issues are blocking. Read ${reportPath}${RESET}`);
      process.exit(1);
    } else if (yellow > 500) {
      console.log(`\n${RED}${BOLD}  ✘ DEBT LIMIT EXCEEDED. Fix yellow issues. (${yellow} > 500)${RESET}`);
      process.exit(1);
    } else if (yellow > 0 || totalArch > 0) {
      console.log(`\n${YELLOW}${BOLD}  ⚠  REVIEW RECOMMENDED. Review yellow warnings and architectural debt.${RESET}`);
      process.exit(0);
    } else {
      console.log(`\n${GREEN}${BOLD}  ✔ No blocking quality issues detected.${RESET}`);
    }
  }
}

module.exports = { Runner };
