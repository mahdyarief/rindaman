const IMPLEMENTATION_INTENT_KEYWORDS = [
  "architecture",
  "api",
  "frontend",
  "backend",
  "auth",
  "database",
  "model",
  "schema",
  "contract",
  "session",
  "feature architecture",
  "data flow",
]

const GOVERNANCE_ONLY_KEYWORDS = [
  "review",
  "status",
  "release",
  "version",
  "push",
  "commit",
  "verify",
  "test",
  "doctor",
]

export const isImplementationOrArchitectureRequest = (text: string) => {
  const normalizedText = text.toLowerCase()
  const hasImplementationKeyword = IMPLEMENTATION_INTENT_KEYWORDS.some((keyword) =>
    normalizedText.includes(keyword),
  )
  const hasGovernanceOnlyKeyword = GOVERNANCE_ONLY_KEYWORDS.some((keyword) =>
    normalizedText.includes(keyword),
  )

  return hasImplementationKeyword && !hasGovernanceOnlyKeyword
}

export const getSeniorFullstackEnabled = (
  messages: TransformMessage[],
  getMessageRole: (message: TransformMessage) => string | undefined,
  getMessageText: (message: TransformMessage) => string,
) => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]

    if (getMessageRole(message) !== "user") {
      continue
    }

    const text = getMessageText(message)

    if (!text) {
      continue
    }

    if (isImplementationOrArchitectureRequest(text)) {
      return true
    }
  }

  return false
}
import type { TransformMessage } from "./rule-messages.js"
