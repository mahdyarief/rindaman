import type { RindamanResolvedOptions } from "./options.js"
import type { SessionQualityState } from "./session-state.js"

export type FinalResponseGate = {
  allowed: boolean
  reason: string
}

export const isVerificationRequired = (
  resolvedOptions: RindamanResolvedOptions,
  sessionState: SessionQualityState,
) => resolvedOptions.verificationRequired && sessionState.changedFiles.length > 0

export const createFinalResponseGate = (
  resolvedOptions: RindamanResolvedOptions,
  sessionState: SessionQualityState,
): FinalResponseGate => {
  if (!resolvedOptions.enabled) {
    return { allowed: true, reason: "rindaman disabled" }
  }

  if (!resolvedOptions.qualityLifecycle) {
    return { allowed: true, reason: "quality lifecycle disabled" }
  }

  if (!isVerificationRequired(resolvedOptions, sessionState)) {
    return { allowed: true, reason: "verification not required" }
  }

  if (sessionState.lastCheckStatus === "passed") {
    return { allowed: true, reason: "verification passed" }
  }

  if (sessionState.lastCheckStatus === "failed") {
    return { allowed: false, reason: "verification failed" }
  }

  if (sessionState.lastCheckStatus === "error") {
    return { allowed: false, reason: "verification errored" }
  }

  return { allowed: false, reason: "verification pending" }
}
