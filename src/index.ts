import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Plugin, PluginOptions } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";

import { RINDAMAN_RULE, RINDAMAN_RULE_MARKER } from "./rindaman-rule.js";

const RINDAMAN_ON_COMMANDS = new Set([
  "/rindaman on",
  "rindaman on",
  "/quality on",
  "quality on",
  "/strict on",
  "strict mode",
  "be strict",
]);

const RINDAMAN_OFF_COMMANDS = new Set([
  "/rindaman off",
  "rindaman off",
  "/quality off",
  "quality off",
  "/strict off",
  "normal mode",
  "stop strict",
]);

type MessagePart = {
  type?: string;
  text?: string;
};

type TransformMessage = {
  info: Record<string, unknown>;
  parts: MessagePart[];
};

type TransformOutput = {
  messages: TransformMessage[];
};


type RindamanResolvedOptions = {
  enabled: boolean;
  strictResponses: boolean;
  qualityLifecycle: boolean;
  verificationRequired: boolean;
};

const getBooleanOption = (
  options: PluginOptions | undefined,
  key: string,
  defaultValue: boolean,
) => {
  const configuredValue = options?.[key];

  return typeof configuredValue === "boolean" ? configuredValue : defaultValue;
};

const resolvePluginOptions = (
  options: PluginOptions | undefined,
): RindamanResolvedOptions => ({
  enabled: getBooleanOption(options, "enabled", true),
  strictResponses: getBooleanOption(options, "strictResponses", true),
  qualityLifecycle: getBooleanOption(options, "qualityLifecycle", true),
  verificationRequired: getBooleanOption(options, "verificationRequired", true),
});

type SessionQualityState = {
  changedFiles: string[];
  lastCheckAt?: string;
  lastCheckStatus?: string;
  lastCheckCommand?: string;
  lastCheckExitCode?: number | null;
};

type FinalResponseGate = {
  allowed: boolean;
  reason: string;
};

const sessionStates = new Map<string, SessionQualityState>();
const sessionEnabledStates = new Map<string, boolean>();

const getSessionState = (sessionID: string) => {
  const existingState = sessionStates.get(sessionID);

  if (existingState) {
    return existingState;
  }

  const initialState: SessionQualityState = { changedFiles: [] };
  sessionStates.set(sessionID, initialState);
  return initialState;
};

const isVerificationRequired = (
  resolvedOptions: RindamanResolvedOptions,
  sessionState: SessionQualityState,
) =>
  resolvedOptions.verificationRequired && sessionState.changedFiles.length > 0;

const createFinalResponseGate = (
  resolvedOptions: RindamanResolvedOptions,
  sessionState: SessionQualityState,
): FinalResponseGate => {
  if (!resolvedOptions.enabled) {
    return { allowed: true, reason: "rindaman disabled" };
  }

  if (!resolvedOptions.qualityLifecycle) {
    return { allowed: true, reason: "quality lifecycle disabled" };
  }

  if (!isVerificationRequired(resolvedOptions, sessionState)) {
    return { allowed: true, reason: "verification not required" };
  }

  if (sessionState.lastCheckStatus === "passed") {
    return { allowed: true, reason: "verification passed" };
  }

  if (sessionState.lastCheckStatus === "failed") {
    return { allowed: false, reason: "verification failed" };
  }

  if (sessionState.lastCheckStatus === "error") {
    return { allowed: false, reason: "verification errored" };
  }

  return { allowed: false, reason: "verification pending" };
};


const isRindamanRuleMessage = (message: TransformMessage) =>
  message.parts.some(
    (part) =>
      part.type === "text" &&
      typeof part.text === "string" &&
      part.text.includes(RINDAMAN_RULE_MARKER),
  );

const createRindamanRuleMessage = (): TransformMessage => ({
  info: {
    id: "rindaman-global-rule",
    role: "system",
  },
  parts: [
    {
      type: "text",
      text: RINDAMAN_RULE,
    },
  ],
});

const getMessageRole = (message: TransformMessage) =>
  typeof message.info.role === "string" ? message.info.role : undefined;

const getMessageText = (message: TransformMessage) =>
  message.parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text ?? "")
    .join("\n");

const normalizeCommandText = (text: string) =>
  text
    .trim()
    .toLowerCase()
    .replace(/^[\s"'`([{]+|[\s"'`)\]}!,.?:;]+$/g, "");

const getRindamanToggle = (text: string) => {
  const normalizedFullText = normalizeCommandText(text);

  if (RINDAMAN_ON_COMMANDS.has(normalizedFullText)) {
    return true;
  }

  if (RINDAMAN_OFF_COMMANDS.has(normalizedFullText)) {
    return false;
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => normalizeCommandText(line))
    .filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];

    if (RINDAMAN_ON_COMMANDS.has(line)) {
      return true;
    }

    if (RINDAMAN_OFF_COMMANDS.has(line)) {
      return false;
    }
  }

  return undefined;
};

const getRindamanEnabled = (messages: TransformMessage[]) => {
  let enabled = true;

  for (const message of messages) {
    if (getMessageRole(message) !== "user") {
      continue;
    }

    const text = getMessageText(message);

    if (!text) {
      continue;
    }

    const toggle = getRindamanToggle(text);

    if (typeof toggle === "boolean") {
      enabled = toggle;
    }
  }

  return enabled;
};

const getCliPath = () =>
  resolve(dirname(fileURLToPath(import.meta.url)), "..", "bin", "rindaman.cjs");

const readChangedFiles = (directory: string) => {
  const gitStatus = spawnSync("git", ["status", "--porcelain"], {
    cwd: directory,
    encoding: "utf8",
  });

  if (gitStatus.status !== 0 || !gitStatus.stdout) {
    return [];
  }

  return gitStatus.stdout
    .split(/\r?\n/)
    .map((line) => line.slice(3).trim())
    .filter(Boolean);
};

