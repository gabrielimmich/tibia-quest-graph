import type { Core } from 'cytoscape'
import { findLineage, type QuestGraph, type QuestId } from '../domain/index.ts'
import { edgeElementId } from './elements.ts'

// Separado da view para ser testável headless: é a interação central do MVP.
export const LINEAGE_CLASSES = 'focus ancestor descendant path dimmed'

export function clearLineageClasses(cy: Core): void {
  cy.elements().removeClass(LINEAGE_CLASSES)
}

export function applyLineageClasses(cy: Core, graph: QuestGraph, id: QuestId): void {
  const lineage = findLineage(graph, id)
  cy.batch(() => {
    cy.elements().removeClass(LINEAGE_CLASSES).addClass('dimmed')
    cy.getElementById(id).removeClass('dimmed').addClass('focus')
    for (const ancestor of lineage.ancestors) cy.getElementById(ancestor).removeClass('dimmed').addClass('ancestor')
    for (const descendant of lineage.descendants) {
      cy.getElementById(descendant).removeClass('dimmed').addClass('descendant')
    }
    for (const edge of lineage.edges) {
      cy.getElementById(edgeElementId(edge.from, edge.to)).removeClass('dimmed').addClass('path')
    }
  })
}
