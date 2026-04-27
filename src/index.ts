import type { Plugin } from "@opencode-ai/plugin"

import { createFinalResponseGate, isVerificationRequired } from "./plugin/final-response-gate.js"
import {
  analyzeSeniorFullstackActivation,
  type SeniorEngineerActivation,
} from "./plugin/intent.js"
import { resolvePluginOptions, type RindamanMode } from "./plugin/options.js"
import {
  createRindamanRuleMessage,
  createReviewerRuleMessage,
  createSeniorFullstackRuleMessage,
  getMessageRole,
  getMessageText,
  isReviewerRuleMessage,
  isRindamanRuleMessage,
  isSeniorFullstackRuleMessage,
  type TransformOutput,
} from "./plugin/rule-messages.js"
import {
  getSessionMode,
  getSessionState,
  sessionEnabledStates,
  sessionSeniorFullstackStates,
  setSessionMode,
} from "./plugin/session-state.js"
import { createRindamanCheckTool, createRindamanStatusTool } from "./plugin/tools.js"
import {
  getRindamanEnabled,
  getRindamanModeOverride,
  getRindamanToggle,
} from "./plugin/toggles.js"

const getEffectiveMode = (
  configuredMode: RindamanMode,
  sessionMode: RindamanMode | undefined,
) => sessionMode ?? configuredMode

const sessionSeniorEngineerMetadata = new Map<string, SeniorEngineerActivation>()
const sessionSecondaryLayerStates = new Map<string, "none" | "senior" | "reviewer">()

export const server: Plugin = async (_input, options) => {
  const resolvedOptions = resolvePluginOptions(options)

  return {
    tool: {
      rindaman_check: createRindamanCheckTool({
        getSessionState,
        createFinalResponseGate,
        isVerificationRequired,
        getSeniorFullstackActive: (sessionID) =>
          sessionSeniorFullstackStates.get(sessionID) ?? false,
        getSessionMode,
        getSeniorEngineerMetadata: (sessionID) =>
          sessionSeniorEngineerMetadata.get(sessionID),
        getSecondaryLayer: (sessionID) =>
          sessionSecondaryLayerStates.get(sessionID) ?? "none",
      }),
      rindaman_status: createRindamanStatusTool(resolvedOptions, {
        getSessionState,
        createFinalResponseGate,
        isVerificationRequired,
        getSeniorFullstackActive: (sessionID) =>
          sessionSeniorFullstackStates.get(sessionID) ?? false,
        getSessionMode,
        getSeniorEngineerMetadata: (sessionID) =>
          sessionSeniorEngineerMetadata.get(sessionID),
        getSecondaryLayer: (sessionID) =>
          sessionSecondaryLayerStates.get(sessionID) ?? "none",
      }),
    },
    "chat.message": async (input, output) => {
      const messageText = output.parts
        .filter(
          (part) => part.type === "text" && typeof (part as { text?: unknown }).text === "string",
        )
        .map((part) => (part as { text?: string }).text ?? "")
        .join("\n")
      const toggle = getRindamanToggle(messageText)
      const modeOverride = getRindamanModeOverride(messageText)

      if (typeof toggle === "boolean") {
        sessionEnabledStates.set(input.sessionID, toggle)
      }

      if (modeOverride) {
        setSessionMode(input.sessionID, modeOverride)
      }
    },
    "experimental.chat.system.transform": async (input, output) => {
      const sessionEnabled = input.sessionID
        ? sessionEnabledStates.get(input.sessionID) ?? true
        : true
      const enabled = resolvedOptions.enabled && sessionEnabled

      if (enabled && !output.system.includes(createRindamanRuleMessage().parts[0].text ?? "")) {
        output.system.push(createRindamanRuleMessage().parts[0].text ?? "")
      }
    },
    "experimental.chat.messages.transform": async (_input, output) => {
      const transformOutput = output as TransformOutput

      if (!Array.isArray(transformOutput.messages)) {
        return
      }

      const messagesWithoutRindamanRules = transformOutput.messages.filter(
        (message) =>
          !isRindamanRuleMessage(message) &&
          !isSeniorFullstackRuleMessage(message) &&
          !isReviewerRuleMessage(message),
      )
      const enabled = resolvedOptions.enabled && getRindamanEnabled(
        messagesWithoutRindamanRules,
        getMessageRole,
        getMessageText,
      )
      const activation = analyzeSeniorFullstackActivation(
        messagesWithoutRindamanRules,
        getMessageRole,
        getMessageText,
      )
      const transformSessionID =
        typeof (_input as { sessionID?: unknown }).sessionID === "string"
          ? (_input as { sessionID?: string }).sessionID
          : undefined
      const sessionMode = transformSessionID ? getSessionMode(transformSessionID) : undefined
      const effectiveMode = getEffectiveMode(resolvedOptions.mode, sessionMode)

      const secondaryLayer =
        !enabled
          ? "none"
          : effectiveMode === "senior"
            ? "senior"
            : effectiveMode === "reviewer"
              ? "reviewer"
              : effectiveMode === "core"
                ? "none"
                : activation.intent === "review"
                  ? "reviewer"
                  : activation.active
                    ? "senior"
                    : "none"

      const effectiveSeniorFullstackEnabled = secondaryLayer === "senior"
      const effectiveReviewerEnabled = secondaryLayer === "reviewer"

      if (transformSessionID) {
        sessionSeniorFullstackStates.set(transformSessionID, effectiveSeniorFullstackEnabled)
        sessionSecondaryLayerStates.set(transformSessionID, secondaryLayer)
        sessionSeniorEngineerMetadata.set(transformSessionID, {
          ...activation,
          active: secondaryLayer !== "none",
          intentSource:
            effectiveMode === "senior"
              ? "forced-mode"
              : effectiveMode === "reviewer"
                ? "forced-mode"
              : effectiveMode === "core"
                ? "forced-mode"
                : activation.intentSource,
          reason:
            effectiveMode === "senior"
              ? "senior mode forced"
              : effectiveMode === "reviewer"
                ? "reviewer mode forced"
              : effectiveMode === "core"
                ? "core mode forced"
                : activation.reason,
        })
      }

      transformOutput.messages = enabled
        ? [
            createRindamanRuleMessage(),
            ...(effectiveSeniorFullstackEnabled ? [createSeniorFullstackRuleMessage()] : []),
            ...(effectiveReviewerEnabled ? [createReviewerRuleMessage()] : []),
            ...messagesWithoutRindamanRules,
          ]
        : messagesWithoutRindamanRules
    },
    "tool.execute.after": async (input, output) => {
      const sessionState = getSessionState(input.sessionID)

      if (
        input.tool === "edit" ||
        input.tool.includes("file") ||
        input.tool.includes("terminal")
      ) {
        sessionState.lastCheckStatus = "stale"
        sessionState.dirtySinceCheck = true
      }

      if (typeof output.output === "string") {
        const changedFiles = output.output
          .split(/\r?\n/)
          .filter((line) =>
            /\.(ts|tsx|js|jsx|json|md|css|scss|py|rs|go)$/.test(line.trim()),
          )

        if (changedFiles.length > 0) {
          sessionState.changedFiles = Array.from(
            new Set([...sessionState.changedFiles, ...changedFiles]),
          )
          sessionState.dirtySinceCheck = true
        }
      }
    },
  }
}

export default {
  id: "rindaman",
  server,
}
