import cytoscape, {
  type BoundingBox12,
  type BoundingBoxWH,
  type CollectionReturnValue,
  type EventObject,
  type EventObjectNode,
  type NodeCollection,
} from 'cytoscape'
import dagre, { type DagreLayoutOptions } from 'cytoscape-dagre'
import { questId, type Overview, type QuestGraph, type QuestId } from '../domain/index.ts'
import { layoutBlocks } from './block-layout.ts'
import { toBlockElements } from './elements.ts'
import { markFocus, replaceElements, unmarkFocus } from './lineage-classes.ts'
import { stylesheet } from './style.ts'

cytoscape.use(dagre)

export type TapListener = (id: QuestId | null) => void

export interface QuestGraphView {
  // Substitui o que está na tela. root ≠ null é a raiz de uma árvore: fica
  // dourada e o foco não esmaece nada; root = null é o grafo completo.
  readonly render: (graph: QuestGraph, root: QuestId | null) => void
  // Visão geral: um bloco por região, dagre dentro de cada um.
  readonly renderBlocks: (overview: Overview) => void
  readonly focus: (id: QuestId) => void
  readonly clearFocus: () => void
  readonly onTap: (listener: TapListener) => void
}

const layout: DagreLayoutOptions = { name: 'dagre', rankDir: 'TB', nodeSep: 30, rankSep: 70, padding: 24 }
// Árvore de 2 nós caberia com zoom 2.5x e viraria dois blocos gigantes.
const MAX_FIT_ZOOM = 1.25
const FIT_PADDING = 40
const FIT_DURATION = 300

export function createQuestGraphView(container: HTMLElement): QuestGraphView {
  const cy = cytoscape({ container, style: stylesheet, autounselectify: true, minZoom: 0.1, maxZoom: 2.5 })

  let shown: QuestGraph | null = null
  let root: QuestId | null = null
  let blocks = false
  // Bloco atualmente enquadrado: tocar nele de novo volta ao mapa inteiro.
  let fittedRegion: string | null = null
  const listeners: TapListener[] = []

  const isOffscreen = (box: BoundingBox12 & BoundingBoxWH) =>
    box.x2 < 0 || box.y2 < 0 || box.x1 > cy.width() || box.y1 > cy.height()

  const render = (graph: QuestGraph, nextRoot: QuestId | null) => {
    shown = graph
    root = nextRoot
    blocks = false
    // Uma animação de pan do modo anterior continuaria depois do fit.
    cy.stop()
    // O container pode ter mudado de tamanho enquanto o início cobria o grafo.
    cy.resize()
    replaceElements(cy, graph, root)
    cy.layout(layout).run()
    if (cy.zoom() > MAX_FIT_ZOOM) {
      cy.zoom(MAX_FIT_ZOOM)
      cy.center()
    }
  }

  const renderBlocks = (overview: Overview) => {
    shown = overview.connected
    root = null
    blocks = true
    fittedRegion = null
    cy.stop()
    cy.resize()
    cy.elements().remove()
    cy.add(toBlockElements(overview))
    layoutBlocks(cy)
    cy.fit(undefined, FIT_PADDING)
  }

  // fit() animado com teto de zoom: um bloco de uma quest só encheria a tela.
  const animateFit = (eles: NodeCollection | CollectionReturnValue) => {
    const box = eles.boundingBox()
    const available = { w: cy.width() - 2 * FIT_PADDING, h: cy.height() - 2 * FIT_PADDING }
    const zoom = Math.min(MAX_FIT_ZOOM, available.w / box.w, available.h / box.h)
    cy.stop()
    cy.animate({ zoom, center: { eles } }, { duration: FIT_DURATION })
  }

  const focus = (id: QuestId) => {
    const node = cy.getElementById(id)
    if (shown === null || node.empty()) return
    markFocus(cy, shown, root, id)
    // Na árvore tudo já cabe na tela após o fit; só vale mover se o usuário
    // deu zoom e o nó ficou fora.
    if (root !== null && !isOffscreen(node.renderedBoundingBox())) return
    cy.stop()
    cy.animate({ center: { eles: node } }, { duration: 250 })
  }

  const clearFocus = () => unmarkFocus(cy, root)

  cy.on('tap', 'node', (event: EventObjectNode) => {
    // Bloco de região: zoom nele, sem mexer no foco; de novo no mesmo, volta ao mapa.
    if (event.target.hasClass('region')) {
      const id = event.target.id()
      if (fittedRegion === id) {
        fittedRegion = null
        animateFit(cy.elements())
      } else {
        fittedRegion = id
        animateFit(event.target)
      }
      return
    }
    for (const listener of listeners) listener(questId(event.target.id()))
  })
  cy.on('tap', (event: EventObject) => {
    if (event.target !== cy) return
    // Fundo na visão geral: volta a enquadrar o mapa inteiro.
    if (blocks) {
      fittedRegion = null
      animateFit(cy.elements())
    }
    for (const listener of listeners) listener(null)
  })

  return {
    render,
    renderBlocks,
    focus,
    clearFocus,
    onTap: (listener) => {
      listeners.push(listener)
    },
  }
}
