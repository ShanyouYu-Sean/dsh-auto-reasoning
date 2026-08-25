import z from '@deepseek-ai/schemastery';
export declare const DEFAULT_AUTO_EFFORT_ID = "auto";
export declare const DEFAULT_THRESHOLD = 6;
export declare const DEFAULT_MAX_DECISION_CACHE_ENTRIES = 2048;
export declare const DEFAULT_DECISION_LOG_LEVEL = "info";
export type DecisionLogLevel = 'debug' | 'info' | 'warn';
export interface RouteConfig {
    /** Provider route exposed by this plugin. */
    provider: string;
    /** Human-readable provider name. */
    name?: string;
    /** Existing provider that receives the real request. */
    upstreamProvider: string;
    /** Optional allow-list. Omit to mirror the upstream provider catalog. */
    models?: string[];
    /** Exact upstream effort for ordinary tasks when generic mapping is insufficient. */
    normalEffort?: string;
    /** Exact upstream effort for complex tasks when generic mapping is insufficient. */
    complexEffort?: string;
}
export interface Config {
    routes?: RouteConfig[];
    /** Effort id advertised as the plugin-owned automatic choice. */
    autoEffortId?: string;
    /** Score at or above which a request is complex. */
    threshold?: number;
    /** Extra trusted-user-text keywords worth three points each. */
    additionalComplexKeywords?: string[];
    /** Emit a content-free decision audit line for each automatic call. */
    logDecisions?: boolean;
    /** Logger severity for decision audit lines. */
    decisionLogLevel?: string;
    /** Bounded per-turn escalation cache. */
    maxDecisionCacheEntries?: number;
}
export interface ResolvedRoute {
    provider: string;
    name: string;
    upstreamProvider: string;
    models?: readonly string[];
    normalEffort?: string;
    complexEffort?: string;
}
export interface ResolvedConfig {
    routes: readonly ResolvedRoute[];
    autoEffortId: string;
    threshold: number;
    additionalComplexKeywords: readonly string[];
    logDecisions: boolean;
    decisionLogLevel: DecisionLogLevel;
    maxDecisionCacheEntries: number;
}
export declare const Config: z<Config>;
export declare function resolveConfig(config?: Config): ResolvedConfig;
//# sourceMappingURL=config.d.ts.map