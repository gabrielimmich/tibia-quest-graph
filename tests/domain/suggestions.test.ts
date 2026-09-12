import { describe, expect, it } from 'vitest'
import { buildQuestGraph } from '../../src/domain/quest.ts'
import { mostConnectedQuests } from '../../src/domain/suggestions.ts'
import { edge, quest } from './fixtures.ts'

// a→b→d, a→c→d, d→e; x isolada. Conexões (ancestrais + descendentes):
// a = 0+4, d = 3+1, e = 4+0, b = 1+2, c = 1+2, x = 0.
const graph = buildQuestGraph(
  [quest('x'), quest('e'), quest('d'), quest('c'), quest('b'), quest('a')],
  [edge('a', 'b'), edge('a', 'c'), edge('b', 'd'), edge('c', 'd'), edge('d', 'e')],
)
const ids = (limit: number) => mostConnectedQuests(graph, limit).map((quest) => quest.id)

describe('mostConnectedQuests', () => {
  it('ordena por total de ancestrais + descendentes, desempatando por título', () => {
    expect(ids(10)).toEqual(['a', 'd', 'e', 'b', 'c'])
  })

  it('ignora quests isoladas', () => {
    expect(ids(10)).not.toContain('x')
  })

  it('respeita o limite', () => {
    expect(ids(2)).toEqual(['a', 'd'])
  })
})
