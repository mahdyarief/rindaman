import {
  RINDAMAN_RULE,
  RINDAMAN_RULE_MARKER,
  RINDAMAN_REVIEWER_RULE,
  RINDAMAN_REVIEWER_RULE_MARKER,
  RINDAMAN_SENIOR_FULLSTACK_RULE,
  RINDAMAN_SENIOR_FULLSTACK_RULE_MARKER,
} from "../rindaman-rule.js"

export type MessagePart = {
  type?: string
  text?: string
}

export type TransformMessage = {
  info: Record<string, unknown>
  parts: MessagePart[]
}

export type TransformOutput = {
  messages: TransformMessage[]
}

export const isRindamanRuleMessage = (message: TransformMessage) =>
  message.parts.some(
    (part) =>
      part.type === "text" &&
      typeof part.text === "string" &&
      part.text.includes(RINDAMAN_RULE_MARKER),
  )

export const isSeniorFullstackRuleMessage = (message: TransformMessage) =>
  message.parts.some(
    (part) =>
      part.type === "text" &&
      typeof part.text === "string" &&
      part.text.includes(RINDAMAN_SENIOR_FULLSTACK_RULE_MARKER),
  )

export const isReviewerRuleMessage = (message: TransformMessage) =>
  message.parts.some(
    (part) =>
      part.type === "text" &&
      typeof part.text === "string" &&
      part.text.includes(RINDAMAN_REVIEWER_RULE_MARKER),
  )

export const createRindamanRuleMessage = (): TransformMessage => ({
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
})

export const createSeniorFullstackRuleMessage = (): TransformMessage => ({
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
})

export const createReviewerRuleMessage = (): TransformMessage => ({
  info: {
    id: "rindaman-reviewer-rule",
    role: "system",
  },
  parts: [
    {
      type: "text",
      text: RINDAMAN_REVIEWER_RULE,
    },
  ],
})

export const getMessageRole = (message: TransformMessage) =>
  typeof message.info.role === "string" ? message.info.role : undefined

export const getMessageText = (message: TransformMessage) =>
  message.parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text ?? "")
    .join("\n")
