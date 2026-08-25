import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Config, resolveConfig } from '../src/config.js'

describe('resolveConfig', () => {
  it('provides a usable default route', () => {
    const config = resolveConfig()
    assert.equal(config.routes[0]?.provider, 'auto-reasoning')
    assert.equal(config.routes[0]?.upstreamProvider, 'deepseek-official')
  })

  it('materializes the default route when a loader supplies only an override', () => {
    const parsed = Config({ decisionLogLevel: 'warn' })
    assert.equal(parsed.routes?.[0]?.provider, 'auto-reasoning')
    assert.equal(parsed.decisionLogLevel, 'warn')
  })

  it('rejects duplicate and recursive plugin-owned routes', () => {
    assert.throws(() => resolveConfig({ routes: [
      { provider: 'auto', upstreamProvider: 'one' },
      { provider: 'auto', upstreamProvider: 'two' },
    ] }), /must be unique/)
    assert.throws(() => resolveConfig({ routes: [
      { provider: 'one', upstreamProvider: 'two' },
      { provider: 'two', upstreamProvider: 'base' },
    ] }), /plugin-owned provider/)
  })

  it('rejects an unknown decision log level', () => {
    assert.throws(() => resolveConfig({ decisionLogLevel: 'loud' }), /decisionLogLevel/)
  })

  it('rejects an explicitly empty route list', () => {
    assert.throws(() => resolveConfig({ routes: [] }), /must not be empty/)
  })
})
