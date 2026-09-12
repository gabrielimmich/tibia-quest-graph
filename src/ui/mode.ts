import { lineageSubgraph, questId, type QuestGraph, type QuestId } from '../domain/index.ts'

// Máquina de modos da tela, sem DOM: o main.ts só traduz eventos em chamadas
// daqui e o resultado em render. Assim as transições são testáveis.

export const ALL_HASH = 'todas'

export type Mode =
  | { readonly kind: 'landing' }
  | { readonly kind: 'all'; readonly focus: QuestId | null }
  | { readonly kind: 'tree'; readonly root: QuestId; readonly shown: QuestGraph; readonly focus: QuestId | null }

// Ids são [a-z0-9-], então o hash não precisa (nem pode) ser decodificado:
// decodeURIComponent lançaria em '#%'.
export function modeFromHash(hash: string, graph: QuestGraph): Mode {
  const value = hash.startsWith('#') ? hash.slice(1) : hash
  if (value === ALL_HASH) return { kind: 'all', focus: null }
  const id = questId(value)
  if (graph.quests.has(id)) return { kind: 'tree', root: id, shown: lineageSubgraph(graph, id), focus: id }
  return { kind: 'landing' }
}

export function hashFor(mode: Mode): string {
  switch (mode.kind) {
    case 'landing':
      return ''
    case 'all':
      return ALL_HASH
    case 'tree':
      return mode.root
  }
}

export type FocusResult =
  | { readonly kind: 'stay'; readonly mode: Mode }
  // A quest não está na tela (ex.: ancestral do foco que não é ancestral da
  // raiz): a única resposta honesta é re-enraizar a árvore nela.
  | { readonly kind: 'reroot'; readonly id: QuestId }

export function focusQuest(mode: Mode, id: QuestId): FocusResult {
  switch (mode.kind) {
    case 'landing':
      return { kind: 'stay', mode }
    case 'all':
      return { kind: 'stay', mode: { kind: 'all', focus: id } }
    case 'tree':
      return mode.shown.quests.has(id) ? { kind: 'stay', mode: { ...mode, focus: id } } : { kind: 'reroot', id }
  }
}

export function clearFocus(mode: Mode): Mode {
  return mode.kind === 'landing' ? mode : { ...mode, focus: null }
}

export function focusOf(mode: Mode): QuestId | null {
  return mode.kind === 'landing' ? null : mode.focus
}

// "Ver árvore desta quest" só faz sentido quando a quest em foco não é já a raiz.
export function canShowTree(mode: Mode): boolean {
  if (mode.kind === 'all') return mode.focus !== null
  if (mode.kind === 'tree') return mode.focus !== null && mode.focus !== mode.root
  return false
}
