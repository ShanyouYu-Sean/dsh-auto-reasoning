import z from '@deepseek-ai/schemastery';
export const DEFAULT_AUTO_EFFORT_ID = 'auto';
export const DEFAULT_THRESHOLD = 6;
export const DEFAULT_MAX_DECISION_CACHE_ENTRIES = 2048;
export const DEFAULT_DECISION_LOG_LEVEL = 'info';
const DEFAULT_ROUTE = {
    provider: 'auto-reasoning',
    name: 'Auto Reasoning',
    upstreamProvider: 'deepseek-official',
    models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
};
const RouteSchema = z.object({
    provider: z.string().required(),
    name: z.string(),
    upstreamProvider: z.string().required(),
    models: z.array(z.string()).min(1),
    normalEffort: z.string(),
    complexEffort: z.string(),
});
export const Config = z.object({
    routes: z.array(RouteSchema).min(1).default([DEFAULT_ROUTE]),
    autoEffortId: z.string().default(DEFAULT_AUTO_EFFORT_ID),
    threshold: z.number().step(1).min(1).max(100).default(DEFAULT_THRESHOLD),
    additionalComplexKeywords: z.array(z.string()).default([]),
    logDecisions: z.boolean().default(true),
    decisionLogLevel: z.string().default(DEFAULT_DECISION_LOG_LEVEL),
    maxDecisionCacheEntries: z.number().step(1).min(1).max(100_000).default(DEFAULT_MAX_DECISION_CACHE_ENTRIES),
});
function requiredName(value, label) {
    const normalized = value?.trim() ?? '';
    if (normalized.length === 0)
        throw new Error(`dsh-auto-reasoning: ${label} must not be empty`);
    return normalized;
}
function optionalName(value, label) {
    if (value === undefined)
        return undefined;
    return requiredName(value, label);
}
export function resolveConfig(config = {}) {
    const sourceRoutes = config.routes ?? [DEFAULT_ROUTE];
    if (sourceRoutes.length === 0)
        throw new Error('dsh-auto-reasoning: routes must not be empty');
    const routes = sourceRoutes.map((route, index) => {
        const provider = requiredName(route.provider, `routes[${index}].provider`);
        const upstreamProvider = requiredName(route.upstreamProvider, `routes[${index}].upstreamProvider`);
        const models = route.models?.map((model, modelIndex) => requiredName(model, `routes[${index}].models[${modelIndex}]`));
        if (models !== undefined && new Set(models).size !== models.length) {
            throw new Error(`dsh-auto-reasoning: routes[${index}].models must not contain duplicates`);
        }
        const normalEffort = optionalName(route.normalEffort, `routes[${index}].normalEffort`);
        const complexEffort = optionalName(route.complexEffort, `routes[${index}].complexEffort`);
        return {
            provider,
            name: route.name?.trim() || 'Auto Reasoning',
            upstreamProvider,
            ...(models === undefined ? {} : { models }),
            ...(normalEffort === undefined ? {} : { normalEffort }),
            ...(complexEffort === undefined ? {} : { complexEffort }),
        };
    });
    const providers = routes.map(route => route.provider);
    if (new Set(providers).size !== providers.length) {
        throw new Error('dsh-auto-reasoning: route providers must be unique');
    }
    const providerSet = new Set(providers);
    for (const route of routes) {
        if (providerSet.has(route.upstreamProvider)) {
            throw new Error(`dsh-auto-reasoning: route "${route.provider}" points to plugin-owned provider "${route.upstreamProvider}"`);
        }
    }
    const additionalComplexKeywords = (config.additionalComplexKeywords ?? [])
        .map((keyword, index) => requiredName(keyword, `additionalComplexKeywords[${index}]`));
    const decisionLogLevel = requiredName(config.decisionLogLevel ?? DEFAULT_DECISION_LOG_LEVEL, 'decisionLogLevel');
    if (!['debug', 'info', 'warn'].includes(decisionLogLevel)) {
        throw new Error('dsh-auto-reasoning: decisionLogLevel must be debug, info, or warn');
    }
    return {
        routes,
        autoEffortId: requiredName(config.autoEffortId ?? DEFAULT_AUTO_EFFORT_ID, 'autoEffortId'),
        threshold: config.threshold ?? DEFAULT_THRESHOLD,
        additionalComplexKeywords,
        logDecisions: config.logDecisions ?? true,
        decisionLogLevel: decisionLogLevel,
        maxDecisionCacheEntries: config.maxDecisionCacheEntries ?? DEFAULT_MAX_DECISION_CACHE_ENTRIES,
    };
}
//# sourceMappingURL=config.js.map