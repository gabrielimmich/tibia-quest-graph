import type { Quest, QuestGraph } from './quest.ts'

export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function searchQuests(graph: QuestGraph, query: string, limit = 8): readonly Quest[] {
  const needle = normalizeText(query.trim())
  if (needle === '') return []

  const hits: { quest: Quest; position: number }[] = []
  for (const quest of graph.quests.values()) {
    const position = normalizeText(quest.title).indexOf(needle)
    if (position >= 0) hits.push({ quest, position })
  }
  hits.sort((a, b) => a.position - b.position || a.quest.title.localeCompare(b.quest.title))
  return hits.slice(0, limit).map((hit) => hit.quest)
}
