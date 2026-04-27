import type { RindamanMode } from "./options.js";
export declare const normalizeCommandText: (text: string) => string;
export declare const getRindamanToggle: (text: string) => boolean | undefined;
export declare const getRindamanModeOverride: (text: string) => RindamanMode | undefined;
export declare const getRindamanEnabled: (messages: TransformMessage[], getMessageRole: (message: TransformMessage) => string | undefined, getMessageText: (message: TransformMessage) => string) => boolean;
import type { TransformMessage } from "./rule-messages.js";
