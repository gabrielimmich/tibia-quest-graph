import type { Edge, QuestGraph, QuestId } from './quest.ts'

export function findAllPrerequisites(graph: QuestGraph, id: QuestId): ReadonlySet<QuestId> {
  return collectReachable(graph.incoming, id, (edge) => edge.from)
}

export function findAllUnlocked(graph: QuestGraph, id: QuestId): ReadonlySet<QuestId> {
  return collectReachable(graph.outgoing, id, (edge) => edge.to)
}

function collectReachable(
  adjacency: ReadonlyMap<QuestId, readonly Edge[]>,
  start: QuestId,
  next: (edge: Edge) => QuestId,
): ReadonlySet<QuestId> {
  const seen = new Set<QuestId>()
  const pending = [start]
  for (let current = pending.pop(); current !== undefined; current = pending.pop()) {
    for (const edge of adjacency.get(current) ?? []) {
      const neighbour = next(edge)
      if (!seen.has(neighbour)) {
        seen.add(neighbour)
        pending.push(neighbour)
      }
    }
  }
  // Num ciclo a busca volta ao ponto de partida; uma quest não é
  // pré-requisito de si mesma.
  seen.delete(start)
  return seen
}

// DFS com três estados. Devolve o caminho fechado (ex.: [a, b, c, a]) para
// que a mensagem de validação mostre exatamente onde a leitura da wiki errou.
export function findCycle(graph: QuestGraph): readonly QuestId[] | null {
  const state = new Map<QuestId, 'visiting' | 'done'>()
  const path: QuestId[] = []

  const visit = (id: QuestId): readonly QuestId[] | null => {
    const mark = state.get(id)
    if (mark === 'visiting') return [...path.slice(path.indexOf(id)), id]
    if (mark === 'done') return null

    state.set(id, 'visiting')
    path.push(id)
    for (const edge of graph.outgoing.get(id) ?? []) {
      const cycle = visit(edge.to)
      if (cycle) return cycle
    }
    path.pop()
    state.set(id, 'done')
    return null
  }

  for (const id of graph.quests.keys()) {
    const cycle = visit(id)
    if (cycle) return cycle
  }
  return null
}
