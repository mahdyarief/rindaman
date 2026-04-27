const IMPLEMENTATION_VERBS = ["implement", "build", "create", "add", "wire", "refactor"];
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
];
const GOVERNANCE_SIGNALS = ["review", "status", "release", "verify", "push", "commit", "doctor"];
const REVIEW_SIGNALS = ["review", "audit", "inspect", "find issues", "risks", "regression"];
const collectMatchedSignals = (text, signals) => signals.filter((signal) => text.includes(signal));
export const analyzeSeniorFullstackActivation = (messages, getMessageRole, getMessageText) => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (getMessageRole(message) !== "user") {
            continue;
        }
        const normalizedText = getMessageText(message).toLowerCase();
        if (!normalizedText) {
            continue;
        }
        const implementationSignals = collectMatchedSignals(normalizedText, IMPLEMENTATION_VERBS);
        const architectureSignals = collectMatchedSignals(normalizedText, ARCHITECTURE_SIGNALS);
        const governanceSignals = collectMatchedSignals(normalizedText, GOVERNANCE_SIGNALS);
        const reviewSignals = collectMatchedSignals(normalizedText, REVIEW_SIGNALS);
        if (reviewSignals.length > 0) {
            return {
                active: false,
                intent: "review",
                reason: "review-oriented request detected",
                intentSource: "auto-signals",
                matchedSignals: reviewSignals,
            };
        }
        if (governanceSignals.length > 0 && implementationSignals.length === 0) {
            return {
                active: false,
                intent: "review",
                reason: "governance-oriented request detected",
                intentSource: "auto-signals",
                matchedSignals: governanceSignals,
            };
        }
        if (implementationSignals.length > 0 && architectureSignals.length > 0) {
            return {
                active: true,
                intent: "implementation",
                reason: "implementation and product-engineering signals detected",
                intentSource: "auto-signals",
                matchedSignals: [...implementationSignals, ...architectureSignals],
            };
        }
    }
    return {
        active: false,
        intent: "none",
        reason: "no qualifying signals detected",
        intentSource: "none",
        matchedSignals: [],
    };
};
