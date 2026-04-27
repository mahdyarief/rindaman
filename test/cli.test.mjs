import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import test from "node:test";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const packageDirectory = resolve(testDirectory, "..");
const cliPath = resolve(packageDirectory, "bin", "rindaman.cjs");
const minimalFixtureDirectory = resolve(
  testDirectory,
  "fixtures",
  "minimal-project",
);
const typecheckFailureFixtureDirectory = resolve(
  testDirectory,
  "fixtures",
  "typecheck-failure",
);
const formatterFailureFixtureDirectory = resolve(
  testDirectory,
  "fixtures",
  "formatter-failure",
);
const noGitFixtureDirectory = resolve(testDirectory, "fixtures", "no-git-project");
const configPrecedenceFixtureDirectory = resolve(
  testDirectory,
  "fixtures",
  "config-precedence",
);
const debtConfigFixtureDirectory = resolve(
  testDirectory,
  "fixtures",
  "debt-config",
);
const monorepoFixtureDirectory = resolve(
  testDirectory,
  "fixtures",
  "monorepo-project",
);

function runCli(args, cwd) {
  return spawnSync("node", [cliPath, ...args], {
    cwd,
    encoding: "utf8",
  });
}

function parseJsonOutput(result) {
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
}

function findCheck(output, name) {
  return output.checks.find((check) => check.name === name);
}

function writeTemporaryJsonFixture(directoryName, packageJson) {
  const temporaryDirectory = resolve(tmpdir(), directoryName);

  mkdirSync(temporaryDirectory, { recursive: true });
  writeFileSync(
    resolve(temporaryDirectory, "package.json"),
    `${JSON.stringify(packageJson, null, 2)}\n`,
  );

  return temporaryDirectory;
}

function writeTemporaryChangedFileFixture(directoryName, packageJson) {
  const temporaryDirectory = writeTemporaryJsonFixture(directoryName, packageJson);

  writeFileSync(resolve(temporaryDirectory, "changed.js"), "const changed = true;\n");

  return temporaryDirectory;
}

function createTemporaryGitBoundary(directoryName) {
  const temporaryDirectory = resolve(tmpdir(), directoryName);

  mkdirSync(resolve(temporaryDirectory, ".git"), { recursive: true });

  return temporaryDirectory;
}

test("CLI help exits successfully", () => {
  const result = runCli(["--help"], packageDirectory);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Rindaman/);
});

test("CLI doctor supports JSON output", () => {
  const result = runCli(["doctor", "--json"], packageDirectory);

  assert.equal(result.status, 0);
  const output = parseJsonOutput(result);
  assert.equal(output.command, "doctor");
  assert.equal(output.status, "passed");
});

test("CLI check supports fixture-backed JSON output", () => {
  const result = runCli(["check", "--json"], minimalFixtureDirectory);

  assert.equal(result.status, 0);
  const output = parseJsonOutput(result);
  assert.equal(output.command, "check");
  assert.equal(output.status, "passed");
  assert.equal(output.projectRoot, minimalFixtureDirectory);
  assert.deepEqual(output.debt, {
    mode: "changed-only",
    classification: "none",
    introducedChecks: [],
    existingChecks: [],
    unknownChecks: [],
  });
  assert.equal(output.baseline.found, false);
  assert.equal(output.baseline.used, false);
  assert.deepEqual(output.baseline.checkNames, []);
  assert.deepEqual(
    output.checks.map((check) => check.status),
    ["skipped", "skipped", "skipped", "skipped"],
  );
});

test("CLI check reports typecheck script failures", () => {
  const fixtureDirectory = writeTemporaryChangedFileFixture(
    "rindaman-typecheck-introduced-fixture",
    {
      scripts: {
        typecheck: "node -e \"process.exit(1)\"",
      },
      rindaman: {
        checks: {
          semantic: false,
          syntax: false,
          hygiene: false,
        },
      },
    },
  );
  const result = runCli(["check", "--json", "changed.js"], fixtureDirectory);

  assert.equal(result.status, 1);
  const output = parseJsonOutput(result);
  const typeCheck = findCheck(output, "types");

  assert.equal(output.status, "failed");
  assert.equal(output.debt.classification, "introduced");
  assert.deepEqual(output.debt.introducedChecks, ["types"]);
  assert.deepEqual(output.debt.unknownChecks, []);
  assert.equal(typeCheck.status, "failed");
  assert.equal(typeCheck.exitCode, 1);
});

