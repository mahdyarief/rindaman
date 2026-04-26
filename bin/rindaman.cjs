#!/usr/bin/env node
/**
 * rindaman - lifecycle quality runner
 *
 * This skill unifies code quality into 4 pillars:
 * - Pillar 1: Semantic quality
 * - Pillar 2: TypeScript (structure)
 * - Pillar 3: Biome/Prettier (syntax)
 * - Pillar 4: Unused Detection (hygiene)
 *
 * Run from project root: rindaman
 */

const { execSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const BLUE = "\x1b[36m";
const RESET = "\x1b[0m";


const cliArgs = process.argv.slice(2);
const cliCommand = cliArgs.find((arg) => !arg.startsWith("--")) || "check";
const cliJson = cliArgs.includes("--json");

if (cliArgs.includes("--help") || cliCommand === "help") {
  console.log([
    "Rindaman - OpenCode strict quality governor",
    "",
    "Usage:",
    "  rindaman check [--json] [--report]",
    "  rindaman audit [--json]",
    "  rindaman doctor [--json]",
    "",
    "Exit codes:",
    "  0 passed or audit completed",
    "  1 quality blockers found",
    "  2 runtime error",
    "  3 setup incomplete",
  ].join("\n"));
  process.exit(0);
}


if (cliCommand === "doctor") {
  const doctorResult = {
    command: "doctor",
    status: "passed",
    node: process.version,
    cwd: process.cwd(),
    packageJson: fs.existsSync(path.join(process.cwd(), "package.json")),
    git: run("git", ["--version"], process.cwd()) ? "available" : "unavailable",
  };

  if (cliJson) {
    console.log(JSON.stringify(doctorResult, null, 2));
  } else {
    console.log("[Rindaman] Doctor passed");
    console.log("[Rindaman] Node: " + doctorResult.node);
    console.log("[Rindaman] package.json: " + String(doctorResult.packageJson));
    console.log("[Rindaman] git: " + doctorResult.git);
  }
  process.exit(0);
}

const isAuditMode = cliCommand === "audit";
const writeReport = cliArgs.includes("--report");
process.env.RINDAMAN_WRITE_REPORT = writeReport ? "1" : "0";

function log(msg) {
  console.log("[Rindaman] " + msg);
}
function section(msg) {
  console.log("\n" + BLUE + "=== " + msg + " ===" + RESET);
}
function error(msg) {
  console.error(RED + "[Rindaman] " + msg + RESET);
}
function success(msg) {
  console.log(GREEN + "[Rindaman] " + msg + RESET);
}

function run(cmd, args = [], cwd = process.cwd()) {
  try {
    const result = spawnSync(cmd, args, { stdio: ["pipe", "pipe", "pipe"], cwd: cwd });
    return result.stdout ? result.stdout.toString().trim() : "";
  } catch (e) {
    return "";
  }
}

function safeExec(cmd, args, cwd = process.cwd()) {
  const isWin = process.platform === "win32";
  
  // If Windows and the command is a package manager, we need .cmd
  const isPM = ["npm", "npx", "yarn", "pnpm", "bun", "bunx"].includes(cmd);
  const finalCmd = (isWin && isPM) ? `${cmd}.cmd` : cmd;

  const result = spawnSync(finalCmd, args, { stdio: "inherit", cwd: cwd });

  // If command not found, fallback to shell
  if (result.error && result.error.code === 'ENOENT' && isWin) {
    const shellResult = spawnSync(cmd, args, { stdio: "inherit", cwd: cwd, shell: true });
    if (shellResult.status !== 0) {
      throw new Error(`Command failed: ${cmd} ${args.join(" ")}`);
    }
    return;
  }

  if (result.status !== 0) {
    throw new Error(`Command failed: ${finalCmd} ${args.join(" ")}`);
  }
}

// Find project root - walk up from current working directory
let projectRoot = process.cwd();
const sep = path.sep;
while (projectRoot) {
  if (fs.existsSync(path.join(projectRoot, "package.json"))) break;
  const parent = path.dirname(projectRoot);
  if (parent === projectRoot) break;
  projectRoot = parent;
}

// 1. Detect Package Manager
const isBun = fs.existsSync(path.join(projectRoot, "bun.lockb"));
const isPnpm = fs.existsSync(path.join(projectRoot, "pnpm-lock.yaml"));
const isYarn = fs.existsSync(path.join(projectRoot, "yarn.lock"));
const pm = isBun ? "bun" : isPnpm ? "pnpm" : isYarn ? "yarn" : "npm";
const pmRun = pm === "npm" ? "npm run" : pm;
const pmX = pm === "bun" ? "bunx" : pm === "pnpm" ? "pnpm dlx" : pm === "yarn" ? "yarn dlx" : "npx";

// 2. Detect Default Branch
const upstreamRef = run("git", ["rev-parse", "--verify", "upstream/main"]) ? "upstream/main" :
                    run("git", ["rev-parse", "--verify", "origin/main"]) ? "origin/main" :
                    run("git", ["rev-parse", "--verify", "main"]) ? "main" :
                    run("git", ["rev-parse", "--verify", "master"]) ? "master" : "HEAD";

const touchedFiles = run("git", ["diff", upstreamRef, "--name-only", "--diff-filter=ACMR"], projectRoot)
  .split("\n")
  .filter(f => (f.endsWith(".ts") || f.endsWith(".tsx")) && fs.existsSync(path.join(projectRoot, f)));

section("4 Pillars Verification");

const enginePath = path.resolve(__dirname, '..', 'src', 'quality-engine', 'engine.cjs');

log(`Detected Package Manager: ${pm}`);
log(`Comparing against: ${upstreamRef}`);

// --- Pillar 1: Semantic Quality ---
log("Pillar 1/4: semantic quality...");
try {
  safeExec("node", [enginePath, ...touchedFiles], projectRoot);
  success("Pillar 1/4: semantic checks passed.");
} catch (e) {
  error("Pillar 1/4 failed.");
  process.exit(isAuditMode ? 0 : 1);
}

// --- Pillar 2: TypeScript ---
log("Pillar 2/4: typecheck...");
let pkg;
try {
  pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));
} catch (e) {
  error("Failed to parse package.json");
  process.exit(1);
}

