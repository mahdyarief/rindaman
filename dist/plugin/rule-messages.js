import { RINDAMAN_RULE, RINDAMAN_RULE_MARKER, RINDAMAN_SENIOR_FULLSTACK_RULE, RINDAMAN_SENIOR_FULLSTACK_RULE_MARKER, } from "../rindaman-rule.js";
export const isRindamanRuleMessage = (message) => message.parts.some((part) => part.type === "text" &&
    typeof part.text === "string" &&
    part.text.includes(RINDAMAN_RULE_MARKER));
export const isSeniorFullstackRuleMessage = (message) => message.parts.some((part) => part.type === "text" &&
    typeof part.text === "string" &&
    part.text.includes(RINDAMAN_SENIOR_FULLSTACK_RULE_MARKER));
export const createRindamanRuleMessage = () => ({
    info: {
        id: "rindaman-global-rule",
        role: "system",
    },
    parts: [
        {
            type: "text",
            text: RINDAMAN_RULE,
        },
    ],
});
export const createSeniorFullstackRuleMessage = () => ({
    info: {
        id: "rindaman-senior-fullstack-rule",
        role: "system",
    },
    parts: [
        {
            type: "text",
            text: RINDAMAN_SENIOR_FULLSTACK_RULE,
        },
    ],
});
export const getMessageRole = (message) => typeof message.info.role === "string" ? message.info.role : undefined;
export const getMessageText = (message) => message.parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text ?? "")
    .join("\n");
