import { describe, expect, it } from 'vitest'
import { buildQuestGraph } from '../../src/domain/quest.ts'
import { normalizeText, searchQuests } from '../../src/domain/search.ts'
import { quest } from './fixtures.ts'

const titled = (rawId: string, title: string) => ({ ...quest(rawId), title })
const graph = buildQuestGraph(
  [
    titled('soul-war', 'Soul War Quest'),
    titled('feaster-of-souls', 'Feaster of Souls Quest'),
    titled('ferumbras-ascension', "Ferumbras' Ascension Quest"),
    titled('the-ice-islands', 'The Ice Islands Quest'),
  ],
  [],
)
const titles = (query: string, limit?: number) => searchQuests(graph, query, limit).map((quest) => quest.title)

describe('normalizeText', () => {
  it('remove acento e caixa', () => {
    expect(normalizeText('Ferúmbras ÇÃO')).toBe('ferumbras cao')
  })
})

describe('searchQuests', () => {
  it('ignora caixa e acento na busca', () => {
    expect(titles('FERÚMBRAS')).toEqual(["Ferumbras' Ascension Quest"])
  })

  it('match no início do título vem antes', () => {
    expect(titles('soul')).toEqual(['Soul War Quest', 'Feaster of Souls Quest'])
  })

  it('query vazia ou só espaço devolve nada', () => {
    expect(titles('')).toEqual([])
    expect(titles('   ')).toEqual([])
  })

  it('respeita o limite', () => {
    expect(titles('quest', 2)).toHaveLength(2)
    expect(titles('quest')).toHaveLength(4)
  })
})
