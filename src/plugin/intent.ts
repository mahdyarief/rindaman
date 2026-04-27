const IMPLEMENTATION_VERBS = ["implement", "build", "create", "add", "wire", "refactor"]
const ARCHITECTURE_SIGNALS = [
  "api",
  "auth",
  "schema",
  "contract",
  "database",
  "data flow",
  "feature architecture",
  "backend",
  "frontend",
]
const GOVERNANCE_SIGNALS = ["review", "status", "release", "verify", "push", "commit", "doctor"]

export type SeniorEngineerActivation = {
  active: boolean
  intent: "implementation" | "architecture" | "review" | "release" | "status" | "none"
  reason: string
  intentSource: "forced-mode" | "auto-signals" | "none"
  matchedSignals: string[]
}

const collectMatchedSignals = (text: string, signals: string[]) =>
  signals.filter((signal) => text.includes(signal))

export const analyzeSeniorFullstackActivation = (
  messages: TransformMessage[],
  getMessageRole: (message: TransformMessage) => string | undefined,
  getMessageText: (message: TransformMessage) => string,
): SeniorEngineerActivation => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]

    if (getMessageRole(message) !== "user") {
      continue
    }

    const normalizedText = getMessageText(message).toLowerCase()

    if (!normalizedText) {
      continue
    }

    const implementationSignals = collectMatchedSignals(normalizedText, IMPLEMENTATION_VERBS)
    const architectureSignals = collectMatchedSignals(normalizedText, ARCHITECTURE_SIGNALS)
    const governanceSignals = collectMatchedSignals(normalizedText, GOVERNANCE_SIGNALS)

    if (governanceSignals.length > 0 && implementationSignals.length === 0) {
      return {
        active: false,
        intent: "review",
        reason: "governance-oriented request detected",
        intentSource: "auto-signals",
        matchedSignals: governanceSignals,
      }
    }

    if (implementationSignals.length > 0 && architectureSignals.length > 0) {
      return {
        active: true,
        intent: "implementation",
        reason: "implementation and product-engineering signals detected",
        intentSource: "auto-signals",
        matchedSignals: [...implementationSignals, ...architectureSignals],
      }
    }
  }

  return {
    active: false,
    intent: "none",
    reason: "no qualifying signals detected",
    intentSource: "none",
    matchedSignals: [],
  }
}
import type { TransformMessage } from "./rule-messages.js"