test("CLI check reports formatter failures", () => {
  const result = runCli(
    ["check", "--json", "--all"],
    formatterFailureFixtureDirectory,
  );

  assert.equal(result.status, 1);
  const output = parseJsonOutput(result);
  const syntaxCheck = findCheck(output, "syntax");

  assert.equal(output.status, "failed");
  assert.equal(output.debt.classification, "unknown");
  assert.deepEqual(output.debt.introducedChecks, []);
  assert.deepEqual(output.debt.unknownChecks, ["syntax"]);
  assert.equal(output.formatter, "prettier");
  assert.equal(syntaxCheck.status, "failed");
  assert.equal(syntaxCheck.exitCode, 1);
});

test("CLI baseline writes failed check names", () => {
  const baselinePath = resolve(
    tmpdir(),
    "rindaman-baseline-command-fixture",
    ".rindaman",
    "baseline.json",
  );
  const fixtureDirectory = writeTemporaryJsonFixture(
    "rindaman-baseline-command-fixture",
    {
      scripts: {
        typecheck: "node -e \"process.exit(1)\"",
      },
      rindaman: {
        checks: {
          semantic: false,
          syntax: false,
          hygiene: false,
        },
      },
    },
  );
  const result = runCli(["baseline", "--json"], fixtureDirectory);

  assert.equal(result.status, 0);
  const output = parseJsonOutput(result);
  const baselineFile = JSON.parse(readFileSync(baselinePath, "utf8"));

  assert.equal(output.command, "baseline");
  assert.equal(output.status, "passed");
  assert.deepEqual(output.baseline.checkNames, ["types"]);
  assert.equal(baselineFile.version, 1);
  assert.deepEqual(baselineFile.checks, ["types"]);
});

test("CLI check classifies baseline failures as existing", () => {
  const fixtureDirectory = writeTemporaryJsonFixture(
    "rindaman-existing-baseline-fixture",
    {
      scripts: {
        typecheck: "node -e \"process.exit(1)\"",
      },
      rindaman: {
        checks: {
          semantic: false,
          syntax: false,
          hygiene: false,
        },
      },
    },
  );
  mkdirSync(resolve(fixtureDirectory, ".rindaman"), { recursive: true });
  writeFileSync(
    resolve(fixtureDirectory, ".rindaman", "baseline.json"),
    `${JSON.stringify(
      { version: 1, createdAt: "2026-04-26T00:00:00.000Z", checks: ["types"] },
      null,
      2,
    )}\n`,
  );

  const result = runCli(["check", "--json", "--all"], fixtureDirectory);

  assert.equal(result.status, 0);
  const output = parseJsonOutput(result);

  assert.equal(output.debt.classification, "existing");
  assert.deepEqual(output.debt.existingChecks, ["types"]);
  assert.deepEqual(output.debt.unknownChecks, []);
});

test("CLI check can fail existing baseline debt", () => {
  const fixtureDirectory = writeTemporaryJsonFixture(
    "rindaman-fail-existing-baseline-fixture",
    {
      scripts: {
        typecheck: "node -e \"process.exit(1)\"",
      },
      rindaman: {
        checks: {
          semantic: false,
          syntax: false,
          hygiene: false,
        },
      },
    },
  );
  mkdirSync(resolve(fixtureDirectory, ".rindaman"), { recursive: true });
  writeFileSync(
    resolve(fixtureDirectory, ".rindaman", "baseline.json"),
    `${JSON.stringify(
      { version: 1, createdAt: "2026-04-26T00:00:00.000Z", checks: ["types"] },
      null,
      2,
    )}\n`,
  );

  const result = runCli(
    ["check", "--json", "--all", "--fail-existing"],
    fixtureDirectory,
  );

  assert.equal(result.status, 1);
  const output = parseJsonOutput(result);

  assert.equal(output.status, "failed");
  assert.deepEqual(output.debt.existingChecks, ["types"]);
});

