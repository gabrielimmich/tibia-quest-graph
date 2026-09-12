import type { ElementDefinition } from 'cytoscape'
import type { Block, Overview, Quest, QuestGraph } from '../domain/index.ts'

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

// Um nó composto por região; as quests viram filhos. O id do pai leva prefixo
// para nunca colidir com um id de quest.
export function regionElementId(region: string): string {
  return `region:${region}`
}

export function toBlockElements(overview: Overview): ElementDefinition[] {
  const parents = overview.blocks.map(
    (block): ElementDefinition => ({
      group: 'nodes',
      data: { id: regionElementId(block.region), label: blockLabel(block) },
      classes: 'region',
    }),
  )
  const children = overview.blocks.flatMap((block) =>
    block.quests.map(
      (quest): ElementDefinition => ({
        group: 'nodes',
        data: { id: quest.id, label: nodeLabel(quest), parent: regionElementId(block.region) },
      }),
    ),
  )
  const edges = overview.connected.edges.map(
    (edge): ElementDefinition => ({
      group: 'edges',
      data: { id: edgeElementId(edge.from, edge.to), source: edge.from, target: edge.to, kind: edge.kind },
    }),
  )
  return [...parents, ...children, ...edges]
}

function blockLabel(block: Block): string {
  const hidden = block.isolated > 0 ? ` (+${block.isolated} sem dependências)` : ''
  return `${block.region} · ${block.quests.length}${hidden}`
}
