import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const packageDirectory = resolve(testDirectory, "..");
const cliPath = resolve(packageDirectory, "bin", "rindaman.cjs");

test("CLI help exits successfully", () => {
  const result = spawnSync("node", [cliPath, "--help"], {
    cwd: packageDirectory,
    encoding: "utf8",
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Rindaman/);
});

test("CLI doctor supports JSON output", () => {
  const result = spawnSync("node", [cliPath, "doctor", "--json"], {
    cwd: packageDirectory,
    encoding: "utf8",
  });

  assert.equal(result.status, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.command, "doctor");
  assert.equal(output.status, "passed");
});
