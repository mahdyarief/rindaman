import type { PluginOptions } from "@opencode-ai/plugin";
export type RindamanResolvedOptions = {
    enabled: boolean;
    strictResponses: boolean;
    qualityLifecycle: boolean;
    verificationRequired: boolean;
};
export declare const resolvePluginOptions: (options: PluginOptions | undefined) => RindamanResolvedOptions;
