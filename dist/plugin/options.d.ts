import type { PluginOptions } from "@opencode-ai/plugin";
export type RindamanMode = "core" | "senior" | "auto";
export type RindamanResolvedOptions = {
    enabled: boolean;
    strictResponses: boolean;
    qualityLifecycle: boolean;
    verificationRequired: boolean;
    mode: RindamanMode;
};
export declare const resolvePluginOptions: (options: PluginOptions | undefined) => RindamanResolvedOptions;
