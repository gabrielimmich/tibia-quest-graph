import cytoscape from 'cytoscape'
import dagre, { type DagreLayoutOptions } from 'cytoscape-dagre'
import { describe, expect, it } from 'vitest'
import { buildOverview } from '../../src/domain/overview.ts'
import { buildQuestGraph } from '../../src/domain/quest.ts'
import { layoutBlocks } from '../../src/graph/block-layout.ts'
import { applyLineageClasses } from '../../src/graph/lineage-classes.ts'
import { edgeElementId, nodeLabel, regionElementId, toBlockElements, toElements } from '../../src/graph/elements.ts'
import { stylesheet } from '../../src/graph/style.ts'
import { edge, id, quest } from '../domain/fixtures.ts'

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
    // Filhos de blocos diferentes não se sobrepõem (o pai contém os filhos por construção).
    const children = cy.nodes(':child').map((node) => ({
      id: node.id(),
      parent: node.parent().first().id(),
      box: node.boundingBox({ includeLabels: false }),
    }))
    for (const a of children) {
      for (const b of children) {
        if (a.id === b.id || a.parent === b.parent) continue
        const overlaps = a.box.x1 < b.box.x2 && b.box.x1 < a.box.x2 && a.box.y1 < b.box.y2 && b.box.y1 < a.box.y2
        expect(overlaps).toBe(false)
      }
    }
  })

  it('foco dentro dos blocos não apaga a linhagem: pais não recebem dimmed', () => {
    cytoscape.use(dagre)
    // Transições desligadas: o teste lê a opacidade final, não um frame de animação.
    const style = stylesheet.map((block) =>
      'style' in block ? { ...block, style: { ...block.style, 'transition-property': 'none', 'transition-duration': 0 } } : block,
    )
    // Thais: a→b; Zao: c→d. Focar c deixa a e b fora da linhagem.
    const twoPairs = buildQuestGraph(
      [{ ...quest('a'), region: 'Thais' }, { ...quest('b'), region: 'Thais' }, { ...quest('c'), region: 'Zao' }, { ...quest('d'), region: 'Zao' }],
      [edge('a', 'b'), edge('c', 'd')],
    )
    const overview = buildOverview(twoPairs)
    const cy = cytoscape({ headless: true, styleEnabled: true, elements: toBlockElements(overview), style })
    applyLineageClasses(cy, overview.connected, id('c'))
    expect(cy.nodes('.region.dimmed')).toHaveLength(0)
    // A opacidade efetiva multiplica a do pai composto: é ela que aparece na tela.
    expect(cy.getElementById('c').effectiveOpacity()).toBe(1)
    expect(cy.getElementById('d').effectiveOpacity()).toBe(1)
    expect(cy.getElementById('a').effectiveOpacity()).toBeCloseTo(0.15)
    cy.destroy()
  })
})
