import type { Context } from '@deepseek-ai/cordis';
import { Config } from './config.js';
import type { Config as PluginConfig } from './config.js';
export { AutoReasoningAdapter } from './adapter.js';
export { classifyComplexity, EscalationCache } from './complexity.js';
export type { ComplexityDecision, ComplexityTier } from './complexity.js';
export { Config, resolveConfig } from './config.js';
export type { Config as AutoReasoningConfig, ResolvedConfig, ResolvedRoute, RouteConfig } from './config.js';
export { automaticReasoningInfo, chooseEffort } from './effort.js';
export declare const name = "dsh-auto-reasoning";
export declare const inject: string[];
export { Config as defaultConfigSchema };
export declare function apply(ctx: Context, config: PluginConfig): void;
//# sourceMappingURL=index.d.ts.map