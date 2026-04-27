const getBooleanOption = (options, key, defaultValue) => {
    const configuredValue = options?.[key];
    return typeof configuredValue === "boolean" ? configuredValue : defaultValue;
};
export const resolvePluginOptions = (options) => ({
    enabled: getBooleanOption(options, "enabled", true),
    strictResponses: getBooleanOption(options, "strictResponses", true),
    qualityLifecycle: getBooleanOption(options, "qualityLifecycle", true),
    verificationRequired: getBooleanOption(options, "verificationRequired", true),
});
