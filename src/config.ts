import z from '@deepseek-ai/schemastery'

export const DEFAULT_AUTO_EFFORT_ID = 'auto'
export const DEFAULT_THRESHOLD = 6
export const DEFAULT_MAX_DECISION_CACHE_ENTRIES = 2048
export const DEFAULT_DECISION_LOG_LEVEL = 'info'
export type DecisionLogLevel = 'debug' | 'info' | 'warn'

const DEFAULT_ROUTE: RouteConfig = {
  provider: 'auto-reasoning',
  name: 'Auto Reasoning',
  upstreamProvider: 'deepseek-official',
  models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
}

export interface RouteConfig {
  /** Provider route exposed by this plugin. */
  provider: string
  /** Human-readable provider name. */
  name?: string
  /** Existing provider that receives the real request. */
  upstreamProvider: string
  /** Optional allow-list. Omit to mirror the upstream provider catalog. */
  models?: string[]
  /** Exact upstream effort for ordinary tasks when generic mapping is insufficient. */
  normalEffort?: string
  /** Exact upstream effort for complex tasks when generic mapping is insufficient. */
  complexEffort?: string
}

export interface Config {
  routes?: RouteConfig[]
  /** Effort id advertised as the plugin-owned automatic choice. */
  autoEffortId?: string
  /** Score at or above which a request is complex. */
  threshold?: number
  /** Extra trusted-user-text keywords worth three points each. */
  additionalComplexKeywords?: string[]
  /** Emit a content-free decision audit line for each automatic call. */
  logDecisions?: boolean
  /** Logger severity for decision audit lines. */
  decisionLogLevel?: string
  /** Bounded per-turn escalation cache. */
  maxDecisionCacheEntries?: number
}

export interface ResolvedRoute {
  provider: string
  name: string
  upstreamProvider: string
  models?: readonly string[]
  normalEffort?: string
  complexEffort?: string
}

export interface ResolvedConfig {
  routes: readonly ResolvedRoute[]
  autoEffortId: string
  threshold: number
  additionalComplexKeywords: readonly string[]
  logDecisions: boolean
  decisionLogLevel: DecisionLogLevel
  maxDecisionCacheEntries: number
}

const RouteSchema: z<RouteConfig> = z.object({
  provider: z.string().required(),
  name: z.string(),
  upstreamProvider: z.string().required(),
  models: z.array(z.string()).min(1),
  normalEffort: z.string(),
  complexEffort: z.string(),
})

export const Config: z<Config> = z.object({
  routes: z.array(RouteSchema).min(1).default([DEFAULT_ROUTE]),
  autoEffortId: z.string().default(DEFAULT_AUTO_EFFORT_ID),
  threshold: z.number().step(1).min(1).max(100).default(DEFAULT_THRESHOLD),
  additionalComplexKeywords: z.array(z.string()).default([]),
  logDecisions: z.boolean().default(true),
  decisionLogLevel: z.string().default(DEFAULT_DECISION_LOG_LEVEL),
  maxDecisionCacheEntries: z.number().step(1).min(1).max(100_000).default(DEFAULT_MAX_DECISION_CACHE_ENTRIES),
})

function requiredName(value: string | undefined, label: string): string {
  const normalized = value?.trim() ?? ''
  if (normalized.length === 0) throw new Error(`dsh-auto-reasoning: ${label} must not be empty`)
  return normalized
}

function optionalName(value: string | undefined, label: string): string | undefined {
  if (value === undefined) return undefined
  return requiredName(value, label)
}

export function resolveConfig(config: Config = {}): ResolvedConfig {
  const sourceRoutes = config.routes ?? [DEFAULT_ROUTE]
  if (sourceRoutes.length === 0) throw new Error('dsh-auto-reasoning: routes must not be empty')
  const routes = sourceRoutes.map((route, index): ResolvedRoute => {
    const provider = requiredName(route.provider, `routes[${index}].provider`)
    const upstreamProvider = requiredName(route.upstreamProvider, `routes[${index}].upstreamProvider`)
    const models = route.models?.map((model, modelIndex) =>
      requiredName(model, `routes[${index}].models[${modelIndex}]`))
    if (models !== undefined && new Set(models).size !== models.length) {
      throw new Error(`dsh-auto-reasoning: routes[${index}].models must not contain duplicates`)
    }
    const normalEffort = optionalName(route.normalEffort, `routes[${index}].normalEffort`)
    const complexEffort = optionalName(route.complexEffort, `routes[${index}].complexEffort`)
    return {
      provider,
      name: route.name?.trim() || 'Auto Reasoning',
      upstreamProvider,
      ...(models === undefined ? {} : { models }),
      ...(normalEffort === undefined ? {} : { normalEffort }),
      ...(complexEffort === undefined ? {} : { complexEffort }),
    }
  })
  const providers = routes.map(route => route.provider)
  if (new Set(providers).size !== providers.length) {
    throw new Error('dsh-auto-reasoning: route providers must be unique')
  }
  const providerSet = new Set(providers)
  for (const route of routes) {
    if (providerSet.has(route.upstreamProvider)) {
      throw new Error(`dsh-auto-reasoning: route "${route.provider}" points to plugin-owned provider "${route.upstreamProvider}"`)
    }
  }
  const additionalComplexKeywords = (config.additionalComplexKeywords ?? [])
    .map((keyword, index) => requiredName(keyword, `additionalComplexKeywords[${index}]`))
  const decisionLogLevel = requiredName(config.decisionLogLevel ?? DEFAULT_DECISION_LOG_LEVEL, 'decisionLogLevel')
  if (!['debug', 'info', 'warn'].includes(decisionLogLevel)) {
    throw new Error('dsh-auto-reasoning: decisionLogLevel must be debug, info, or warn')
  }
  return {
    routes,
    autoEffortId: requiredName(config.autoEffortId ?? DEFAULT_AUTO_EFFORT_ID, 'autoEffortId'),
    threshold: config.threshold ?? DEFAULT_THRESHOLD,
    additionalComplexKeywords,
    logDecisions: config.logDecisions ?? true,
    decisionLogLevel: decisionLogLevel as DecisionLogLevel,
    maxDecisionCacheEntries: config.maxDecisionCacheEntries ?? DEFAULT_MAX_DECISION_CACHE_ENTRIES,
  }
}
