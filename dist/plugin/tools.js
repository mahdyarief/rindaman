import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tool } from "@opencode-ai/plugin";
const getCliPath = () => resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "bin", "rindaman.cjs");
const readChangedFiles = (directory) => {
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
export const createRindamanCheckTool = (dependencies) => tool({
    description: "Run Rindaman quality verification from the current project directory and record check status for this OpenCode session.",
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
        const sessionState = dependencies.getSessionState(context.sessionID);
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
        const finalResponse = dependencies.createFinalResponseGate({
            enabled: true,
            strictResponses: true,
            qualityLifecycle: true,
            verificationRequired: true,
            mode: "auto",
        }, sessionState);
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
export const createRindamanStatusTool = (resolvedOptions, dependencies) => tool({
    description: "Report Rindaman session state, changed files, and the last quality check result.",
    args: {},
    async execute(_args, context) {
        const sessionState = dependencies.getSessionState(context.sessionID);
        const changedFiles = readChangedFiles(context.directory);
        if (changedFiles.length > 0) {
            sessionState.changedFiles = changedFiles;
        }
        const verificationRequired = dependencies.isVerificationRequired(resolvedOptions, sessionState);
        const finalResponse = dependencies.createFinalResponseGate(resolvedOptions, sessionState);
        const seniorFullstackActive = dependencies.getSeniorFullstackActive(context.sessionID);
        const sessionMode = dependencies.getSessionMode(context.sessionID);
        const effectiveMode = sessionMode ?? resolvedOptions.mode;
        const seniorEngineerMetadata = dependencies.getSeniorEngineerMetadata(context.sessionID) ?? {
            active: seniorFullstackActive,
            intent: "none",
            reason: "no activation analysis recorded",
            intentSource: "none",
            matchedSignals: [],
        };
        return JSON.stringify({
            enabled: resolvedOptions.enabled,
            strictResponses: resolvedOptions.strictResponses,
            qualityLifecycle: resolvedOptions.qualityLifecycle,
            mode: effectiveMode,
            verificationRequired,
            changedFiles: sessionState.changedFiles,
            lastCheck: {
                status: sessionState.lastCheckStatus ?? "not_run",
                command: sessionState.lastCheckCommand ?? null,
                checkedAt: sessionState.lastCheckAt ?? null,
                exitCode: sessionState.lastCheckExitCode ?? null,
            },
            seniorFullstack: {
                active: seniorFullstackActive,
            },
            seniorEngineer: {
                active: seniorEngineerMetadata.active,
                reason: seniorEngineerMetadata.reason,
                intent: seniorEngineerMetadata.intent,
                intentSource: seniorEngineerMetadata.intentSource,
                matchedSignals: seniorEngineerMetadata.matchedSignals,
            },
            finalResponse,
        }, null, 2);
    },
});
