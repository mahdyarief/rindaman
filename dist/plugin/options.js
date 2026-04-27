const getBooleanOption = (options, key, defaultValue) => {
    const configuredValue = options?.[key];
    return typeof configuredValue === "boolean" ? configuredValue : defaultValue;
};
const getModeOption = (options) => {
    const configuredValue = options?.mode;
    return configuredValue === "core" || configuredValue === "senior"
        ? configuredValue
        : "auto";
};
export const resolvePluginOptions = (options) => ({
    enabled: getBooleanOption(options, "enabled", true),
    strictResponses: getBooleanOption(options, "strictResponses", true),
    qualityLifecycle: getBooleanOption(options, "qualityLifecycle", true),
    verificationRequired: getBooleanOption(options, "verificationRequired", true),
    mode: getModeOption(options),
});
