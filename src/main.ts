import data from 'virtual:quests'
import { buildQuestGraph, questId } from './domain/index.ts'
import { createQuestGraphView } from './graph/quest-graph-view.ts'
import { renderPanel } from './ui/panel.ts'
import { createSearch } from './ui/search.ts'

const graph = buildQuestGraph(data.quests, data.edges)

const graphElement = mustFind('#graph')
const panel = mustFind('#panel')
const panelClose = mustFind('#panel-close')
const searchInput = mustFindInput('#search')
const searchResults = mustFind('#search-results')

const view = createQuestGraphView(graphElement, graph)

view.onSelect((id) => {
  renderPanel(panel, graph, id, view.select)
  panel.classList.toggle('open', id !== null)
  // replaceState em vez de location.hash: não polui o histórico a cada clique.
  history.replaceState(null, '', id === null ? `${location.pathname}${location.search}` : `#${id}`)
})

createSearch({ input: searchInput, results: searchResults }, graph, view.select)
panelClose.addEventListener('click', view.clear)

renderPanel(panel, graph, null, view.select)
const initial = questId(decodeURIComponent(location.hash.slice(1)))
if (graph.quests.has(initial)) view.select(initial)

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