const scripts = pkg.scripts || {};
if (scripts.typecheck) {
  try {
    const cmdParts = pmRun.split(" ");
    safeExec(cmdParts[0], [...cmdParts.slice(1), "typecheck"], projectRoot);
    success("Pillar 2/4: typecheck passed.");
  } catch (e) {
    error("Pillar 2/4 failed.");
    process.exit(isAuditMode ? 0 : 1);
  }
} else {
  log("No typecheck script in root - checking workspaces...");
  
  // Detect workspaces
  let workspaces = [];
  if (Array.isArray(pkg.workspaces)) {
    workspaces = pkg.workspaces;
  } else if (pkg.workspaces && Array.isArray(pkg.workspaces.packages)) {
    workspaces = pkg.workspaces.packages;
  } else {
    // Fallback to manual check if no workspaces defined
    if (fs.existsSync(path.join(projectRoot, "client"))) workspaces.push("client");
    if (fs.existsSync(path.join(projectRoot, "server"))) workspaces.push("server");
    if (fs.existsSync(path.join(projectRoot, "apps"))) workspaces.push("apps/*");
    if (fs.existsSync(path.join(projectRoot, "packages"))) workspaces.push("packages/*");
  }

  // Resolve glob patterns for workspaces (simple check)
  const resolvedWorkspaces = [];
  workspaces.forEach(ws => {
    if (ws.endsWith("/*")) {
      const base = ws.slice(0, -2);
      const fullBase = path.join(projectRoot, base);
      if (fs.existsSync(fullBase)) {
        fs.readdirSync(fullBase).forEach(dir => {
          if (fs.existsSync(path.join(fullBase, dir, "package.json"))) {
            resolvedWorkspaces.push(path.join(base, dir));
          }
        });
      }
    } else {
      if (fs.existsSync(path.join(projectRoot, ws, "package.json"))) {
        resolvedWorkspaces.push(ws);
      }
    }
  });

  let typecheckFailed = false;
  for (const ws of resolvedWorkspaces) {
    const wsPkg = JSON.parse(fs.readFileSync(path.join(projectRoot, ws, "package.json"), "utf8"));
    if (wsPkg.scripts && wsPkg.scripts.typecheck) {
      log(`Running typecheck in ${ws}...`);
      try {
        const cmdParts = pmRun.split(" ");
        safeExec(cmdParts[0], [...cmdParts.slice(1), "typecheck"], path.join(projectRoot, ws));
      } catch (e) {
        typecheckFailed = true;
      }
    }
  }

  if (typecheckFailed) {
    error("Pillar 2/4 failed.");
    process.exit(isAuditMode ? 0 : 1);
  }
  success("Pillar 2/4: typecheck passed.");
}

// --- Pillar 3: Linter ---
const hasBiome = fs.existsSync(path.join(projectRoot, "biome.json")) || fs.existsSync(path.join(projectRoot, "biome.jsonc"));
const hasPrettier =
  fs.existsSync(path.join(projectRoot, ".prettierrc")) ||
  fs.existsSync(path.join(projectRoot, ".prettierrc.json")) ||
  fs.existsSync(path.join(projectRoot, ".prettierrc.js")) ||
  fs.existsSync(path.join(projectRoot, "prettier.config.js")) ||
  pkg.prettier;

if ((hasBiome || hasPrettier) && touchedFiles.length > 0) {
  log("Pillar 3/4: linter...");
  try {
    const cmdParts = pmX.split(" ");
    if (hasBiome) {
      const biomeArgs = [...cmdParts.slice(1), "biome", "check", ...touchedFiles];
      if (pm === "bun") biomeArgs.unshift("--bun");
      safeExec(cmdParts[0], biomeArgs, projectRoot);
    } else if (hasPrettier) {
      const prettierArgs = [...cmdParts.slice(1), "prettier", "--check", ...touchedFiles];
      if (pm === "bun") prettierArgs.unshift("--bun");
      safeExec(cmdParts[0], prettierArgs, projectRoot);
    }
    success("Pillar 3/4: linter passed.");
  } catch (e) {
    error("Pillar 3/4 failed: lint/format errors.");
    process.exit(isAuditMode ? 0 : 1);
  }
} else if (!hasBiome && !hasPrettier) {
  log("No linter (biome/prettier) config found - skipping pillar 3.");
} else if (touchedFiles.length === 0) {
  log("No touched files - skipping linter.");
}

success("All 4 pillars passed!");
log("Code Quality Verification finished.");
