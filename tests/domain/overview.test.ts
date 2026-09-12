import { describe, expect, it } from 'vitest'
import { buildOverview } from '../../src/domain/overview.ts'
import { buildQuestGraph } from '../../src/domain/quest.ts'
import { edge, quest } from './fixtures.ts'

const at = (id: string, region?: string) => (region === undefined ? quest(id) : { ...quest(id), region })

// Thais: a→b (+ t isolada); Zao: c→d, e→f; sem região: g→h; x isolada sem região.
const graph = buildQuestGraph(
  [at('a', 'Thais'), at('b', 'Thais'), at('t', 'Thais'), at('c', 'Zao'), at('d', 'Zao'), at('e', 'Zao'), at('f', 'Zao'), at('g'), at('h'), at('x')],
  [edge('a', 'b'), edge('c', 'd'), edge('e', 'f'), edge('g', 'h')],
)

describe('buildOverview', () => {
  const overview = buildOverview(graph)

  it('agrupa só as quests conectadas por região, maior bloco primeiro, Outros por último', () => {
    expect(overview.blocks.map((block) => [block.region, block.quests.map((q) => q.id)])).toEqual([
      ['Zao', ['c', 'd', 'e', 'f']],
      ['Thais', ['a', 'b']],
      ['Outros', ['g', 'h']],
    ])
  })

  it('conta as isoladas por região e no total', () => {
    expect(overview.blocks.map((block) => block.isolated)).toEqual([0, 1, 1])
    expect(overview.isolatedTotal).toBe(2)
    expect(overview.connected.quests.size).toBe(8)
  })

  it('Outros vai por último mesmo sendo o maior', () => {
    const mostlyUnmapped = buildQuestGraph([at('a'), at('b'), at('c'), at('d', 'Zao'), at('e', 'Zao')], [edge('a', 'b'), edge('b', 'c'), edge('d', 'e')])
    expect(buildOverview(mostlyUnmapped).blocks.map((block) => block.region)).toEqual(['Zao', 'Outros'])
  })
})