test("CLI check can ignore an existing baseline", () => {
  const fixtureDirectory = writeTemporaryJsonFixture(
    "rindaman-no-baseline-fixture",
    {
      scripts: {
        typecheck: "node -e \"process.exit(1)\"",
      },
      rindaman: {
        checks: {
          semantic: false,
          syntax: false,
          hygiene: false,
        },
      },
    },
  );
  mkdirSync(resolve(fixtureDirectory, ".rindaman"), { recursive: true });
  writeFileSync(
    resolve(fixtureDirectory, ".rindaman", "baseline.json"),
    `${JSON.stringify(
      { version: 1, createdAt: "2026-04-26T00:00:00.000Z", checks: ["types"] },
      null,
      2,
    )}\n`,
  );

  const result = runCli(
    ["check", "--json", "--all", "--no-baseline"],
    fixtureDirectory,
  );

  assert.equal(result.status, 1);
  const output = parseJsonOutput(result);

  assert.equal(output.baseline.found, true);
  assert.equal(output.baseline.used, false);
  assert.deepEqual(output.debt.unknownChecks, ["types"]);
});

test("CLI check ignores invalid baseline JSON", () => {
  const fixtureDirectory = writeTemporaryJsonFixture(
    "rindaman-invalid-baseline-fixture",
    {
      rindaman: {
        checks: {
          semantic: false,
          types: false,
          syntax: false,
          hygiene: false,
        },
      },
    },
  );
  mkdirSync(resolve(fixtureDirectory, ".rindaman"), { recursive: true });
  writeFileSync(resolve(fixtureDirectory, ".rindaman", "baseline.json"), "not json\n");

  const result = runCli(["check", "--json"], fixtureDirectory);

  assert.equal(result.status, 0);
  const output = parseJsonOutput(result);

  assert.equal(output.baseline.found, true);
  assert.equal(output.baseline.used, false);
  assert.deepEqual(output.baseline.checkNames, []);
});

test("CLI rejects missing workspace target with JSON error", () => {
  const result = runCli(
    ["check", "--json", "--workspace", "missing"],
    monorepoFixtureDirectory,
  );

  assert.equal(result.status, 2);
  const output = parseJsonOutput(result);

  assert.equal(output.status, "error");
  assert.match(output.error, /Workspace not found: missing/);
});

test("CLI check can target a workspace by path", () => {
  const result = runCli(
    ["check", "--json", "--workspace", "packages/api"],
    monorepoFixtureDirectory,
  );

  assert.equal(result.status, 1);
  const output = parseJsonOutput(result);

  assert.equal(output.workspace.name, "@rindaman/api");
  assert.equal(output.workspace.path, "packages/api");
  assert.equal(output.debt.mode, "all");
});

test("CLI check can target a workspace by package name", () => {
  const result = runCli(
    ["check", "--json", "--workspace", "@rindaman/web"],
    monorepoFixtureDirectory,
  );

  assert.equal(result.status, 0);
  const output = parseJsonOutput(result);

  assert.equal(output.workspace.name, "@rindaman/web");
  assert.equal(output.workspace.path, "apps/web");
});

test("CLI check can run all workspaces", () => {
  const result = runCli(["check", "--json", "--workspaces"], monorepoFixtureDirectory);

  assert.equal(result.status, 1);
  const output = parseJsonOutput(result);

  assert.equal(output.command, "check");
  assert.equal(output.status, "failed");
  assert.deepEqual(
    output.workspaces.map((workspaceResult) => workspaceResult.workspace.path),
    ["apps/web", "packages/api"],
  );
});

test("CLI baseline writes workspace-local baselines", () => {
  rmSync(resolve(monorepoFixtureDirectory, "packages", "api", ".rindaman"), {
    force: true,
    recursive: true,
  });
  const result = runCli(
    ["baseline", "--json", "--workspace", "packages/api"],
    monorepoFixtureDirectory,
  );

  assert.equal(result.status, 0);
  const output = parseJsonOutput(result);

  assert.equal(output.workspace.path, "packages/api");
  assert.match(output.baseline.path, /packages[\\/]api[\\/]\.rindaman[\\/]baseline\.json$/);
  assert.deepEqual(output.baseline.checkNames, ["types"]);
  rmSync(resolve(monorepoFixtureDirectory, "packages", "api", ".rindaman"), {
    force: true,
    recursive: true,
  });
});

