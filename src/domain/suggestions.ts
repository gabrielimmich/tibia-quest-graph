import type { Quest, QuestGraph } from './quest.ts'
import { findAllPrerequisites, findAllUnlocked } from './traversal.ts'

// Sugestões da tela inicial sem curadoria: as quests com mais ligações são as
// que mais se beneficiam de um mapa.
export function mostConnectedQuests(graph: QuestGraph, limit: number): readonly Quest[] {
  const ranked = [...graph.quests.values()]
    .map((quest) => ({
      quest,
      connections: findAllPrerequisites(graph, quest.id).size + findAllUnlocked(graph, quest.id).size,
    }))
    .filter((entry) => entry.connections > 0)
    .sort((a, b) => b.connections - a.connections || a.quest.title.localeCompare(b.quest.title))
  return ranked.slice(0, limit).map((entry) => entry.quest)
}
