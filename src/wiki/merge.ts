import { parseDocument, YAMLMap, YAMLSeq, type Document } from 'yaml'
import { buildQuestGraph, findCycle, parseQuestData, questId, type Edge, type Quest } from '../domain/index.ts'
import type { EdgeCandidate } from './edges.ts'
import type { QuestDraft } from './quest-page.ts'

// Mescla o que veio da wiki em data/quests.yaml SEM I/O, sobre o texto do
// arquivo, preservando comentários (Document API do yaml). Regra central:
// só acrescenta. Quest ou aresta que já existe nunca muda nem some, porque
// a curadoria à mão vence a coleta. Arestas novas entram com reviewed: false
// e, quando a leitura é incerta, com um comentário "revisar" que sobrevive a
// coletas futuras e alimenta a fila de revisão.

export const REVIEW_COMMENT = ' revisar: tipo ou direção lidos automaticamente; confira a frase'

export interface RegionedDraft extends QuestDraft {
  readonly region: string
}

export interface MergeInput {
  readonly yamlText: string
  readonly drafts: readonly RegionedDraft[]
  readonly candidates: readonly EdgeCandidate[]
  // "from→to" (ids) → motivo
  readonly rejected: ReadonlyMap<string, string>
}

export interface Discarded {
  readonly candidate: EdgeCandidate
  readonly reason: string
}

export interface MergeResult {
  readonly ok: boolean
  readonly yamlText: string
  readonly errors: readonly string[]
  readonly added: { readonly quests: number; readonly fields: number; readonly edges: number }
  readonly discarded: readonly Discarded[]
  // Todas as arestas não revisadas do documento resultante, não só as deste run.
  readonly unreviewed: readonly UnreviewedEdge[]
}

export interface UnreviewedEdge {
  readonly edge: Edge
  readonly flagged: boolean
}

export function mergeCollected({ yamlText, drafts, candidates, rejected }: MergeInput): MergeResult {
  const document = parseDocument(yamlText)
  const current = parseQuestData(document.toJS())
  if (!current.ok) return failure(yamlText, current.errors.map((error) => `data/quests.yaml atual inválido: ${error}`))

  const questsSeq = seqAt(document, 'quests')
  const edgesSeq = seqAt(document, 'edges')
  const quests = new Map(current.graph.quests)
  const idByTitle = new Map<string, string>()
  for (const quest of quests.values()) idByTitle.set(quest.title, quest.id)
  for (const draft of drafts) idByTitle.set(draft.title, draft.id)

  const added = { quests: 0, fields: 0, edges: 0 }
  for (const draft of drafts) {
    const existing = quests.get(questId(draft.id))
    if (existing === undefined) {
      questsSeq.add(document.createNode(toQuest(draft)))
      quests.set(questId(draft.id), toQuest(draft))
      added.quests += 1
      continue
    }
    added.fields += fillMissing(questsSeq, draft)
  }

  const accepted: Edge[] = [...current.graph.edges]
  const pairs = new Set(accepted.map((edge) => `${edge.from}→${edge.to}`))
  const discarded: Discarded[] = []
  const allQuests: Quest[] = [...quests.values()]
  // Ordem: seção de requisitos e frases inequívocas primeiro. Quando dois
  // candidatos se contradizem (ciclo), o mais explícito é o que fica.
  const ordered = [...candidates].sort(
    (a, b) => Number(a.where === 'body') - Number(b.where === 'body') || Number(a.ambiguous) - Number(b.ambiguous),
  )
  for (const candidate of ordered) {
    const from = idByTitle.get(candidate.fromTitle)
    const to = idByTitle.get(candidate.toTitle)
    if (from === undefined || to === undefined) continue
    const pair = `${from}→${to}`
    if (pairs.has(pair)) continue
    const rejection = rejected.get(pair)
    if (rejection !== undefined) {
      discarded.push({ candidate, reason: `rejeitada em rejected-edges.yaml: ${rejection}` })
      continue
    }
    const edge: Edge = {
      from: questId(from),
      to: questId(to),
      kind: candidate.kind,
      evidence: candidate.evidence,
      source: candidate.source,
      reviewed: false,
    }
    const cycle = findCycle(buildQuestGraph(allQuests, [...accepted, edge]))
    if (cycle) {
      discarded.push({ candidate, reason: `fecharia ciclo: ${cycle.join(' → ')}` })
      continue
    }
    accepted.push(edge)
    pairs.add(pair)
    const node = document.createNode(edge)
    if (candidate.ambiguous) node.commentBefore = REVIEW_COMMENT
    edgesSeq.add(node)
    added.edges += 1
  }

  const result = parseQuestData(document.toJS())
  if (!result.ok) return failure(yamlText, result.errors.map((error) => `resultado inválido: ${error}`))
  return {
    ok: true,
    yamlText: document.toString({ lineWidth: 0 }),
    errors: [],
    added,
    discarded,
    unreviewed: listUnreviewed(edgesSeq, result.graph.edges),
  }
}

function failure(yamlText: string, errors: string[]): MergeResult {
  return { ok: false, yamlText, errors, added: { quests: 0, fields: 0, edges: 0 }, discarded: [], unreviewed: [] }
}

function toQuest(draft: RegionedDraft): Quest {
  return {
    id: questId(draft.id),
    title: draft.title,
    ...(draft.level !== undefined ? { level: draft.level } : {}),
    premium: draft.premium,
    wiki: draft.wiki,
    ...(draft.reward !== undefined ? { reward: draft.reward } : {}),
    ...(draft.location !== undefined ? { location: draft.location } : {}),
    region: draft.region,
  }
}

// Quest curada à mão: só completa campos opcionais que ela não tem.
function fillMissing(questsSeq: YAMLSeq, draft: RegionedDraft): number {
  const node = questsSeq.items.find((item) => item instanceof YAMLMap && item.get('id') === draft.id)
  if (!(node instanceof YAMLMap)) return 0
  let filled = 0
  for (const [field, value] of [
    ['reward', draft.reward],
    ['location', draft.location],
    ['region', draft.region],
  ] as const) {
    if (value === undefined || node.has(field)) continue
    node.set(field, value)
    filled += 1
  }
  return filled
}

function listUnreviewed(edgesSeq: YAMLSeq, edges: readonly Edge[]): UnreviewedEdge[] {
  const flaggedPairs = new Set<string>()
  for (const item of edgesSeq.items) {
    if (!(item instanceof YAMLMap)) continue
    if (typeof item.commentBefore === 'string' && item.commentBefore.includes('revisar')) {
      flaggedPairs.add(`${String(item.get('from'))}→${String(item.get('to'))}`)
    }
  }
  return edges
    .filter((edge) => edge.reviewed === false)
    .map((edge) => ({ edge, flagged: flaggedPairs.has(`${edge.from}→${edge.to}`) }))
}

function seqAt(document: Document, key: string): YAMLSeq {
  const node = document.get(key)
  if (node instanceof YAMLSeq) return node
  const created = new YAMLSeq()
  document.set(key, created)
  return created
}
