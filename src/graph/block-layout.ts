import type { Core, NodeCollection, NodeSingular } from 'cytoscape'
import type { DagreLayoutOptions } from 'cytoscape-dagre'
import { packShelves, type PackItem } from './pack.ts'

// cytoscape-dagre não entende nós compostos, e dentro de uma região a maioria
// das quests não depende uma da outra (as dependências cruzam regiões).
// Então: dagre em cada componente conexo interno ao bloco, componentes
// empacotados em prateleiras dentro do bloco, blocos empacotados no mapa.
// O pai composto se ajusta aos filhos sozinho.
const innerLayout: DagreLayoutOptions = { name: 'dagre', rankDir: 'TB', nodeSep: 20, rankSep: 50, fit: false, padding: 0 }
const COMPONENT_GAP = 24
const BLOCK_GAP = 60
const BLOCK_MAX_WIDTH = 720
const MAP_MIN_WIDTH = 1400

export function layoutBlocks(cy: Core): void {
  const parents = cy.nodes('.region')
  parents.forEach((parent) => layoutInside(parent))
  const placed = packShelves(measure(parents), mapWidth(parents), BLOCK_GAP)
  parents.forEach((parent) => moveTo(parent.children(), placed.get(parent.id())))
}

function layoutInside(parent: NodeSingular): void {
  const kids = parent.children()
  const internalEdges = kids.connectedEdges().filter((edge) => kids.contains(edge.source()) && kids.contains(edge.target()))
  const components = kids.union(internalEdges).components()
  components.forEach((component) => component.layout(innerLayout).run())
  const items = components.map((component, index): PackItem => {
    const box = component.nodes().boundingBox({ includeLabels: false })
    return { id: String(index), w: box.w, h: box.h }
  })
  const placed = packShelves(items, BLOCK_MAX_WIDTH, COMPONENT_GAP)
  components.forEach((component, index) => moveTo(component.nodes(), placed.get(String(index))))
}

function measure(parents: NodeCollection): PackItem[] {
  return parents.map((parent) => {
    const box = parent.boundingBox()
    return { id: parent.id(), w: box.w, h: box.h }
  })
}

// Largura da prateleira cresce com a área total para o mapa ficar ~16:10,
// não uma tira.
function mapWidth(parents: NodeCollection): number {
  const area = measure(parents).reduce((sum, item) => sum + item.w * item.h, 0)
  return Math.max(MAP_MIN_WIDTH, Math.sqrt(area) * 1.6)
}

function moveTo(nodes: NodeCollection, target: { x: number; y: number } | undefined): void {
  if (target === undefined || nodes.empty()) return
  const box = nodes.boundingBox({ includeLabels: false })
  nodes.shift({ x: target.x - box.x1, y: target.y - box.y1 })
}
