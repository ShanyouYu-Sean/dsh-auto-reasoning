import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import type { LlmModelReasoningInfo } from '@deepseek-ai/dsh-llm'
import { chooseEffort } from '../src/effort.js'
import type { ResolvedRoute } from '../src/config.js'

const ROUTE: ResolvedRoute = {
  provider: 'auto-reasoning',
  name: 'Auto Reasoning',
  upstreamProvider: 'upstream',
}

function reasoning(ids: string[], defaultEffort?: string): LlmModelReasoningInfo {
  return {
    efforts: ids.map(id => ({ id: ReasoningEffortId(id), name: id })),
    ...(defaultEffort === undefined ? {} : { defaultEffort: ReasoningEffortId(defaultEffort) }),
  }
}

describe('chooseEffort', () => {
  it('maps normal to high and complex to max', () => {
    const info = reasoning(['off', 'high', 'max'], 'high')
    assert.equal(chooseEffort(info, 'normal', ROUTE), 'high')
    assert.equal(chooseEffort(info, 'complex', ROUTE), 'max')
  })

  it('uses the highest available level when max is absent', () => {
    const info = reasoning(['low', 'medium', 'high'], 'medium')
    assert.equal(chooseEffort(info, 'normal', ROUTE), 'high')
    assert.equal(chooseEffort(info, 'complex', ROUTE), 'high')
  })

  it('preserves the provider default for unknown vocabularies', () => {
    const info = reasoning(['fast', 'careful'], 'careful')
    assert.equal(chooseEffort(info, 'normal', ROUTE), 'careful')
    assert.equal(chooseEffort(info, 'complex', ROUTE), 'careful')
  })

  it('uses explicit route mappings and rejects invalid mappings', () => {
    const info = reasoning(['brief', 'deep'])
    const route = { ...ROUTE, normalEffort: 'brief', complexEffort: 'deep' }
    assert.equal(chooseEffort(info, 'normal', route), 'brief')
    assert.equal(chooseEffort(info, 'complex', route), 'deep')
    assert.throws(() => chooseEffort(info, 'complex', { ...route, complexEffort: 'missing' }), /not supported/)
  })

  it('omits reasoning for models without the capability', () => {
    assert.equal(chooseEffort(undefined, 'complex', ROUTE), undefined)
  })
})
