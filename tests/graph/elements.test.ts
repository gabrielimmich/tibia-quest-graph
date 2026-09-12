import cytoscape from 'cytoscape'
import dagre, { type DagreLayoutOptions } from 'cytoscape-dagre'
import { describe, expect, it } from 'vitest'
import { buildQuestGraph } from '../../src/domain/quest.ts'
import { edgeElementId, nodeLabel, toElements } from '../../src/graph/elements.ts'
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
