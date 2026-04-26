const KNOWN_COMMANDS = new Set(["check", "audit", "baseline", "doctor", "help"]);

function createCliArgs(rawArgs) {
  const firstArg = rawArgs[0];
  const command = firstArg && KNOWN_COMMANDS.has(firstArg) ? firstArg : "check";
  const commandArgs =
    command === "check" &&
    firstArg &&
    !firstArg.startsWith("--") &&
    !KNOWN_COMMANDS.has(firstArg)
      ? rawArgs
      : rawArgs.slice(command === "check" && firstArg !== "check" ? 0 : 1);
  const flags = new Set(
    commandArgs.filter((argument) => argument.startsWith("--")),
  );

  return {
    rawArgs,
    command,
    commandArgs,
    flags,
    jsonOutput: flags.has("--json"),
  };
}

function readFlagValue(commandArgs, flagName) {
  const flagIndex = commandArgs.indexOf(flagName);

  if (flagIndex === -1) {
    return undefined;
  }

  return commandArgs[flagIndex + 1];
}

function readDebtModeFlag(commandArgs) {
  const debtMode = readFlagValue(commandArgs, "--debt-mode");

  if (!debtMode) {
    return undefined;
  }

  if (!["changed-only", "all"].includes(debtMode)) {
    throw new Error(`Invalid --debt-mode value: ${debtMode}`);
  }

  return debtMode;
}

function readWorkspaceTarget(commandArgs) {
  return readFlagValue(commandArgs, "--workspace");
}

function shouldRunAllWorkspaces(flags) {
  return flags.has("--workspaces");
}

module.exports = {
  createCliArgs,
  readFlagValue,
  readDebtModeFlag,
  readWorkspaceTarget,
  shouldRunAllWorkspaces,
};
