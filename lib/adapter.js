import { LlmAdapter, LlmError } from '@deepseek-ai/dsh-llm';
import { classifyComplexity, EscalationCache } from './complexity.js';
import { automaticReasoningInfo, chooseEffort } from './effort.js';
export class AutoReasoningAdapter extends LlmAdapter {
    ctx;
    config;
    routes;
    decisions;
    constructor(ctx, config) {
        super();
        this.ctx = ctx;
        this.config = config;
        this.routes = new Map(config.routes.map(route => [route.provider, route]));
        this.decisions = new EscalationCache(config.maxDecisionCacheEntries);
    }
    route(provider) {
        const route = this.routes.get(provider);
        if (route === undefined)
            throw new LlmError(`Auto Reasoning provider "${provider}" is not configured`, 'INVALID_PROVIDER');
        return route;
    }
    assertModel(route, model) {
        if (route.models !== undefined && !route.models.includes(model)) {
            throw new LlmError(`Auto Reasoning model "${model}" is not configured for provider "${route.provider}"`, 'INVALID_MODEL');
        }
    }
    providerInfo(provider) {
        const route = this.route(provider);
        return { id: provider, name: route.name };
    }
    async wrappedModel(route, model, signal) {
        this.assertModel(route, model);
        const upstream = await this.ctx.llm.resolveModelInfo(route.upstreamProvider, model, signal);
        return {
            ...upstream,
            provider: route.provider,
            id: model,
            name: `${upstream.name} · Auto Reasoning`,
            description: `Automatic reasoning router; upstream: ${route.upstreamProvider}/${model}`,
            reasoning: automaticReasoningInfo(upstream.reasoning, this.config.autoEffortId),
        };
    }
    async listModels(provider) {
        const route = this.route(provider);
        if (route.models !== undefined)
            return Promise.all(route.models.map(model => this.wrappedModel(route, model)));
        const models = await this.ctx.llm.listModels(route.upstreamProvider);
        return Promise.all(models.map(model => this.wrappedModel(route, model.id)));
    }
    resolveModel(provider, model, signal) {
        return this.wrappedModel(this.route(provider), model, signal);
    }
    decision(options) {
        return this.decisions.retainHighest(classifyComplexity(options, {
            threshold: this.config.threshold,
            additionalComplexKeywords: this.config.additionalComplexKeywords,
        }));
    }
    logDecision(route, options, decision, effort) {
        if (!this.config.logDecisions)
            return;
        const reasons = decision.reasons.join(',');
        const line = `dsh-auto-reasoning: provider=${route.provider} upstream=${route.upstreamProvider} model=${options.model} tier=${decision.tier} score=${decision.score} effort=${effort ?? 'provider-default'} reasons=${reasons}`;
        // DSH profiles do not always mount a Cordis log exporter. Explicit warn
        // mode is therefore sent to stderr so operators can always audit it.
        if (this.config.decisionLogLevel === 'warn')
            process.stderr.write(`${line}\n`);
        else if (this.config.decisionLogLevel === 'debug')
            this.ctx.logger.debug(line);
        else
            this.ctx.logger.info(line);
    }
    async *stream(options) {
        const route = this.route(options.provider);
        this.assertModel(route, options.model);
        const isAutomatic = options.reasoningEffort === undefined || String(options.reasoningEffort) === this.config.autoEffortId;
        if (!isAutomatic) {
            yield* this.ctx.llm.stream({ ...options, provider: route.upstreamProvider });
            return;
        }
        const decision = this.decision(options);
        const upstream = await this.ctx.llm.resolveModelInfo(route.upstreamProvider, options.model, options.signal);
        const effort = chooseEffort(upstream.reasoning, decision.tier, route);
        this.logDecision(route, options, decision, effort === undefined ? undefined : String(effort));
        const { reasoningEffort: _automatic, ...withoutAutomatic } = options;
        yield* this.ctx.llm.stream({
            ...withoutAutomatic,
            provider: route.upstreamProvider,
            ...(effort === undefined ? {} : { reasoningEffort: effort }),
        });
    }
}
//# sourceMappingURL=adapter.js.map