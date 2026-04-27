import { createFinalResponseGate, isVerificationRequired } from "./plugin/final-response-gate.js";
import { analyzeSeniorFullstackActivation, } from "./plugin/intent.js";
import { resolvePluginOptions } from "./plugin/options.js";
import { createRindamanRuleMessage, createSeniorFullstackRuleMessage, getMessageRole, getMessageText, isRindamanRuleMessage, isSeniorFullstackRuleMessage, } from "./plugin/rule-messages.js";
import { getSessionMode, getSessionState, sessionEnabledStates, sessionSeniorFullstackStates, setSessionMode, } from "./plugin/session-state.js";
import { createRindamanCheckTool, createRindamanStatusTool } from "./plugin/tools.js";
import { getRindamanEnabled, getRindamanModeOverride, getRindamanToggle, } from "./plugin/toggles.js";
const getEffectiveMode = (configuredMode, sessionMode) => sessionMode ?? configuredMode;
const sessionSeniorEngineerMetadata = new Map();
export const server = async (_input, options) => {
    const resolvedOptions = resolvePluginOptions(options);
    return {
        tool: {
            rindaman_check: createRindamanCheckTool({
                getSessionState,
                createFinalResponseGate,
                isVerificationRequired,
                getSeniorFullstackActive: (sessionID) => sessionSeniorFullstackStates.get(sessionID) ?? false,
                getSessionMode,
                getSeniorEngineerMetadata: (sessionID) => sessionSeniorEngineerMetadata.get(sessionID),
            }),
            rindaman_status: createRindamanStatusTool(resolvedOptions, {
                getSessionState,
                createFinalResponseGate,
                isVerificationRequired,
                getSeniorFullstackActive: (sessionID) => sessionSeniorFullstackStates.get(sessionID) ?? false,
                getSessionMode,
                getSeniorEngineerMetadata: (sessionID) => sessionSeniorEngineerMetadata.get(sessionID),
            }),
        },
        "chat.message": async (input, output) => {
            const messageText = output.parts
                .filter((part) => part.type === "text" && typeof part.text === "string")
                .map((part) => part.text ?? "")
                .join("\n");
            const toggle = getRindamanToggle(messageText);
            const modeOverride = getRindamanModeOverride(messageText);
            if (typeof toggle === "boolean") {
                sessionEnabledStates.set(input.sessionID, toggle);
            }
            if (modeOverride) {
                setSessionMode(input.sessionID, modeOverride);
            }
        },
        "experimental.chat.system.transform": async (input, output) => {
            const sessionEnabled = input.sessionID
                ? sessionEnabledStates.get(input.sessionID) ?? true
                : true;
            const enabled = resolvedOptions.enabled && sessionEnabled;
            if (enabled && !output.system.includes(createRindamanRuleMessage().parts[0].text ?? "")) {
                output.system.push(createRindamanRuleMessage().parts[0].text ?? "");
            }
        },
        "experimental.chat.messages.transform": async (_input, output) => {
            const transformOutput = output;
            if (!Array.isArray(transformOutput.messages)) {
                return;
            }
            const messagesWithoutRindamanRules = transformOutput.messages.filter((message) => !isRindamanRuleMessage(message) && !isSeniorFullstackRuleMessage(message));
            const enabled = resolvedOptions.enabled && getRindamanEnabled(messagesWithoutRindamanRules, getMessageRole, getMessageText);
            const activation = analyzeSeniorFullstackActivation(messagesWithoutRindamanRules, getMessageRole, getMessageText);
            const transformSessionID = typeof _input.sessionID === "string"
                ? _input.sessionID
                : undefined;
            const sessionMode = transformSessionID ? getSessionMode(transformSessionID) : undefined;
            const effectiveMode = getEffectiveMode(resolvedOptions.mode, sessionMode);
            const effectiveSeniorFullstackEnabled = effectiveMode === "senior"
                ? enabled
                : effectiveMode === "core"
                    ? false
                    : enabled && activation.active;
            if (transformSessionID) {
                sessionSeniorFullstackStates.set(transformSessionID, effectiveSeniorFullstackEnabled);
                sessionSeniorEngineerMetadata.set(transformSessionID, {
                    ...activation,
                    active: effectiveSeniorFullstackEnabled,
                    intentSource: effectiveMode === "senior"
                        ? "forced-mode"
                        : effectiveMode === "core"
                            ? "forced-mode"
                            : activation.intentSource,
                    reason: effectiveMode === "senior"
                        ? "senior mode forced"
                        : effectiveMode === "core"
                            ? "core mode forced"
                            : activation.reason,
                });
            }
            transformOutput.messages = enabled
                ? [
                    createRindamanRuleMessage(),
                    ...(effectiveSeniorFullstackEnabled ? [createSeniorFullstackRuleMessage()] : []),
                    ...messagesWithoutRindamanRules,
                ]
                : messagesWithoutRindamanRules;
        },
        "tool.execute.after": async (input, output) => {
            const sessionState = getSessionState(input.sessionID);
            if (input.tool === "edit" ||
                input.tool.includes("file") ||
                input.tool.includes("terminal")) {
                sessionState.lastCheckStatus = "stale";
            }
            if (typeof output.output === "string") {
                const changedFiles = output.output
                    .split(/\r?\n/)
                    .filter((line) => /\.(ts|tsx|js|jsx|json|md|css|scss|py|rs|go)$/.test(line.trim()));
                if (changedFiles.length > 0) {
                    sessionState.changedFiles = Array.from(new Set([...sessionState.changedFiles, ...changedFiles]));
                }
            }
        },
    };
};
export default {
    id: "rindaman",
    server,
};
