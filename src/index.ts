import type { Context } from '@deepseek-ai/cordis'
import { AutoReasoningAdapter } from './adapter.js'
import { Config, resolveConfig } from './config.js'
import type { Config as PluginConfig } from './config.js'

export { AutoReasoningAdapter } from './adapter.js'
export { classifyComplexity, EscalationCache } from './complexity.js'
export type { ComplexityDecision, ComplexityTier } from './complexity.js'
export { Config, resolveConfig } from './config.js'
export type { Config as AutoReasoningConfig, ResolvedConfig, ResolvedRoute, RouteConfig } from './config.js'
export { automaticReasoningInfo, chooseEffort } from './effort.js'

export const name = 'dsh-auto-reasoning'
export const inject = ['llm']
export { Config as defaultConfigSchema }

export function apply(ctx: Context, config: PluginConfig): void {
  const resolved = resolveConfig(config)
  ctx.llm.registerAdapter(
    resolved.routes.map(route => route.provider),
    new AutoReasoningAdapter(ctx, resolved),
  )
}
