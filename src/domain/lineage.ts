import { buildQuestGraph, type Edge, type QuestGraph, type QuestId } from './quest.ts'
import { findAllPrerequisites, findAllUnlocked } from './traversal.ts'

export interface Lineage {
  readonly ancestors: ReadonlySet<QuestId>
  readonly descendants: ReadonlySet<QuestId>
  // Arestas que ligam a quest aos seus ancestrais/descendentes. Uma aresta
  // entre dois ancestrais está sempre num caminho até a quest (é um DAG),
  // então basta testar se os dois lados pertencem ao mesmo conjunto.
  readonly edges: readonly Edge[]
}

export function findLineage(graph: QuestGraph, id: QuestId): Lineage {
  const ancestors = findAllPrerequisites(graph, id)
  const descendants = findAllUnlocked(graph, id)
  const upstream = new Set<QuestId>([id, ...ancestors])
  const downstream = new Set<QuestId>([id, ...descendants])
  const edges = graph.edges.filter(
    (edge) =>
      (upstream.has(edge.from) && upstream.has(edge.to)) ||
      (downstream.has(edge.from) && downstream.has(edge.to)),
  )
  return { ancestors, descendants, edges }
}

// Grafo só com a quest e sua linhagem: é o que a árvore mostra. Reusa
// buildQuestGraph para que a view não precise saber de sub-grafos.
export function lineageSubgraph(graph: QuestGraph, id: QuestId): QuestGraph {
  const lineage = findLineage(graph, id)
  const ids = [id, ...lineage.ancestors, ...lineage.descendants]
  const quests = ids.flatMap((questId) => {
    const quest = graph.quests.get(questId)
    return quest ? [quest] : []
  })
  return buildQuestGraph(quests, lineage.edges)
}
