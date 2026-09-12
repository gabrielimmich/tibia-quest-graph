import { connectedSubgraph } from './lineage.ts'
import type { Quest, QuestGraph } from './quest.ts'

// Mesmo valor que src/wiki/regions.ts usa ao coletar; o domínio não importa
// de lá para continuar sem dependência de infraestrutura.
export const UNMAPPED_REGION = 'Outros'

export interface Block {
  readonly region: string
  readonly quests: readonly Quest[]
  // Quests da região sem nenhuma aresta: ficam fora do mapa, mas o bloco diz quantas são.
  readonly isolated: number
}

export interface Overview {
  readonly connected: QuestGraph
  readonly blocks: readonly Block[]
  readonly isolatedTotal: number
}

export function buildOverview(graph: QuestGraph): Overview {
  const connected = connectedSubgraph(graph)
  const questsByRegion = new Map<string, Quest[]>()
  const isolatedByRegion = new Map<string, number>()
  for (const quest of graph.quests.values()) {
    const region = quest.region ?? UNMAPPED_REGION
    if (connected.quests.has(quest.id)) {
      const list = questsByRegion.get(region)
      if (list) list.push(quest)
      else questsByRegion.set(region, [quest])
    } else {
      isolatedByRegion.set(region, (isolatedByRegion.get(region) ?? 0) + 1)
    }
  }
  const blocks = [...questsByRegion.entries()]
    .map(([region, quests]) => ({ region, quests, isolated: isolatedByRegion.get(region) ?? 0 }))
    .sort(compareBlocks)
  const isolatedTotal = [...isolatedByRegion.values()].reduce((sum, count) => sum + count, 0)
  return { connected, blocks, isolatedTotal }
}

// Maior bloco primeiro; "Outros" sempre por último, porque é o balde do que
// ainda não foi mapeado em regions.yaml.
function compareBlocks(a: Block, b: Block): number {
  if (a.region === UNMAPPED_REGION) return 1
  if (b.region === UNMAPPED_REGION) return -1
  return b.quests.length - a.quests.length || a.region.localeCompare(b.region, 'pt-BR')
}
