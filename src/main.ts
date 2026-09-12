import data from 'virtual:quests'
import { buildQuestGraph, mostConnectedQuests, type QuestId } from './domain/index.ts'
import { createQuestGraphView } from './graph/quest-graph-view.ts'
import { renderSuggestions } from './ui/landing.ts'
import { ALL_HASH, canShowTree, clearFocus, focusOf, focusQuest, modeFromHash, type Mode } from './ui/mode.ts'
import { renderPanel } from './ui/panel.ts'
import { createSearch } from './ui/search.ts'

const graph = buildQuestGraph(data.quests, data.edges)
const view = createQuestGraphView(mustFind('#graph'))
const panel = mustFind('#panel')
const landingSearch = mustFindInput('#landing-search')

let mode: Mode = { kind: 'landing' }

// ---- transições de rota: passam pelo hash para voltar/avançar funcionarem ----

function goLanding(): void {
  if (mode.kind === 'landing') return
  history.pushState(null, '', `${location.pathname}${location.search}`)
  applyRoute()
}

function goAll(): void {
  setHash(ALL_HASH)
}

function goTree(id: QuestId): void {
  setHash(id)
}

// hashchange é assíncrono; quando o hash já é o pedido, ele não dispara.
function setHash(hash: string): void {
  if (location.hash.slice(1) === hash) applyRoute()
  else location.hash = hash
}

// ---- transições dentro do modo ----

function onFocusRequest(id: QuestId): void {
  const result = focusQuest(mode, id)
  if (result.kind === 'reroot') {
    goTree(result.id)
    return
  }
  mode = result.mode
  view.focus(id)
  renderPanelFor(mode)
}

function onClearFocus(): void {
  mode = clearFocus(mode)
  view.clearFocus()
  renderPanelFor(mode)
}

// ---- rota → modo ----

function applyRoute(): void {
  const next = modeFromHash(location.hash, graph)
  mode = next
  document.body.dataset['mode'] = next.kind
  if (next.kind === 'all') view.render(next.shown, null)
  if (next.kind === 'tree') {
    view.render(next.shown, next.root)
    if (next.focus !== null) view.focus(next.focus)
  }
  renderPanelFor(next)
  // Foco de teclado segue a tela: o painel ao entrar num grafo, a busca no
  // início (só onde não abre teclado por cima da tela).
  // preventScroll: no celular a folha ainda está deslizando quando o foco
  // chega, e o browser rolaria a página inteira atrás dela.
  if (next.kind === 'landing') {
    if (matchMedia('(hover: hover)').matches) landingSearch.focus({ preventScroll: true })
  } else {
    panel.focus({ preventScroll: true })
  }
}

function renderPanelFor(current: Mode): void {
  const focus = focusOf(current)
  // Em #todas as contagens do painel vazio falam do que está na tela.
  const shown = current.kind === 'all' ? current.shown : graph
  renderPanel(panel, shown, focus, { onNavigate: onFocusRequest, ...(canShowTree(current) ? { onShowTree: goTree } : {}) })
  panel.classList.toggle('open', focus !== null)
}

// ---- ligações ----

view.onTap((id) => (id === null ? onClearFocus() : onFocusRequest(id)))
mustFind('#panel-close').addEventListener('click', onClearFocus)
mustFind('#home').addEventListener('click', (event) => {
  event.preventDefault()
  goLanding()
})
mustFind('#show-all').addEventListener('click', goAll)
createSearch({ input: mustFindInput('#search'), results: mustFind('#search-results') }, graph, goTree)
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
