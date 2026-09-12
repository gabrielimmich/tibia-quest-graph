import cytoscape, { type EventObject, type EventObjectNode } from 'cytoscape'
import dagre, { type DagreLayoutOptions } from 'cytoscape-dagre'
import { findLineage, questId, type QuestGraph, type QuestId } from '../domain/index.ts'
import { edgeElementId, toElements } from './elements.ts'
import { stylesheet } from './style.ts'

cytoscape.use(dagre)

export type SelectionListener = (id: QuestId | null) => void

export interface QuestGraphView {
  readonly select: (id: QuestId) => void
  readonly clear: () => void
  readonly onSelect: (listener: SelectionListener) => void
}

const LINEAGE_CLASSES = 'focus ancestor descendant path dimmed'

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
    cy.elements().removeClass(LINEAGE_CLASSES)
    notify(null)
  }

  const select = (id: QuestId) => {
    const node = cy.getElementById(id)
    if (node.empty()) return
    const lineage = findLineage(graph, id)
    cy.batch(() => {
      cy.elements().removeClass(LINEAGE_CLASSES).addClass('dimmed')
      node.removeClass('dimmed').addClass('focus')
      for (const ancestor of lineage.ancestors) cy.getElementById(ancestor).removeClass('dimmed').addClass('ancestor')
      for (const descendant of lineage.descendants) {
        cy.getElementById(descendant).removeClass('dimmed').addClass('descendant')
      }
      for (const edge of lineage.edges) {
        cy.getElementById(edgeElementId(edge.from, edge.to)).removeClass('dimmed').addClass('path')
      }
    })
    cy.animate({ center: { eles: node } }, { duration: 250 })
    notify(id)
  }

  cy.on('tap', 'node', (event: EventObjectNode) => select(questId(event.target.id())))
  cy.on('tap', (event: EventObject) => {
    if (event.target === cy) clear()
  })

  return { select, clear, onSelect: (listener) => listeners.push(listener) }
}
