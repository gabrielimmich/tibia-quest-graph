import type { Core } from 'cytoscape'
import { findLineage, type QuestGraph, type QuestId } from '../domain/index.ts'
import { edgeElementId, toElements } from './elements.ts'

// Separado da view para ser testável headless: é a interação central do MVP.
export const LINEAGE_CLASSES = 'focus ancestor descendant path dimmed inspect'

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

// Marca o nó cujos detalhes estão no painel, sem esmaecer nada: na árvore
// tudo que está na tela é relevante.
export function setInspect(cy: Core, id: QuestId | null): void {
  cy.nodes().removeClass('inspect')
  if (id !== null) cy.getElementById(id).addClass('inspect')
}

// Troca o conteúdo da tela. root ≠ null é a raiz de uma árvore (dourada).
export function replaceElements(cy: Core, graph: QuestGraph, root: QuestId | null): void {
  cy.elements().remove()
  cy.add(toElements(graph))
  if (root !== null) cy.getElementById(root).addClass('focus')
}

// No grafo completo o foco esmaece o que não é linhagem; na árvore só marca.
export function markFocus(cy: Core, graph: QuestGraph, root: QuestId | null, id: QuestId): void {
  if (root === null) applyLineageClasses(cy, graph, id)
  else setInspect(cy, id)
}

export function unmarkFocus(cy: Core, root: QuestId | null): void {
  if (root === null) clearLineageClasses(cy)
  else setInspect(cy, null)
}
