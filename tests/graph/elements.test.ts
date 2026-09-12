import cytoscape from 'cytoscape'
import dagre, { type DagreLayoutOptions } from 'cytoscape-dagre'
import { describe, expect, it } from 'vitest'
import { buildOverview } from '../../src/domain/overview.ts'
import { buildQuestGraph } from '../../src/domain/quest.ts'
import { layoutBlocks } from '../../src/graph/block-layout.ts'
import { edgeElementId, nodeLabel, regionElementId, toBlockElements, toElements } from '../../src/graph/elements.ts'
import { stylesheet } from '../../src/graph/style.ts'
import { edge, quest } from '../domain/fixtures.ts'

const graph = buildQuestGraph(
  [{ ...quest('a'), title: 'Alpha Quest' }, { ...quest('b'), title: 'Beta Quest' }, quest('c')],
  [edge('a', 'b'), edge('a', 'c', 'access')],
)

describe('toElements', () => {
  it('gera um nó por quest e uma aresta por dependência', () => {
    const elements = toElements(graph)
    expect(elements.filter((element) => element.group === 'nodes')).toHaveLength(3)
    expect(elements.filter((element) => element.group === 'edges')).toHaveLength(2)
  })

  it('rótulo é o título sem o sufixo Quest', () => {
    expect(nodeLabel({ ...quest('a'), title: 'Alpha Quest' })).toBe('Alpha')
    expect(nodeLabel({ ...quest('a'), title: 'Sem sufixo' })).toBe('Sem sufixo')
  })

  it('aresta carrega kind e id determinístico', () => {
    const elements = toElements(graph)
    const ab = elements.find((element) => element.data.id === edgeElementId('a', 'b'))
    expect(ab?.data).toMatchObject({ source: 'a', target: 'b', kind: 'required' })
  })
})

describe('stylesheet + dagre (headless)', () => {
  it('Cytoscape aceita os elementos, o stylesheet e o layout', () => {
    cytoscape.use(dagre)
    const cy = cytoscape({ headless: true, styleEnabled: true, elements: toElements(graph), style: stylesheet })
    const layout: DagreLayoutOptions = { name: 'dagre', rankDir: 'TB' }
    cy.layout(layout).run()
    expect(cy.nodes()).toHaveLength(3)
    expect(cy.getElementById(edgeElementId('a', 'c')).data('kind')).toBe('access')
    // b e c ficam abaixo de a no rankDir TB
    const y = (id: string) => cy.getElementById(id).position('y')
    expect(y('b')).toBeGreaterThan(y('a'))
    expect(y('c')).toBeGreaterThan(y('a'))
  })
})

describe('toBlockElements + layoutBlocks (headless)', () => {
  const regioned = buildQuestGraph(
    [
      { ...quest('a'), region: 'Thais' },
      { ...quest('b'), region: 'Thais' },
      { ...quest('c'), region: 'Zao' },
      { ...quest('d'), region: 'Zao' },
      { ...quest('e'), region: 'Zao' },
      { ...quest('x'), region: 'Zao' },
    ],
    [edge('a', 'b'), edge('c', 'd'), edge('d', 'e'), edge('b', 'c', 'access')],
  )

  it('gera um pai por bloco e filhos com parent', () => {
    const elements = toBlockElements(buildOverview(regioned))
    const parents = elements.filter((element) => element.classes === 'region')
    expect(parents.map((element) => element.data.id)).toEqual([regionElementId('Zao'), regionElementId('Thais')])
    expect(parents[0]?.data['label']).toBe('Zao · 3 (+1 sem dependências)')
    const child = elements.find((element) => element.data.id === 'a')
    expect(child?.data['parent']).toBe(regionElementId('Thais'))
  })

  it('layoutBlocks deixa os blocos sem sobreposição e os filhos dentro do pai', () => {
    cytoscape.use(dagre)
    const cy = cytoscape({ headless: true, styleEnabled: true, elements: toBlockElements(buildOverview(regioned)), style: stylesheet })
    layoutBlocks(cy)
    const boxes = cy.nodes('.region').map((parent) => parent.boundingBox({ includeLabels: false }))
    expect(boxes).toHaveLength(2)
    const [first, second] = boxes
    if (!first || !second) throw new Error('faltou bloco')
    const overlap = first.x1 < second.x2 && second.x1 < first.x2 && first.y1 < second.y2 && second.y1 < first.y2
    expect(overlap).toBe(false)
    for (const child of cy.nodes(':child')) {
      const parentBox = child.parent().boundingBox({ includeLabels: false })
      const box = child.boundingBox({ includeLabels: false })
      expect(box.x1).toBeGreaterThanOrEqual(parentBox.x1)
      expect(box.x2).toBeLessThanOrEqual(parentBox.x2)
    }
  })
})
