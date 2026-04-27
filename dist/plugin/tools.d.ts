import type { RindamanResolvedOptions } from "./options.js";
import type { FinalResponseGate } from "./final-response-gate.js";
import type { SessionQualityState } from "./session-state.js";
type ToolDependencies = {
    getSessionState: (sessionID: string) => SessionQualityState;
    createFinalResponseGate: (resolvedOptions: RindamanResolvedOptions, sessionState: SessionQualityState) => FinalResponseGate;
    isVerificationRequired: (resolvedOptions: RindamanResolvedOptions, sessionState: SessionQualityState) => boolean;
    getSeniorFullstackActive: (sessionID: string) => boolean;
};
export declare const createRindamanCheckTool: (dependencies: ToolDependencies) => {
    description: string;
    args: {
        mode: import("zod").ZodDefault<import("zod").ZodEnum<{
            doctor: "doctor";
            check: "check";
            audit: "audit";
        }>>;
        json: import("zod").ZodDefault<import("zod").ZodBoolean>;
        strict: import("zod").ZodDefault<import("zod").ZodBoolean>;
        report: import("zod").ZodDefault<import("zod").ZodBoolean>;
    };
    execute(args: {
        mode: "doctor" | "check" | "audit";
        json: boolean;
        strict: boolean;
        report: boolean;
    }, context: import("@opencode-ai/plugin").ToolContext): Promise<import("@opencode-ai/plugin").ToolResult>;
};
export declare const createRindamanStatusTool: (resolvedOptions: RindamanResolvedOptions, dependencies: ToolDependencies) => {
    description: string;
    args: {};
    execute(args: Record<string, never>, context: import("@opencode-ai/plugin").ToolContext): Promise<import("@opencode-ai/plugin").ToolResult>;
};
export {};
