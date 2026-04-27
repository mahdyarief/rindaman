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
];
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
];
export const isImplementationOrArchitectureRequest = (text) => {
    const normalizedText = text.toLowerCase();
    const hasImplementationKeyword = IMPLEMENTATION_INTENT_KEYWORDS.some((keyword) => normalizedText.includes(keyword));
    const hasGovernanceOnlyKeyword = GOVERNANCE_ONLY_KEYWORDS.some((keyword) => normalizedText.includes(keyword));
    return hasImplementationKeyword && !hasGovernanceOnlyKeyword;
};
export const getSeniorFullstackEnabled = (messages, getMessageRole, getMessageText) => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (getMessageRole(message) !== "user") {
            continue;
        }
        const text = getMessageText(message);
        if (!text) {
            continue;
        }
        if (isImplementationOrArchitectureRequest(text)) {
            return true;
        }
    }
    return false;
};
