import { describe, expect, it } from 'vitest'
import { findLineage, lineageSubgraph } from '../../src/domain/lineage.ts'
import { buildQuestGraph } from '../../src/domain/quest.ts'
import { edge, id, quest } from './fixtures.ts'

// a→b, a→c (recommended), b→d (access), c→d, d→e; x isolada.
const ab = edge('a', 'b')
const ac = edge('a', 'c', 'recommended')
const bd = edge('b', 'd', 'access')
const cd = edge('c', 'd')
const de = edge('d', 'e')
const graph = buildQuestGraph(
  [quest('a'), quest('b'), quest('c'), quest('d'), quest('e'), quest('x')],
  [ab, ac, bd, cd, de],
)

describe('findLineage', () => {
  it('reúne ancestrais, descendentes e as arestas desses caminhos', () => {
    const lineage = findLineage(graph, id('d'))
    expect([...lineage.ancestors].sort()).toEqual(['a', 'b', 'c'])
    expect([...lineage.descendants]).toEqual(['e'])
    expect(lineage.edges).toEqual([ab, ac, bd, cd, de])
  })

  it('exclui arestas de ramos que não passam pela quest', () => {
    // c→d chega num descendente de b, mas c não tem relação com b.
    const lineage = findLineage(graph, id('b'))
    expect(lineage.edges).toEqual([ab, bd, de])
  })

  it('quest isolada e id inexistente devolvem tudo vazio', () => {
    for (const target of [id('x'), id('zzz')]) {
      const lineage = findLineage(graph, target)
      expect(lineage.ancestors.size).toBe(0)
      expect(lineage.descendants.size).toBe(0)
      expect(lineage.edges).toEqual([])
    }
  })

  it('inclui aresta direta de ancestral para descendente que passa ao largo da quest', () => {
    // a→b→c e o atalho a→c: na árvore de b os três nós aparecem, então a→c também.
    const ab2 = edge('a', 'b')
    const bc = edge('b', 'c')
    const shortcut = edge('a', 'c', 'access')
    const withShortcut = buildQuestGraph([quest('a'), quest('b'), quest('c')], [ab2, bc, shortcut])
    expect(findLineage(withShortcut, id('b')).edges).toEqual([ab2, bc, shortcut])
    expect(lineageSubgraph(withShortcut, id('b')).edges).toEqual([ab2, bc, shortcut])
  })

  it('não trava num ciclo', () => {
    const cyclic = buildQuestGraph([quest('a'), quest('b')], [edge('a', 'b'), edge('b', 'a')])
    const lineage = findLineage(cyclic, id('a'))
    expect([...lineage.ancestors]).toEqual(['b'])
    expect(lineage.edges).toHaveLength(2)
  })
})

describe('lineageSubgraph', () => {
  it('contém a quest, seus ancestrais, descendentes e as arestas entre eles', () => {
    const sub = lineageSubgraph(graph, id('d'))
    expect([...sub.quests.keys()].sort()).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(sub.edges).toEqual([ab, ac, bd, cd, de])
    expect(sub.outgoing.get(id('a'))).toEqual([ab, ac])
  })

  it('quest isolada vira grafo de um nó', () => {
    const sub = lineageSubgraph(graph, id('x'))
    expect([...sub.quests.keys()]).toEqual(['x'])
    expect(sub.edges).toEqual([])
  })

  it('id inexistente devolve grafo vazio', () => {
    const sub = lineageSubgraph(graph, id('zzz'))
    expect(sub.quests.size).toBe(0)
  })
})
