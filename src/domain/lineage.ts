import { buildQuestGraph, type Edge, type QuestGraph, type QuestId } from './quest.ts'
import { findAllPrerequisites, findAllUnlocked } from './traversal.ts'

export interface Lineage {
  readonly ancestors: ReadonlySet<QuestId>
  readonly descendants: ReadonlySet<QuestId>
  // Todas as arestas entre membros da linhagem (subgrafo induzido). Inclui as
  // que vão de um ancestral direto a um descendente, passando ao largo da
  // quest: os dois nós estão na tela, então esconder a aresta mentiria sobre
  // a dependência. Num DAG não existe descendente → ancestral.
  readonly edges: readonly Edge[]
}

export function findLineage(graph: QuestGraph, id: QuestId): Lineage {
  const ancestors = findAllPrerequisites(graph, id)
  const descendants = findAllUnlocked(graph, id)
  const members = new Set<QuestId>([id, ...ancestors, ...descendants])
  const edges = graph.edges.filter((edge) => members.has(edge.from) && members.has(edge.to))
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
