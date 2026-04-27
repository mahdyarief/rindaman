import type { RindamanMode } from "./options.js";
export type SessionQualityState = {
    changedFiles: string[];
    lastCheckAt?: string;
    lastCheckStatus?: string;
    lastCheckCommand?: string;
    lastCheckExitCode?: number | null;
    dirtySinceCheck?: boolean;
};
export type CheckFreshness = "not_run" | "fresh" | "stale";
export declare const sessionEnabledStates: Map<string, boolean>;
export declare const sessionSeniorFullstackStates: Map<string, boolean>;
export declare const getSessionState: (sessionID: string) => SessionQualityState;
export declare const getSessionMode: (sessionID: string) => RindamanMode | undefined;
export declare const setSessionMode: (sessionID: string, mode: RindamanMode) => void;
