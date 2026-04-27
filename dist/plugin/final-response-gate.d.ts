import type { RindamanResolvedOptions } from "./options.js";
import type { SessionQualityState } from "./session-state.js";
export type FinalResponseGate = {
    allowed: boolean;
    reason: string;
};
export declare const isVerificationRequired: (resolvedOptions: RindamanResolvedOptions, sessionState: SessionQualityState) => boolean;
export declare const createFinalResponseGate: (resolvedOptions: RindamanResolvedOptions, sessionState: SessionQualityState) => FinalResponseGate;
