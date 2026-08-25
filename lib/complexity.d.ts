import type { GenerateOptions } from '@deepseek-ai/dsh-llm';
export type ComplexityTier = 'normal' | 'complex';
export interface ComplexityDecision {
    tier: ComplexityTier;
    score: number;
    reasons: readonly string[];
    turnKey: string;
}
export interface ComplexityOptions {
    threshold: number;
    additionalComplexKeywords: readonly string[];
}
export declare function classifyComplexity(options: Pick<GenerateOptions, 'messages' | 'sessionId' | 'provider' | 'model' | 'purpose'>, config: ComplexityOptions): ComplexityDecision;
export declare class EscalationCache {
    private readonly maxEntries;
    private readonly decisions;
    constructor(maxEntries: number);
    retainHighest(candidate: ComplexityDecision): ComplexityDecision;
}
//# sourceMappingURL=complexity.d.ts.map