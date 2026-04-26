const fs = require("fs");

module.exports = {
  name: "🟡 Category 22: Sandi Metz Rules (Tiered 100/10/4)",
  run(context, reporter) {
    // Tier 1: EXCELLENT (The Target)
    const EXCELLENT = {
      file: 100, file_tsx: 150, file_go: 200,
      func: 10, func_tsx: 20, func_go: 25,
      params: 4
    };

    // Tier 2: TOLERABLE (Acceptable Debt)
    const TOLERABLE = {
      file: 200, file_tsx: 300, file_go: 400,
      func: 25, func_tsx: 40, func_go: 50,
      params: 6
    };

    function isNonLogicLine(l, isGo) {
      if (!l) return true;
      if (l.startsWith("//") || l.startsWith("*")) return true;
      if (l === "{" || l === "}") return true;
      
      if (isGo) {
        return l.startsWith("package ") || l.startsWith("import ") || l.startsWith("type ") || l.startsWith("var ") || l.startsWith("const ");
      }
      
      return l.startsWith("import ") || /^export\s+type\s+/.test(l) || /^(?:export\s+)?(?:interface|type)\s/.test(l) || /^\s*[a-zA-Z?]+\s*[?:].*;\s*$/.test(l);
    }

    function countTopLevelParams(paramsText) {
      if (!paramsText.trim()) return 0;
      // TS Destructuring
      if (/^\s*\{[^)]*\}\s*:/.test(paramsText) || /^\s*\{[^)]*\},?\s*$/.test(paramsText)) return 1;
      let depth = 0, count = 1;
      for (const ch of paramsText) {
        if ("<{[(".includes(ch)) depth++;
        else if (">}])".includes(ch)) depth--;
        else if (ch === "," && depth === 0) count++;
      }
      return count;
    }

    let overallStatus = "ELITE";
    let counts = { elite: 0, tolerable: 0, bloated: 0 };

    for (const file of context.sourceFiles) {
      const content = fs.readFileSync(file, "utf8");
      if (content.includes("// ignore-sandi-metz")) continue;
      const lines = content.split("\n");
      const isTsx = file.endsWith(".tsx");
      const isGo = file.endsWith(".go");

      // 1. File Length Check
      const fileLimitExc = isGo ? EXCELLENT.file_go : (isTsx ? EXCELLENT.file_tsx : EXCELLENT.file);
      const fileLimitTol = isGo ? TOLERABLE.file_go : (isTsx ? TOLERABLE.file_tsx : TOLERABLE.file);

      let logicLinesCount = 0, inTypeBlock = false, typeDepth = 0;
      for (const line of lines) {
        const l = line.trim();
        if (!isGo) {
          if (/^(?:export\s+)?(?:interface|type\s+\w+[\s<][^=]*=\s*\{)/.test(l) && l.includes("{")) { inTypeBlock = true; typeDepth = 0; }
          if (inTypeBlock) { typeDepth += (line.match(/\{/g) || []).length; typeDepth -= (line.match(/\}/g) || []).length; if (typeDepth <= 0) inTypeBlock = false; continue; }
        }
        if (!isNonLogicLine(l, isGo)) logicLinesCount++;
      }

      if (logicLinesCount > fileLimitTol) {
        reporter.arch("BLOATED", `File too long: ${logicLinesCount} logic lines | ${file}`);
        overallStatus = "BLOATED";
        counts.bloated++;
      } else if (logicLinesCount > fileLimitExc) {
        reporter.arch("TOLERABLE", `File growing: ${logicLinesCount} logic lines | ${file}`);
        if (overallStatus !== "BLOATED") overallStatus = "TOLERABLE";
        counts.tolerable++;
      } else {
        counts.elite++;
      }

      // 2. Function and Parameter Checks
      const funcLimitExc = isGo ? EXCELLENT.func_go : (isTsx ? EXCELLENT.func_tsx : EXCELLENT.func);
      const funcLimitTol = isGo ? TOLERABLE.func_go : (isTsx ? TOLERABLE.func_tsx : TOLERABLE.func);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes("// ignore-sandi-metz")) continue;
        
        let fnMatch = null, fnName = "";
        if (isGo) {
          fnMatch = line.match(/\bfunc\s+(?:\([^)]+\)\s+)?(\w+)\s*\(/);
          fnName = fnMatch?.[1] ?? "";
        } else {
          fnMatch = line.match(/(?:^|\s)(?:export\s+)?(?:async\s+)?function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/);
          fnName = fnMatch ? (fnMatch[1] || fnMatch[2] || "(anonymous)") : "";
        }
        
        if (!fnMatch) continue;
        
        // Parameter Count Check
        const parenIdx = line.indexOf("(", fnMatch.index);
        if (parenIdx !== -1) {
          let depth = 1, j = parenIdx + 1;
          while (j < line.length && depth > 0) {
            if (line[j] === "(") depth++;
            else if (line[j] === ")") depth--;
            j++;
          }
          const paramsText = line.slice(parenIdx + 1, j - 1);
          const paramCount = countTopLevelParams(paramsText);
          if (paramCount > TOLERABLE.params) {
            reporter.arch("BLOATED", `Too many parameters: ${paramCount} in "${fnName}" | ${file}:${i + 1}`);
            overallStatus = "BLOATED";
          } else if (paramCount > EXCELLENT.params) {
            reporter.arch("TOLERABLE", `Many parameters: ${paramCount} in "${fnName}" | ${file}:${i + 1}`);
            if (overallStatus !== "BLOATED") overallStatus = "TOLERABLE";
          }
        }

        // Function Length Check
        let depth = 0, started = false, funcLogicLines = 0;
        for (let j = i; j < Math.min(i + 500, lines.length); j++) {
          const l = lines[j].trim();
          const opens = (lines[j].match(/\{/g) || []).length, closes = (lines[j].match(/\}/g) || []).length;
          if (opens > 0) started = true;
          if (started) {
            depth += opens - closes;
            const isJsxLine = isTsx && (
              /^\s*<\/?(?:[A-Za-z][A-Za-z0-9.]*|[^>]+)>/.test(l) || 
              /^\s*<[A-Za-z][A-Za-z0-9.]*.*\/>/.test(l) || 
              /^\s*\{?.*\s*:\s*.*\}?,?\s*$/.test(l) || 
              /^\s*[a-zA-Z0-9-]+\s*=\s*\{?.*\}?,?\s*$/.test(l) ||
              /^\s*\)?\s*,?\s*$/.test(l) || 
              /^\s*\);\s*$/.test(l) || 
              /^\s*return\s*\(?$/.test(l) ||
              /^\s*<\/?(?:Fragment|>\s*)$/.test(l) ||
              l.includes('className={') ||
              l.includes('cn(')
            );
            if (!isNonLogicLine(l, isGo) && !isJsxLine) funcLogicLines++;
            if (depth <= 0) break;
          }
        }

        if (funcLogicLines > funcLimitTol) {
          reporter.arch("BLOATED", `Function too long: ${funcLogicLines} logic lines "${fnName}" | ${file}:${i + 1}`);
          overallStatus = "BLOATED";
        } else if (funcLogicLines > funcLimitExc) {
          reporter.arch("TOLERABLE", `Function growing: ${funcLogicLines} logic lines "${fnName}" | ${file}:${i + 1}`);
          if (overallStatus !== "BLOATED") overallStatus = "TOLERABLE";
        }
      }
    }

    if (overallStatus === "BLOATED") {
      reporter.arch("BLOATED", "Critical Sandi Metz violations detected. Architecturally heavy.");
    } else if (overallStatus === "TOLERABLE") {
      reporter.arch("TOLERABLE", "Sandi Metz limits exceeded slightly. Acceptable debt.");
    } else {
      reporter.pass("[ELITE] Sandi Metz rules followed strictly.");
    }
  }
};


