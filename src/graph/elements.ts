import type { ElementDefinition } from 'cytoscape'
import type { Quest, QuestGraph } from '../domain/index.ts'

export function nodeLabel(quest: Quest): string {
  return quest.title.replace(/ Quest$/, '')
}

// Cytoscape exige id por aresta; from→to é único porque o validador recusa
// pares duplicados. Buscar sempre por getElementById, nunca por seletor #id,
// porque a seta não é caractere válido em seletor.
export function edgeElementId(from: string, to: string): string {
  return `${from}→${to}`
}

export function toElements(graph: QuestGraph): ElementDefinition[] {
  const nodes = [...graph.quests.values()].map(
    (quest): ElementDefinition => ({ group: 'nodes', data: { id: quest.id, label: nodeLabel(quest) } }),
  )
  const edges = graph.edges.map(
    (edge): ElementDefinition => ({
      group: 'edges',
      data: { id: edgeElementId(edge.from, edge.to), source: edge.from, target: edge.to, kind: edge.kind },
    }),
  )
  return [...nodes, ...edges]
}
