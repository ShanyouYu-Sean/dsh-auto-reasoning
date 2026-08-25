import type { LlmModelReasoningInfo, ReasoningEffortId as ReasoningEffort } from '@deepseek-ai/dsh-llm';
import type { ComplexityTier } from './complexity.js';
import type { ResolvedRoute } from './config.js';
export declare function chooseEffort(reasoning: LlmModelReasoningInfo | undefined, tier: ComplexityTier, route: ResolvedRoute): ReasoningEffort | undefined;
export declare function automaticReasoningInfo(upstream: LlmModelReasoningInfo | undefined, autoEffortId: string): LlmModelReasoningInfo;
//# sourceMappingURL=effort.d.ts.map