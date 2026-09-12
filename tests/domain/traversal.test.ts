import { describe, expect, it } from 'vitest'
import { buildQuestGraph } from '../../src/domain/quest.ts'
import { findAllPrerequisites, findAllUnlocked, findCycle } from '../../src/domain/traversal.ts'
import { edge, id, quest } from './fixtures.ts'

// Diamante a→b, a→c, b→d, c→d (a→c é recommended) mais e isolada.
const diamond = buildQuestGraph(
  [quest('a'), quest('b'), quest('c'), quest('d'), quest('e')],
  [edge('a', 'b'), edge('a', 'c', 'recommended'), edge('b', 'd', 'access'), edge('c', 'd')],
)

const ids = (set: ReadonlySet<string>) => [...set].sort()

describe('findAllPrerequisites', () => {
  it('devolve ancestrais transitivos sem duplicar o diamante', () => {
    expect(ids(findAllPrerequisites(diamond, id('d')))).toEqual(['a', 'b', 'c'])
  })

  it('segue arestas recommended', () => {
    expect(ids(findAllPrerequisites(diamond, id('c')))).toEqual(['a'])
  })

  it('raiz não tem pré-requisitos', () => {
    expect(findAllPrerequisites(diamond, id('a')).size).toBe(0)
  })

  it('quest isolada e id inexistente devolvem vazio', () => {
    expect(findAllPrerequisites(diamond, id('e')).size).toBe(0)
    expect(findAllPrerequisites(diamond, id('zzz')).size).toBe(0)
  })

  it('não inclui a própria quest mesmo num ciclo', () => {
    const cyclic = buildQuestGraph([quest('a'), quest('b')], [edge('a', 'b'), edge('b', 'a')])
    expect(ids(findAllPrerequisites(cyclic, id('a')))).toEqual(['b'])
  })
})

describe('findAllUnlocked', () => {
  it('devolve descendentes transitivos', () => {
    expect(ids(findAllUnlocked(diamond, id('a')))).toEqual(['b', 'c', 'd'])
  })

  it('folha não libera nada', () => {
    expect(findAllUnlocked(diamond, id('d')).size).toBe(0)
  })

  it('quest isolada e id inexistente devolvem vazio', () => {
    expect(findAllUnlocked(diamond, id('e')).size).toBe(0)
    expect(findAllUnlocked(diamond, id('zzz')).size).toBe(0)
  })
})

describe('findCycle', () => {
  it('devolve null num DAG', () => {
    expect(findCycle(diamond)).toBeNull()
  })

  it('devolve o caminho fechado do ciclo', () => {
    const cyclic = buildQuestGraph(
      [quest('a'), quest('b'), quest('c')],
      [edge('a', 'b'), edge('b', 'c'), edge('c', 'a')],
    )
    expect(findCycle(cyclic)).toEqual(['a', 'b', 'c', 'a'])
  })

  it('detecta ciclo que não passa pela primeira quest', () => {
    const cyclic = buildQuestGraph(
      [quest('x'), quest('a'), quest('b')],
      [edge('x', 'a'), edge('a', 'b'), edge('b', 'a')],
    )
    expect(findCycle(cyclic)).toEqual(['a', 'b', 'a'])
  })

  it('detecta auto-referência', () => {
    const selfLoop = buildQuestGraph([quest('a')], [edge('a', 'a')])
    expect(findCycle(selfLoop)).toEqual(['a', 'a'])
  })
})
