import data from 'virtual:quests'
import { buildQuestGraph, lineageSubgraph, mostConnectedQuests, questId, type QuestId } from './domain/index.ts'
import { createQuestGraphView } from './graph/quest-graph-view.ts'
import { renderSuggestions } from './ui/landing.ts'
import { renderPanel } from './ui/panel.ts'
import { createSearch } from './ui/search.ts'

type Mode =
  | { readonly kind: 'landing' }
  | { readonly kind: 'all'; readonly focus: QuestId | null }
  | { readonly kind: 'tree'; readonly root: QuestId; readonly focus: QuestId }

const ALL_HASH = 'todas'

const graph = buildQuestGraph(data.quests, data.edges)
const view = createQuestGraphView(mustFind('#graph'), graph)
const panel = mustFind('#panel')
const landingSearch = mustFindInput('#landing-search')

let mode: Mode = { kind: 'landing' }

// ---- transições: as que mudam a rota passam pelo hash, para voltar/avançar funcionarem ----

function goLanding(): void {
  history.pushState(null, '', `${location.pathname}${location.search}`)
  applyRoute()
}

function goAll(): void {
  location.hash = ALL_HASH
}

function goTree(id: QuestId): void {
  if (location.hash.slice(1) === id) applyRoute()
  else location.hash = id
}

function focusQuest(id: QuestId): void {
  if (mode.kind === 'landing') return
  if (!isOnScreen(id)) {
    goTree(id)
    return
  }
  mode = mode.kind === 'all' ? { kind: 'all', focus: id } : { ...mode, focus: id }
  view.focus(id)
  renderPanelFor(mode)
}

function clearFocus(): void {
  if (mode.kind !== 'all') return
  mode = { kind: 'all', focus: null }
  view.clearFocus()
  renderPanelFor(mode)
}

function isOnScreen(id: QuestId): boolean {
  return mode.kind === 'all' || (mode.kind === 'tree' && lineageSubgraph(graph, mode.root).quests.has(id))
}

// ---- rota → modo ----

function applyRoute(): void {
  const hash = questId(location.hash.slice(1))
  if (hash === ALL_HASH) enter({ kind: 'all', focus: null })
  else if (graph.quests.has(hash)) enter({ kind: 'tree', root: hash, focus: hash })
  else enter({ kind: 'landing' })
}

function enter(next: Mode): void {
  mode = next
  document.body.dataset['mode'] = next.kind
  if (next.kind === 'all') view.render(graph, null)
  if (next.kind === 'tree') {
    view.render(lineageSubgraph(graph, next.root), next.root)
    view.focus(next.focus)
  }
  renderPanelFor(next)
  // Foco automático só onde não abre teclado por cima da tela.
  if (next.kind === 'landing' && matchMedia('(hover: hover)').matches) landingSearch.focus()
}

function renderPanelFor(current: Mode): void {
  const focus = current.kind === 'landing' ? null : current.focus
  const canShowTree = current.kind === 'all' ? focus !== null : current.kind === 'tree' && focus !== current.root
  renderPanel(panel, graph, focus, { onNavigate: focusQuest, ...(canShowTree ? { onShowTree: goTree } : {}) })
  panel.classList.toggle('open', focus !== null)
}

// ---- ligações ----

view.onTap((id) => (id === null ? clearFocus() : focusQuest(id)))
mustFind('#panel-close').addEventListener('click', clearFocus)
mustFind('#home').addEventListener('click', (event) => {
  event.preventDefault()
  goLanding()
})
mustFind('#show-all').addEventListener('click', goAll)
createSearch({ input: mustFindInput('#search'), results: mustFind('#search-results') }, graph, (id) => {
  goTree(id)
  panel.focus()
})
createSearch({ input: landingSearch, results: mustFind('#landing-results') }, graph, goTree)
renderSuggestions(mustFind('#suggestions'), mostConnectedQuests(graph, 4), goTree)

window.addEventListener('hashchange', applyRoute)
applyRoute()

function mustFind(selector: string): HTMLElement {
  const element = document.querySelector(selector)
  if (!(element instanceof HTMLElement)) throw new Error(`index.html sem ${selector}`)
  return element
}

function mustFindInput(selector: string): HTMLInputElement {
  const element = document.querySelector(selector)
  if (!(element instanceof HTMLInputElement)) throw new Error(`index.html sem input ${selector}`)
  return element
}
