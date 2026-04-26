import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
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
  assert.deepEqual(
    output.checks.map((check) => check.status),
    ["skipped", "skipped", "skipped", "skipped"],
  );
});

test("CLI check reports typecheck script failures", () => {
  const result = runCli(["check", "--json"], typecheckFailureFixtureDirectory);

  assert.equal(result.status, 1);
  const output = parseJsonOutput(result);
  const typeCheck = findCheck(output, "types");

  assert.equal(output.status, "failed");
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
  assert.equal(output.formatter, "prettier");
  assert.equal(syntaxCheck.status, "failed");
  assert.equal(syntaxCheck.exitCode, 1);
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
  assert.deepEqual(output.changedFiles, []);
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
