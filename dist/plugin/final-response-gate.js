export const isVerificationRequired = (resolvedOptions, sessionState) => resolvedOptions.verificationRequired && sessionState.changedFiles.length > 0;
export const createFinalResponseGate = (resolvedOptions, sessionState) => {
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
