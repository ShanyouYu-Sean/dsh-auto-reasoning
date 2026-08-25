import { LlmError, ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import type {
  LlmModelReasoningInfo,
  LlmReasoningEffortInfo,
  ReasoningEffortId as ReasoningEffort,
} from '@deepseek-ai/dsh-llm'
import type { ComplexityTier } from './complexity.js'
import type { ResolvedRoute } from './config.js'

interface RankedEffort {
  effort: LlmReasoningEffortInfo
  rank?: number
}

function normalized(value: string): string[] {
  return value.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)
}

function effortRank(effort: LlmReasoningEffortInfo): number | undefined {
  const words = new Set([...normalized(String(effort.id)), ...normalized(effort.name)])
  if ([...words].some(word => ['max', 'maximum', 'xhigh', 'highest', 'ultra', 'extreme'].includes(word))) return 4
  if (words.has('high')) return 3
  if ([...words].some(word => ['medium', 'moderate', 'normal', 'standard', 'balanced'].includes(word))) return 2
  if ([...words].some(word => ['low', 'minimal', 'minimum', 'xlow', 'lowest', 'basic'].includes(word))) return 1
  if ([...words].some(word => ['off', 'none', 'disabled', 'zero'].includes(word))) return 0
  return undefined
}

function exactEffort(reasoning: LlmModelReasoningInfo, configured: string, field: string): ReasoningEffort {
  const found = reasoning.efforts.find(effort => String(effort.id) === configured)
  if (found === undefined) {
    throw new LlmError(`dsh-auto-reasoning: configured ${field} "${configured}" is not supported by the upstream model`, 'INVALID_REASONING_ROUTE')
  }
  return found.id
}

function ranked(reasoning: LlmModelReasoningInfo): RankedEffort[] {
  return reasoning.efforts.map((effort) => {
    const rank = effortRank(effort)
    return { effort, ...(rank === undefined ? {} : { rank }) }
  })
}

function bestKnown(reasoning: LlmModelReasoningInfo, tier: ComplexityTier): ReasoningEffort | undefined {
  const candidates = ranked(reasoning).filter((item): item is RankedEffort & { rank: number } => item.rank !== undefined)
  if (candidates.length === 0) return reasoning.defaultEffort
  if (tier === 'complex') {
    return candidates.reduce((best, item) => item.rank > best.rank ? item : best).effort.id
  }
  const atOrBelowHigh = candidates.filter(item => item.rank <= 3)
  if (atOrBelowHigh.length > 0) {
    return atOrBelowHigh.reduce((best, item) => item.rank > best.rank ? item : best).effort.id
  }
  return candidates.reduce((best, item) => item.rank < best.rank ? item : best).effort.id
}

export function chooseEffort(
  reasoning: LlmModelReasoningInfo | undefined,
  tier: ComplexityTier,
  route: ResolvedRoute,
): ReasoningEffort | undefined {
  if (reasoning === undefined || reasoning.efforts.length === 0) return undefined
  const configured = tier === 'complex' ? route.complexEffort : route.normalEffort
  if (configured !== undefined) return exactEffort(reasoning, configured, tier === 'complex' ? 'complexEffort' : 'normalEffort')
  return bestKnown(reasoning, tier)
}

export function automaticReasoningInfo(
  upstream: LlmModelReasoningInfo | undefined,
  autoEffortId: string,
): LlmModelReasoningInfo {
  const autoId = ReasoningEffortId(autoEffortId)
  return {
    efforts: [
      {
        id: autoId,
        name: 'Auto',
        description: 'Automatically select an upstream reasoning effort for each request.',
      },
      ...(upstream?.efforts.filter(effort => String(effort.id) !== autoEffortId) ?? []),
    ],
    defaultEffort: autoId,
  }
}
