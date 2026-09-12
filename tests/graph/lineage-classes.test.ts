import cytoscape from 'cytoscape'
import { describe, expect, it } from 'vitest'
import { buildQuestGraph } from '../../src/domain/quest.ts'
import { edgeElementId, toElements } from '../../src/graph/elements.ts'
import { applyLineageClasses, clearLineageClasses, markFocus, replaceElements, setInspect, unmarkFocus } from '../../src/graph/lineage-classes.ts'
import { stylesheet } from '../../src/graph/style.ts'
import { edge, id, quest } from '../domain/fixtures.ts'

// a→b→d, a→c→d, d→e; x isolada.
const graph = buildQuestGraph(
  [quest('a'), quest('b'), quest('c'), quest('d'), quest('e'), quest('x')],
  [edge('a', 'b'), edge('a', 'c', 'recommended'), edge('b', 'd', 'access'), edge('c', 'd'), edge('d', 'e')],
)

function headless() {
  return cytoscape({ headless: true, styleEnabled: true, elements: toElements(graph), style: stylesheet })
}

describe('applyLineageClasses', () => {
  it('marca foco, ancestrais, descendentes e arestas do caminho; esmaece o resto', () => {
    const cy = headless()
    applyLineageClasses(cy, graph, id('d'))

    expect(cy.getElementById('d').classes()).toEqual(['focus'])
    for (const ancestor of ['a', 'b', 'c']) expect(cy.getElementById(ancestor).classes()).toEqual(['ancestor'])
    expect(cy.getElementById('e').classes()).toEqual(['descendant'])
    expect(cy.getElementById('x').classes()).toEqual(['dimmed'])
    expect(cy.getElementById(edgeElementId('a', 'b')).classes()).toEqual(['path'])
    expect(cy.getElementById(edgeElementId('d', 'e')).classes()).toEqual(['path'])
  })

  it('arestas fora do caminho ficam esmaecidas', () => {
    const cy = headless()
    applyLineageClasses(cy, graph, id('b'))
    expect(cy.getElementById(edgeElementId('c', 'd')).classes()).toEqual(['dimmed'])
    expect(cy.getElementById(edgeElementId('a', 'c')).classes()).toEqual(['dimmed'])
  })

  it('trocar a seleção substitui as classes em vez de acumular', () => {
    const cy = headless()
    applyLineageClasses(cy, graph, id('d'))
    applyLineageClasses(cy, graph, id('x'))
    expect(cy.getElementById('x').classes()).toEqual(['focus'])
    expect(cy.getElementById('d').classes()).toEqual(['dimmed'])
    expect(cy.getElementById('a').classes()).toEqual(['dimmed'])
  })

  it('clearLineageClasses devolve o grafo ao estado neutro', () => {
    const cy = headless()
    applyLineageClasses(cy, graph, id('d'))
    clearLineageClasses(cy)
    expect(cy.elements().filter((element) => element.classes().length > 0)).toHaveLength(0)
  })
})

describe('stylesheet aplicado (headless)', () => {
  it('kind da aresta vira estilo de linha e dimmed vira opacidade', () => {
    const cy = headless()
    expect(cy.getElementById(edgeElementId('b', 'd')).style('line-style')).toBe('dashed')
    expect(cy.getElementById(edgeElementId('a', 'c')).style('line-style')).toBe('dotted')
    expect(cy.getElementById(edgeElementId('a', 'b')).style('line-style')).toBe('solid')
    applyLineageClasses(cy, graph, id('x'))
    expect(cy.getElementById('a').style('opacity')).toBe('0.15')
    expect(cy.getElementById('x').style('opacity')).toBe('1')
  })
})

describe('setInspect', () => {
  it('move a classe inspect entre nós e null limpa', () => {
    const cy = headless()
    setInspect(cy, id('a'))
    expect(cy.getElementById('a').hasClass('inspect')).toBe(true)
    setInspect(cy, id('b'))
    expect(cy.getElementById('a').hasClass('inspect')).toBe(false)
    expect(cy.getElementById('b').hasClass('inspect')).toBe(true)
    setInspect(cy, null)
    expect(cy.nodes('.inspect')).toHaveLength(0)
  })

  it('não conflita com as classes de linhagem', () => {
    const cy = headless()
    applyLineageClasses(cy, graph, id('d'))
    setInspect(cy, id('a'))
    expect(cy.getElementById('a').classes().sort()).toEqual(['ancestor', 'inspect'])
    applyLineageClasses(cy, graph, id('x'))
    expect(cy.getElementById('a').hasClass('inspect')).toBe(false)
  })
})

describe('replaceElements + markFocus', () => {
  it('troca o conteúdo, marca a raiz e o foco na árvore sem esmaecer', () => {
    const cy = headless()
    const sub = buildQuestGraph([quest('a'), quest('b')], [edge('a', 'b')])
    replaceElements(cy, sub, id('b'))
    expect(cy.nodes()).toHaveLength(2)
    expect(cy.getElementById('b').classes()).toEqual(['focus'])
    markFocus(cy, sub, id('b'), id('a'))
    expect(cy.getElementById('a').classes()).toEqual(['inspect'])
    expect(cy.elements('.dimmed')).toHaveLength(0)
    unmarkFocus(cy, id('b'))
    expect(cy.getElementById('a').classes()).toEqual([])
    expect(cy.getElementById('b').classes()).toEqual(['focus'])
  })

  it('no grafo completo o foco esmaece e limpar devolve ao neutro', () => {
    const cy = headless()
    replaceElements(cy, graph, null)
    markFocus(cy, graph, null, id('d'))
    expect(cy.getElementById('x').classes()).toEqual(['dimmed'])
    unmarkFocus(cy, null)
    expect(cy.elements().filter((element) => element.classes().length > 0)).toHaveLength(0)
  })
})