const createRindamanCheckTool = () =>
  tool({
    description:
      "Run Rindaman quality verification from the current project directory and record check status for this OpenCode session.",
    args: {
      mode: tool.schema.enum(["check", "audit", "doctor"]).default("check"),
      json: tool.schema.boolean().default(false),
      strict: tool.schema.boolean().default(false),
      report: tool.schema.boolean().default(false),
    },
    async execute(args, context) {
      const commandArgs = [getCliPath()];

      if (args.mode !== "check") {
        commandArgs.push(args.mode);
      }

      if (args.json) {
        commandArgs.push("--json");
      }

      if (args.strict) {
        commandArgs.push("--strict");
      }

      if (args.report) {
        commandArgs.push("--report");
      }

      const result = spawnSync("node", commandArgs, {
        cwd: context.directory,
        encoding: "utf8",
      });

      const sessionState = getSessionState(context.sessionID);
      const changedFiles = readChangedFiles(context.directory);

      if (changedFiles.length > 0) {
        sessionState.changedFiles = changedFiles;
      }
      sessionState.lastCheckAt = new Date().toISOString();
      sessionState.lastCheckCommand = ["node", ...commandArgs].join(" ");
      sessionState.lastCheckExitCode = result.status;
      sessionState.lastCheckStatus = result.error
        ? "error"
        : result.status === 0
          ? "passed"
          : "failed";
      const finalResponse = createFinalResponseGate(
        {
          enabled: true,
          strictResponses: true,
          qualityLifecycle: true,
          verificationRequired: true,
        },
        sessionState,
      );

      return [
        result.stdout,
        result.stderr,
        "",
        "Rindaman status: " + sessionState.lastCheckStatus,
        "Exit code: " + String(result.status),
        "Final response allowed: " + String(finalResponse.allowed),
        "Final response reason: " + finalResponse.reason,
      ]
        .filter(Boolean)
        .join("\n");
    },
  });

const createRindamanStatusTool = (resolvedOptions: RindamanResolvedOptions) =>
  tool({
    description:
      "Report Rindaman session state, changed files, and the last quality check result.",
    args: {},
    async execute(_args, context) {
      const sessionState = getSessionState(context.sessionID);
      const changedFiles = readChangedFiles(context.directory);

      if (changedFiles.length > 0) {
        sessionState.changedFiles = changedFiles;
      }
      const verificationRequired = isVerificationRequired(
        resolvedOptions,
        sessionState,
      );
      const finalResponse = createFinalResponseGate(
        resolvedOptions,
        sessionState,
      );

      return JSON.stringify(
        {
          enabled: resolvedOptions.enabled,
          strictResponses: resolvedOptions.strictResponses,
          qualityLifecycle: resolvedOptions.qualityLifecycle,
          verificationRequired,
          changedFiles: sessionState.changedFiles,
          lastCheck: {
            status: sessionState.lastCheckStatus ?? "not_run",
            command: sessionState.lastCheckCommand ?? null,
            checkedAt: sessionState.lastCheckAt ?? null,
            exitCode: sessionState.lastCheckExitCode ?? null,
          },
          finalResponse,
        },
        null,
        2,
      );
    },
  });

export const server: Plugin = async (_input, options) => {
  const resolvedOptions = resolvePluginOptions(options);

  return {
    tool: {
      rindaman_check: createRindamanCheckTool(),
      rindaman_status: createRindamanStatusTool(resolvedOptions),
    },
    "chat.message": async (input, output) => {
      const messageText = output.parts
        .filter((part) => part.type === "text" && typeof (part as { text?: unknown }).text === "string")
        .map((part) => (part as { text?: string }).text ?? "")
        .join("\n");
      const toggle = getRindamanToggle(messageText);

      if (typeof toggle === "boolean") {
        sessionEnabledStates.set(input.sessionID, toggle);
      }
    },
    "experimental.chat.system.transform": async (input, output) => {
      const sessionEnabled = input.sessionID ? sessionEnabledStates.get(input.sessionID) ?? true : true;
      const enabled = resolvedOptions.enabled && sessionEnabled;

      if (enabled && !output.system.includes(RINDAMAN_RULE)) {
        output.system.push(RINDAMAN_RULE);
      }
    },
    "experimental.chat.messages.transform": async (_input, output) => {
      const transformOutput = output as TransformOutput;

      if (!Array.isArray(transformOutput.messages)) {
        return;
      }

      const messagesWithoutRindamanRule = transformOutput.messages.filter(
        (message) => !isRindamanRuleMessage(message),
      );
      const enabled = resolvedOptions.enabled && getRindamanEnabled(messagesWithoutRindamanRule);

      transformOutput.messages = enabled
        ? [createRindamanRuleMessage(), ...messagesWithoutRindamanRule]
        : messagesWithoutRindamanRule;
    },
    "tool.execute.after": async (input, output) => {
      const sessionState = getSessionState(input.sessionID);

      if (input.tool === "edit" || input.tool.includes("file") || input.tool.includes("terminal")) {
        sessionState.lastCheckStatus = "stale";
      }

      if (typeof output.output === "string") {
        const changedFiles = output.output
          .split(/\r?\n/)
          .filter((line) => /\.(ts|tsx|js|jsx|json|md|css|scss|py|rs|go)$/.test(line.trim()));

        if (changedFiles.length > 0) {
          sessionState.changedFiles = Array.from(
            new Set([...sessionState.changedFiles, ...changedFiles]),
          );
        }
      }
    },
  };
};

export default {
  id: "rindaman",
  server,
};
