export type MessagePart = {
    type?: string;
    text?: string;
};
export type TransformMessage = {
    info: Record<string, unknown>;
    parts: MessagePart[];
};
export type TransformOutput = {
    messages: TransformMessage[];
};
export declare const isRindamanRuleMessage: (message: TransformMessage) => boolean;
export declare const isSeniorFullstackRuleMessage: (message: TransformMessage) => boolean;
export declare const isReviewerRuleMessage: (message: TransformMessage) => boolean;
export declare const createRindamanRuleMessage: () => TransformMessage;
export declare const createSeniorFullstackRuleMessage: () => TransformMessage;
export declare const createReviewerRuleMessage: () => TransformMessage;
export declare const getMessageRole: (message: TransformMessage) => string | undefined;
export declare const getMessageText: (message: TransformMessage) => string;
