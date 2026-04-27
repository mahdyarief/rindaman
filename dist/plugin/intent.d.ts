export type SeniorEngineerActivation = {
    active: boolean;
    intent: "implementation" | "architecture" | "review" | "release" | "status" | "none";
    reason: string;
    intentSource: "forced-mode" | "auto-signals" | "none";
    matchedSignals: string[];
};
export declare const analyzeSeniorFullstackActivation: (messages: TransformMessage[], getMessageRole: (message: TransformMessage) => string | undefined, getMessageText: (message: TransformMessage) => string) => SeniorEngineerActivation;
import type { TransformMessage } from "./rule-messages.js";