test("CLI audit reports unknown debt without failing", () => {
  const result = runCli(
    ["audit", "--json", "--all"],
    formatterFailureFixtureDirectory,
  );

  assert.equal(result.status, 0);
  const output = parseJsonOutput(result);

  assert.equal(output.command, "audit");
  assert.equal(output.status, "audit_failed");
  assert.equal(output.debt.classification, "unknown");
  assert.deepEqual(output.debt.unknownChecks, ["syntax"]);
});

test("CLI doctor reports missing package.json", () => {
  const fixtureDirectory = createTemporaryGitBoundary(
    "rindaman-missing-package-fixture",
  );
  const result = runCli(["doctor", "--json"], fixtureDirectory);

  assert.equal(result.status, 3);
  const output = parseJsonOutput(result);
  const packageCheck = findCheck(output, "package_json");

  assert.equal(output.status, "failed");
  assert.equal(packageCheck.status, "failed");
});

test("CLI check does not crash outside a git repo", () => {
  const result = runCli(["check", "--json"], noGitFixtureDirectory);

  assert.equal(result.status, 0);
  const output = parseJsonOutput(result);

  assert.equal(output.command, "check");
  assert.equal(output.status, "passed");
  assert.ok(Array.isArray(output.changedFiles));
});

test("CLI check treats skipped local tools as warnings by default", () => {
  const fixtureDirectory = writeTemporaryJsonFixture(
    "rindaman-skipped-tools-fixture",
    {},
  );
  const result = runCli(["check", "--json"], fixtureDirectory);

  assert.equal(result.status, 0);
  const output = parseJsonOutput(result);
  const localToolChecks = output.checks.filter((check) =>
    ["types", "syntax", "hygiene"].includes(check.name),
  );

  assert.equal(output.status, "passed");
  assert.deepEqual(
    localToolChecks.map((check) => check.status),
    ["skipped", "skipped", "skipped"],
  );
  assert.deepEqual(
    localToolChecks.map((check) => check.severity),
    ["warning", "warning", "warning"],
  );
});

test("CLI strict mode treats skipped checks as failures", () => {
  const result = runCli(["check", "--json", "--strict"], minimalFixtureDirectory);

  assert.equal(result.status, 1);
  const output = parseJsonOutput(result);

  assert.equal(output.status, "failed");
  assert.equal(output.policy.strictWarnings, true);
});

test("CLI rejects invalid debt mode with JSON error", () => {
  const result = runCli(
    ["check", "--json", "--debt-mode", "invalid"],
    minimalFixtureDirectory,
  );

  assert.equal(result.status, 2);
  const output = parseJsonOutput(result);

  assert.equal(output.status, "error");
  assert.match(output.error, /Invalid --debt-mode value: invalid/);
});

test("CLI config precedence applies defaults, package config, file config, then flags", () => {
  const result = runCli(
    [
      "check",
      "--json",
      "--all",
      "--strict",
      "--report-path",
      ".rindaman/from-flag.md",
    ],
    configPrecedenceFixtureDirectory,
  );

  assert.equal(result.status, 1);
  const output = parseJsonOutput(result);
  const semanticCheck = findCheck(output, "semantic");
  const typesCheck = findCheck(output, "types");

  assert.equal(output.changedOnly, false);
  assert.equal(output.policy.strictWarnings, true);
  assert.equal(output.reportPath, null);
  assert.deepEqual(output.policy.ignorePatterns, ["file-ignore/**"]);
  assert.equal(semanticCheck.status, "skipped");
  assert.equal(semanticCheck.severity, "info");
  assert.equal(typesCheck.status, "skipped");
  assert.equal(typesCheck.reason, "Disabled by config");
});

test("CLI debt config precedence applies package, file, then flags", () => {
  const result = runCli(
    ["check", "--json", "--debt-mode", "all", "--fail-existing"],
    debtConfigFixtureDirectory,
  );

  assert.equal(result.status, 0);
  const output = parseJsonOutput(result);

  assert.equal(output.debt.mode, "all");
  assert.equal(output.policy.failOnExistingDebt, true);
});
