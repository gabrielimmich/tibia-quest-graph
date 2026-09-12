import cytoscape, { type EventObject, type EventObjectNode } from 'cytoscape'
import dagre, { type DagreLayoutOptions } from 'cytoscape-dagre'
import { questId, type QuestGraph, type QuestId } from '../domain/index.ts'
import { toElements } from './elements.ts'
import { applyLineageClasses, clearLineageClasses } from './lineage-classes.ts'
import { stylesheet } from './style.ts'

cytoscape.use(dagre)

export type SelectionListener = (id: QuestId | null) => void

export interface QuestGraphView {
  readonly select: (id: QuestId) => void
  readonly clear: () => void
  readonly onSelect: (listener: SelectionListener) => void
}

const layout: DagreLayoutOptions = { name: 'dagre', rankDir: 'TB', nodeSep: 30, rankSep: 70, padding: 24 }

export function createQuestGraphView(container: HTMLElement, graph: QuestGraph): QuestGraphView {
  const cy = cytoscape({
    container,
    elements: toElements(graph),
    style: stylesheet,
    layout,
    // A seleção é nossa (classes por linhagem); a nativa só atrapalharia.
    autounselectify: true,
    minZoom: 0.3,
    maxZoom: 2.5,
  })

  const listeners: SelectionListener[] = []
  const notify = (id: QuestId | null) => {
    for (const listener of listeners) listener(id)
  }

  const clear = () => {
    clearLineageClasses(cy)
    notify(null)
  }

  const select = (id: QuestId) => {
    const node = cy.getElementById(id)
    if (node.empty()) return
    applyLineageClasses(cy, graph, id)
    // stop() evita fila de pans quando o usuário clica em várias quests seguidas.
    cy.stop()
    cy.animate({ center: { eles: node } }, { duration: 250 })
    notify(id)
  }

  cy.on('tap', 'node', (event: EventObjectNode) => select(questId(event.target.id())))
  cy.on('tap', (event: EventObject) => {
    if (event.target === cy) clear()
  })

  return {
    select,
    clear,
    onSelect: (listener) => {
      listeners.push(listener)
    },
  }
}
