import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime, {
  createUserMessage,
  LlmAdapter,
  ReasoningEffortId,
  type GenerateOptions,
  type LlmResolvedModelInfo,
  type StreamChunk,
} from '@deepseek-ai/dsh-llm'
import { AutoReasoningAdapter } from '../src/adapter.js'
import { resolveConfig } from '../src/config.js'

class RecordingAdapter extends LlmAdapter {
  readonly requests: GenerateOptions[] = []

  constructor(private readonly withReasoning: boolean) {
    super()
  }

  override listModels(provider: string): Promise<readonly LlmResolvedModelInfo[]> {
    return Promise.resolve([this.info(provider, 'model')])
  }

  private info(provider: string, model: string): LlmResolvedModelInfo {
    return {
      provider,
      id: model,
      name: 'Upstream Model',
      inputModalities: ['text', 'image'],
      context: { contextWindow: 100_000 },
      ...(this.withReasoning ? {
        reasoning: {
          efforts: ['off', 'high', 'max'].map(id => ({ id: ReasoningEffortId(id), name: id })),
          defaultEffort: ReasoningEffortId('high'),
        },
      } : {}),
    }
  }

  override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    return Promise.resolve(this.info(provider, model))
  }

  override async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options)
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'text-delta', index: 0, text: 'OK' }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: 'OK' } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

async function fixture(withReasoning = true): Promise<{ ctx: Context; upstream: RecordingAdapter }> {
  const ctx = new Context()
  await ctx.plugin(LlmRuntime)
  const upstream = new RecordingAdapter(withReasoning)
  ctx.llm.registerAdapter(['upstream'], upstream)
  const config = resolveConfig({
    routes: [{ provider: 'auto-reasoning', upstreamProvider: 'upstream' }],
    logDecisions: false,
  })
  ctx.llm.registerAdapter(['auto-reasoning'], new AutoReasoningAdapter(ctx, config))
  return { ctx, upstream }
}

async function run(ctx: Context, text: string, reasoningEffort?: string): Promise<void> {
  const message = createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text }] })
  for await (const _chunk of ctx.llm.stream({
    provider: 'auto-reasoning',
    model: 'model',
    messages: [message],
    ...(reasoningEffort === undefined ? {} : { reasoningEffort: ReasoningEffortId(reasoningEffort) }),
  })) {
    // Consume the complete stream.
  }
}

describe('AutoReasoningAdapter', () => {
  it('advertises Auto while preserving upstream capabilities', async () => {
    const { ctx } = await fixture()
    const info = await ctx.llm.resolveModelInfo('auto-reasoning', 'model')
    assert.equal(info.reasoning?.defaultEffort, 'auto')
    assert.deepEqual(info.reasoning?.efforts.map(effort => String(effort.id)), ['auto', 'off', 'high', 'max'])
    assert.deepEqual(info.inputModalities, ['text', 'image'])
    assert.equal(info.context?.contextWindow, 100_000)
  })

  it('routes an ordinary automatic request to high', async () => {
    const { ctx, upstream } = await fixture()
    await run(ctx, '今天有什么热点新闻？')
    assert.equal(upstream.requests[0]?.provider, 'upstream')
    assert.equal(upstream.requests[0]?.reasoningEffort, 'high')
  })

  it('routes a complex automatic request to max', async () => {
    const { ctx, upstream } = await fixture()
    await run(ctx, '请深度研究最新财报，完成 DCF 估值和敏感性分析。')
    assert.equal(upstream.requests[0]?.reasoningEffort, 'max')
  })

  it('respects a manually selected effort', async () => {
    const { ctx, upstream } = await fixture()
    await run(ctx, '请深度研究最新财报并完成估值。', 'high')
    assert.equal(upstream.requests[0]?.reasoningEffort, 'high')
  })

  it('works with an upstream model that has no reasoning controls', async () => {
    const { ctx, upstream } = await fixture(false)
    await run(ctx, '请深度研究这个问题。')
    assert.equal(upstream.requests[0]?.reasoningEffort, undefined)
  })

  it('mirrors a dynamic upstream model catalog when no allow-list is configured', async () => {
    const { ctx } = await fixture()
    const models = await ctx.llm.listModels('auto-reasoning')
    assert.deepEqual(models.map(model => model.id), ['model'])
  })
})
