import type { RagEvidence, RagMode } from '@/services/graphRag'

export interface TraceStep {
  id: string
  stage: 'normalize' | 'route' | 'match' | 'traverse' | 'rank' | 'compose'
  label: string
  inputCount: number
  outputCount: number
  ms: number
  detail?: string
}

export interface RetrievalTrace {
  traceId: string
  query: string
  mode: RagMode
  startedAt: number
  steps: TraceStep[]
  pathIds: string[]
  evidenceCount: number
  staleCount: number
  degraded: boolean
  totalMs: number
}

let traceSeq = 0

export function makeTrace(query: string, mode: RagMode, _startedAt = Date.now()): RetrievalTrace {
  const q = String(query || '').slice(0, 80)
  return {
    traceId: 'trace-' + Date.now().toString(36) + '-' + (++traceSeq).toString(36),
    query: q,
    mode,
    startedAt: _startedAt,
    steps: [
      { id: 'normalize', stage: 'normalize', label: '归一化问题', inputCount: 1, outputCount: q ? 1 : 0, ms: 0 },
      { id: 'route', stage: 'route', label: '选择 ' + mode + ' 检索', inputCount: q ? 1 : 0, outputCount: 1, ms: 0 }
    ],
    pathIds: [],
    evidenceCount: 0,
    staleCount: 0,
    degraded: false,
    totalMs: 0
  }
}

export function finishTrace(trace: RetrievalTrace, evidence: RagEvidence, endedAt = Date.now()): RetrievalTrace {
  const lines = evidence.lines || []
  const paths = evidence.paths || []
  const started = trace.startedAt
  const steps = trace.steps.concat([
    {
      id: 'match',
      stage: 'match' as const,
      label: '装配图谱证据',
      inputCount: 1,
      outputCount: lines.length,
      ms: 0
    },
    {
      id: 'compose',
      stage: 'compose' as const,
      label: '整理可读依据',
      inputCount: lines.length,
      outputCount: Math.min(3, paths.length),
      ms: Math.max(0, endedAt - started)
    }
  ]).slice(0, 8)

  return {
    ...trace,
    steps,
    pathIds: paths.map((path) => path.nodes.join('>')),
    evidenceCount: lines.length + paths.length,
    staleCount: evidence.stale ? 1 : 0,
    degraded: evidence.stale || (lines.length === 0 && paths.length === 0),
    totalMs: Math.max(0, endedAt - started)
  }
}
