import { AutoReasoningAdapter } from './adapter.js';
import { Config, resolveConfig } from './config.js';
export { AutoReasoningAdapter } from './adapter.js';
export { classifyComplexity, EscalationCache } from './complexity.js';
export { Config, resolveConfig } from './config.js';
export { automaticReasoningInfo, chooseEffort } from './effort.js';
export const name = 'dsh-auto-reasoning';
export const inject = ['llm'];
export { Config as defaultConfigSchema };
export function apply(ctx, config) {
    const resolved = resolveConfig(config);
    ctx.llm.registerAdapter(resolved.routes.map(route => route.provider), new AutoReasoningAdapter(ctx, resolved));
}
//# sourceMappingURL=index.js.map