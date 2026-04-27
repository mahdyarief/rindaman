import type { PluginOptions } from "@opencode-ai/plugin"

export type RindamanResolvedOptions = {
  enabled: boolean
  strictResponses: boolean
  qualityLifecycle: boolean
  verificationRequired: boolean
}

const getBooleanOption = (
  options: PluginOptions | undefined,
  key: string,
  defaultValue: boolean,
) => {
  const configuredValue = options?.[key]

  return typeof configuredValue === "boolean" ? configuredValue : defaultValue
}

export const resolvePluginOptions = (
  options: PluginOptions | undefined,
): RindamanResolvedOptions => ({
  enabled: getBooleanOption(options, "enabled", true),
  strictResponses: getBooleanOption(options, "strictResponses", true),
  qualityLifecycle: getBooleanOption(options, "qualityLifecycle", true),
  verificationRequired: getBooleanOption(options, "verificationRequired", true),
})
