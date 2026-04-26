const fs = require("fs");

const BUZZWORDS = [
  "optimized", "efficient", "performant", "seamlessly", "seamless",
  "robust", "powerful", "ensures", "provides", "cinematic",
  "organic", "film-like", "elegant", "smooth", "enterprise-grade",
  "production-ready", "scalable", "maintainable", "flexible",
];

const FUNCTION_TRANSLATION = /\/\/\s*(create|handle|process|enable|initialize|setup|update|fetch|load|render|build|generate|parse|format|validate|delete|remove|add|get|set|check|run|start|stop|reset|clear|close|open|send|receive|calculate|compute|convert|transform|merge|split|sort|filter|map|reduce)\s+(?:the|a|an)?\s*\w+/i;

const UNVERIFIED_PERCENTAGE = /\/\/.*\b\d+\s*%\b/;

module.exports = {
  name: "🟡 Category 9: Comment Quality",
  run(context, reporter) {
    const SECTION_BANNER = /\/\/+\s*={4,}|\/\/+\s*-{4,}|\/\/+\s*#{4,}/;
    const SECTION_HEADER = /\/\/\s*(INITIALIZATION|MAIN LOGIC|SETUP|CLEANUP|START|END|SECTION|STEP \d+)\s*$/i;

    let clean = true;

    for (const file of context.tsFiles) {
      const lines = fs.readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (!trimmed.startsWith("//")) return;
        const loc = `${file}:${i + 1}`;
        const snippet = trimmed.slice(0, 80);

        // Pass 1: Section banners / structural decorators
        if (SECTION_BANNER.test(trimmed) || SECTION_HEADER.test(trimmed)) {
          reporter.warn(`Section-announcer comment at ${loc}`);
          reporter.note(`→ ${snippet}`);
          clean = false;
          return;
        }

        // Pass 2: Function-translation (comment restates what the next line does)
        if (FUNCTION_TRANSLATION.test(trimmed)) {
          reporter.warn(`Function-translation comment at ${loc}`);
          reporter.note(`→ ${snippet}`);
          clean = false;
          return;
        }

        // Pass 3: Unverified percentage claims
        if (UNVERIFIED_PERCENTAGE.test(trimmed)) {
          reporter.warn(`Unverified percentage claim at ${loc}`);
          reporter.note(`→ ${snippet}`);
          clean = false;
          return;
        }

        // Pass 4: Buzzwords without grounding
        const hitWord = BUZZWORDS.find((w) => new RegExp(`\\b${w}\\b`, "i").test(trimmed));
        if (hitWord) {
          reporter.warn(`Buzzword comment ["${hitWord}"] at ${loc}`);
          reporter.note(`→ ${snippet}`);
          clean = false;
        }
      });
    }

    if (clean) reporter.pass("No redundant or buzzword-laden comments found.");
  },
};
