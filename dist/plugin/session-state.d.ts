export type SessionQualityState = {
    changedFiles: string[];
    lastCheckAt?: string;
    lastCheckStatus?: string;
    lastCheckCommand?: string;
    lastCheckExitCode?: number | null;
};
export declare const sessionEnabledStates: Map<string, boolean>;
export declare const sessionSeniorFullstackStates: Map<string, boolean>;
export declare const getSessionState: (sessionID: string) => SessionQualityState;
