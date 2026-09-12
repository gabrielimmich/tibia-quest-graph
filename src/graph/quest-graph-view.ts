import cytoscape, { type EventObject, type EventObjectNode } from 'cytoscape'
import dagre, { type DagreLayoutOptions } from 'cytoscape-dagre'
import { questId, type QuestGraph, type QuestId } from '../domain/index.ts'
import { toElements } from './elements.ts'
import { applyLineageClasses, clearLineageClasses, setInspect } from './lineage-classes.ts'
import { stylesheet } from './style.ts'

cytoscape.use(dagre)

export type TapListener = (id: QuestId | null) => void

export interface QuestGraphView {
  // Substitui o que está na tela. root ≠ null é a raiz de uma árvore: fica
  // dourada e o foco não esmaece nada; root = null é o grafo completo.
  readonly render: (graph: QuestGraph, root: QuestId | null) => void
  readonly focus: (id: QuestId) => void
  readonly clearFocus: () => void
  readonly onTap: (listener: TapListener) => void
}

const layout: DagreLayoutOptions = { name: 'dagre', rankDir: 'TB', nodeSep: 30, rankSep: 70, padding: 24 }

export function createQuestGraphView(container: HTMLElement, initial: QuestGraph): QuestGraphView {
  const cy = cytoscape({
    container,
    elements: toElements(initial),
    style: stylesheet,
    layout,
    autounselectify: true,
    minZoom: 0.3,
    maxZoom: 2.5,
  })

  let shown: QuestGraph = initial
  let root: QuestId | null = null
  const listeners: TapListener[] = []

  const render = (graph: QuestGraph, nextRoot: QuestId | null) => {
    shown = graph
    root = nextRoot
    cy.elements().remove()
    cy.add(toElements(graph))
    if (root !== null) cy.getElementById(root).addClass('focus')
    cy.layout(layout).run()
  }

  const focus = (id: QuestId) => {
    const node = cy.getElementById(id)
    if (node.empty()) return
    if (root === null) applyLineageClasses(cy, shown, id)
    else setInspect(cy, id)
    cy.stop()
    cy.animate({ center: { eles: node } }, { duration: 250 })
  }

  const clearFocus = () => {
    if (root === null) clearLineageClasses(cy)
    else setInspect(cy, null)
  }

  cy.on('tap', 'node', (event: EventObjectNode) => {
    for (const listener of listeners) listener(questId(event.target.id()))
  })
  cy.on('tap', (event: EventObject) => {
    if (event.target !== cy) return
    for (const listener of listeners) listener(null)
  })

  return {
    render,
    focus,
    clearFocus,
    onTap: (listener) => {
      listeners.push(listener)
    },
  }
}
