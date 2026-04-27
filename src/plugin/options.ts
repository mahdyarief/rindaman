import type { PluginOptions } from "@opencode-ai/plugin"

export type RindamanMode = "core" | "senior" | "reviewer" | "auto"

export type RindamanResolvedOptions = {
  enabled: boolean
  strictResponses: boolean
  qualityLifecycle: boolean
  verificationRequired: boolean
  mode: RindamanMode
}

const getBooleanOption = (
  options: PluginOptions | undefined,
  key: string,
  defaultValue: boolean,
) => {
  const configuredValue = options?.[key]

  return typeof configuredValue === "boolean" ? configuredValue : defaultValue
}

const getModeOption = (options: PluginOptions | undefined): RindamanMode => {
  const configuredValue = options?.mode

  return configuredValue === "core" || configuredValue === "senior" || configuredValue === "reviewer"
    ? configuredValue
    : "auto"
}

export const resolvePluginOptions = (
  options: PluginOptions | undefined,
): RindamanResolvedOptions => ({
  enabled: getBooleanOption(options, "enabled", true),
  strictResponses: getBooleanOption(options, "strictResponses", true),
  qualityLifecycle: getBooleanOption(options, "qualityLifecycle", true),
  verificationRequired: getBooleanOption(options, "verificationRequired", true),
  mode: getModeOption(options),
})
