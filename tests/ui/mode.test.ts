import { describe, expect, it } from 'vitest'
import { buildQuestGraph } from '../../src/domain/quest.ts'
import { canShowTree, clearFocus, focusOf, focusQuest, hashFor, modeFromHash } from '../../src/ui/mode.ts'
import { edge, id, quest } from '../domain/fixtures.ts'

// a→b→d, c→d; x isolada. Árvore de b = {a, b, d}; c fica fora dela.
const graph = buildQuestGraph(
  [quest('a'), quest('b'), quest('c'), quest('d'), quest('x')],
  [edge('a', 'b'), edge('b', 'd'), edge('c', 'd')],
)

describe('modeFromHash', () => {
  it('sem hash é o início', () => {
    expect(modeFromHash('', graph)).toEqual({ kind: 'landing' })
    expect(modeFromHash('#', graph)).toEqual({ kind: 'landing' })
  })

  it('#todas é o grafo completo sem foco', () => {
    expect(modeFromHash('#todas', graph)).toEqual({ kind: 'all', focus: null })
  })

  it('#id válido é a árvore daquela quest, com foco nela', () => {
    const mode = modeFromHash('#b', graph)
    expect(mode.kind).toBe('tree')
    if (mode.kind !== 'tree') return
    expect(mode.root).toBe('b')
    expect(mode.focus).toBe('b')
    expect([...mode.shown.quests.keys()].sort()).toEqual(['a', 'b', 'd'])
  })

  it('hash desconhecido ou malformado cai no início sem lançar', () => {
    expect(modeFromHash('#zzz', graph)).toEqual({ kind: 'landing' })
    expect(modeFromHash('#%', graph)).toEqual({ kind: 'landing' })
  })

  it('hashFor é o inverso', () => {
    expect(hashFor(modeFromHash('', graph))).toBe('')
    expect(hashFor(modeFromHash('#todas', graph))).toBe('todas')
    expect(hashFor(modeFromHash('#b', graph))).toBe('b')
  })
})

describe('focusQuest', () => {
  it('no início não faz nada', () => {
    expect(focusQuest({ kind: 'landing' }, id('a'))).toEqual({ kind: 'stay', mode: { kind: 'landing' } })
  })

  it('no grafo completo só troca o foco', () => {
    expect(focusQuest({ kind: 'all', focus: null }, id('a'))).toEqual({ kind: 'stay', mode: { kind: 'all', focus: 'a' } })
  })

  it('na árvore, quest na tela vira foco e a raiz fica', () => {
    const tree = modeFromHash('#b', graph)
    const result = focusQuest(tree, id('d'))
    expect(result.kind).toBe('stay')
    if (result.kind !== 'stay' || result.mode.kind !== 'tree') return
    expect(result.mode.root).toBe('b')
    expect(result.mode.focus).toBe('d')
  })

  it('na árvore, quest fora da tela pede re-enraizar', () => {
    expect(focusQuest(modeFromHash('#b', graph), id('c'))).toEqual({ kind: 'reroot', id: 'c' })
  })
})

describe('clearFocus, focusOf, canShowTree', () => {
  it('limpar o foco funciona no grafo completo e na árvore', () => {
    expect(focusOf(clearFocus({ kind: 'all', focus: id('a') }))).toBeNull()
    const tree = clearFocus(modeFromHash('#b', graph))
    expect(tree.kind).toBe('tree')
    expect(focusOf(tree)).toBeNull()
  })

  it('"ver árvore" aparece com foco no grafo completo e, na árvore, só fora da raiz', () => {
    expect(canShowTree({ kind: 'landing' })).toBe(false)
    expect(canShowTree({ kind: 'all', focus: null })).toBe(false)
    expect(canShowTree({ kind: 'all', focus: id('a') })).toBe(true)
    const tree = modeFromHash('#b', graph)
    expect(canShowTree(tree)).toBe(false)
    const focused = focusQuest(tree, id('d'))
    if (focused.kind === 'stay') expect(canShowTree(focused.mode)).toBe(true)
    expect(canShowTree(clearFocus(tree))).toBe(false)
  })
})
