import { describe, expect, it } from 'vitest'
import { buildQuestGraph } from '../../src/domain/quest.ts'
import { edge, id, quest } from './fixtures.ts'

describe('buildQuestGraph', () => {
  const ab = edge('a', 'b')
  const ac = edge('a', 'c', 'recommended')
  const graph = buildQuestGraph([quest('a'), quest('b'), quest('c'), quest('d')], [ab, ac])

  it('indexa quests por id', () => {
    expect(graph.quests.get(id('a'))?.title).toBe('a')
    expect(graph.quests.size).toBe(4)
  })

  it('indexa arestas de saída pelo from', () => {
    expect(graph.outgoing.get(id('a'))).toEqual([ab, ac])
    expect(graph.outgoing.get(id('b'))).toEqual([])
  })

  it('indexa arestas de entrada pelo to', () => {
    expect(graph.incoming.get(id('b'))).toEqual([ab])
    expect(graph.incoming.get(id('a'))).toEqual([])
  })

  it('toda quest tem entrada nos índices, mesmo isolada', () => {
    expect(graph.incoming.has(id('d'))).toBe(true)
    expect(graph.outgoing.has(id('d'))).toBe(true)
  })

  it('preserva a lista de arestas na ordem original', () => {
    expect(graph.edges).toEqual([ab, ac])
  })
})
