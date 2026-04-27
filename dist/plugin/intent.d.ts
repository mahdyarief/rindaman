export declare const isImplementationOrArchitectureRequest: (text: string) => boolean;
export declare const getSeniorFullstackEnabled: (messages: TransformMessage[], getMessageRole: (message: TransformMessage) => string | undefined, getMessageText: (message: TransformMessage) => string) => boolean;
import type { TransformMessage } from "./rule-messages.js";
