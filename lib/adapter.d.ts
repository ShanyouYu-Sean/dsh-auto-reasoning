import type { Context } from '@deepseek-ai/cordis';
import { LlmAdapter } from '@deepseek-ai/dsh-llm';
import type { GenerateOptions, LlmModelInfo, LlmProviderInfo, LlmResolvedModelInfo, StreamChunk } from '@deepseek-ai/dsh-llm';
import type { ResolvedConfig } from './config.js';
export declare class AutoReasoningAdapter extends LlmAdapter {
    private readonly ctx;
    private readonly config;
    private readonly routes;
    private readonly decisions;
    constructor(ctx: Context, config: ResolvedConfig);
    private route;
    private assertModel;
    providerInfo(provider: string): LlmProviderInfo;
    private wrappedModel;
    listModels(provider: string): Promise<readonly LlmModelInfo[]>;
    resolveModel(provider: string, model: string, signal?: AbortSignal): Promise<LlmResolvedModelInfo>;
    private decision;
    private logDecision;
    stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
}
//# sourceMappingURL=adapter.d.ts.map