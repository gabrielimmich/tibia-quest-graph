export type QuestId = string & { readonly __brand: 'QuestId' }

export const EDGE_KINDS = ['required', 'access', 'recommended'] as const
export type EdgeKind = (typeof EDGE_KINDS)[number]

export interface Quest {
  readonly id: QuestId
  readonly title: string
  readonly level?: number
  readonly premium: boolean
  readonly wiki: string
  readonly unlocks: string
}

export interface Edge {
  readonly from: QuestId
  readonly to: QuestId
  readonly kind: EdgeKind
  readonly evidence: string
  readonly source: string
}

export interface QuestGraph {
  readonly quests: ReadonlyMap<QuestId, Quest>
  readonly edges: readonly Edge[]
  readonly incoming: ReadonlyMap<QuestId, readonly Edge[]>
  readonly outgoing: ReadonlyMap<QuestId, readonly Edge[]>
}

export function questId(raw: string): QuestId {
  return raw as QuestId
}

// Só monta índices. Consistência (ids existentes, ausência de ciclo) é
// responsabilidade de parseQuestData, para que fixtures de teste possam
// montar grafos inválidos de propósito.
export function buildQuestGraph(quests: readonly Quest[], edges: readonly Edge[]): QuestGraph {
  const byId = new Map<QuestId, Quest>()
  const incoming = new Map<QuestId, Edge[]>()
  const outgoing = new Map<QuestId, Edge[]>()

  for (const quest of quests) {
    byId.set(quest.id, quest)
    incoming.set(quest.id, [])
    outgoing.set(quest.id, [])
  }
  for (const edge of edges) {
    outgoing.get(edge.from)?.push(edge)
    incoming.get(edge.to)?.push(edge)
  }

  return { quests: byId, edges: [...edges], incoming, outgoing }
}
