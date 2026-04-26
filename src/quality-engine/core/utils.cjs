const { execSync } = require("child_process");

const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

function run(cmd) {
  try {
    const out = execSync(cmd, { stdio: ["pipe", "pipe", "pipe"] })
      .toString()
      .trim();
    return out.replace(/^stdout is not a tty\r?\n?/, "");
  } catch (e) {
    const out = e.stdout ? e.stdout.toString().trim() : "";
    return out.replace(/^stdout is not a tty\r?\n?/, "");
  }
}

module.exports = {
  RED,
  YELLOW,
  GREEN,
  RESET,
  BOLD,
  DIM,
  run
};
