import { describe, expect, it } from 'vitest'
import { parseQuestData } from '../../src/domain/parse.ts'
import { questId } from '../../src/domain/quest.ts'

const WIKI = 'https://tibia.fandom.com/wiki/'

type Raw = Record<string, unknown>

const quest = (id: string, patch: Raw = {}): Raw => ({
  id,
  title: `${id} Quest`,
  premium: true,
  wiki: `${WIKI}${id}`,
  unlocks: 'algo',
  ...patch,
})

const edge = (from: string, to: string, patch: Raw = {}): Raw => ({
  from,
  to,
  kind: 'required',
  evidence: `You need ${from} to start ${to}.`,
  source: `${WIKI}${to}`,
  ...patch,
})

const data = (patch: Raw = {}): Raw => ({
  quests: [quest('a', { level: 50 }), quest('b')],
  edges: [edge('a', 'b')],
  ...patch,
})

function errorsOf(raw: unknown): string {
  const result = parseQuestData(raw)
  return result.ok ? '' : result.errors.join('\n')
}

describe('parseQuestData', () => {
  it('aceita dados válidos e monta o grafo', () => {
    const result = parseQuestData(data())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.graph.quests.size).toBe(2)
    expect(result.graph.edges).toHaveLength(1)
    expect(result.graph.quests.get(questId('a'))?.level).toBe(50)
  })

  it('aceita quest sem level', () => {
    const result = parseQuestData(data({ quests: [quest('a'), quest('b')] }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect([...result.graph.quests.values()][0]).not.toHaveProperty('level')
  })

  it('rejeita raiz que não é objeto', () => {
    expect(errorsOf('nope')).toContain('raiz deve ser um objeto')
    expect(errorsOf(null)).toContain('raiz deve ser um objeto')
  })

  it('rejeita quests/edges que não são listas', () => {
    const errors = errorsOf({ quests: {}, edges: 'x' })
    expect(errors).toContain('"quests" deve ser uma lista')
    expect(errors).toContain('"edges" deve ser uma lista')
  })

  it('rejeita campo de quest com tipo errado', () => {
    expect(errorsOf(data({ quests: [quest('a', { premium: 'yes' }), quest('b')] }))).toContain(
      'quest[0]: "premium" deve ser boolean',
    )
    expect(errorsOf(data({ quests: [quest('a', { title: '' }), quest('b')] }))).toContain(
      'quest[0]: "title" deve ser texto não vazio',
    )
  })

  it('rejeita level que não é inteiro positivo', () => {
    expect(errorsOf(data({ quests: [quest('a', { level: 0 }), quest('b')] }))).toContain('"level"')
    expect(errorsOf(data({ quests: [quest('a', { level: 1.5 }), quest('b')] }))).toContain('"level"')
    expect(errorsOf(data({ quests: [quest('a', { level: '50' }), quest('b')] }))).toContain('"level"')
  })

  it('rejeita id fora do kebab-case', () => {
    expect(errorsOf({ quests: [quest('Soul War')], edges: [] })).toContain('kebab-case')
    expect(errorsOf({ quests: [quest('soul_war')], edges: [] })).toContain('kebab-case')
  })

  it('rejeita id duplicado', () => {
    expect(errorsOf({ quests: [quest('a'), quest('a')], edges: [] })).toContain('id duplicado: "a"')
  })

  it('rejeita wiki e source fora da TibiaWiki', () => {
    expect(errorsOf({ quests: [quest('a', { wiki: 'https://example.com/a' })], edges: [] })).toContain(
      '"wiki" não é página da TibiaWiki',
    )
    expect(errorsOf(data({ edges: [edge('a', 'b', { source: 'http://tibia.fandom.com/wiki/b' })] }))).toContain(
      '"source" não é página da TibiaWiki',
    )
  })

  it('rejeita aresta apontando para id inexistente', () => {
    expect(errorsOf(data({ edges: [edge('a', 'zzz')] }))).toContain('"to" aponta para id inexistente "zzz"')
    expect(errorsOf(data({ edges: [edge('zzz', 'b')] }))).toContain('"from" aponta para id inexistente "zzz"')
  })

  it('rejeita auto-referência', () => {
    expect(errorsOf(data({ edges: [edge('a', 'a')] }))).toContain('não pode depender de si mesma')
  })

  it('rejeita aresta duplicada', () => {
    expect(errorsOf(data({ edges: [edge('a', 'b'), edge('a', 'b', { kind: 'access' })] }))).toContain(
      'aresta duplicada: a→b',
    )
  })

  it('rejeita kind desconhecido', () => {
    expect(errorsOf(data({ edges: [edge('a', 'b', { kind: 'optional' })] }))).toContain('kind inválido "optional"')
  })

  it('rejeita evidence vazia ou placeholder (regra de ouro)', () => {
    expect(errorsOf(data({ edges: [edge('a', 'b', { evidence: '   ' })] }))).toContain('regra de ouro')
    expect(
      errorsOf(data({ edges: [edge('a', 'b', { evidence: '<trecho literal copiado da página da wiki>' })] })),
    ).toContain('regra de ouro')
  })

  it('guarda a evidence sem espaço externo (block scalar do YAML)', () => {
    const result = parseQuestData(data({ edges: [edge('a', 'b', { evidence: '  You need a.\n' })] }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.graph.edges[0]?.evidence).toBe('You need a.')
  })

  it('quest com campo inválido ainda conta como id conhecido para as arestas', () => {
    const errors = errorsOf(data({ quests: [quest('a', { premium: 'yes' }), quest('b')] }))
    expect(errors).toContain('"premium" deve ser boolean')
    expect(errors).not.toContain('id inexistente')
  })

  it('rejeita campo desconhecido', () => {
    expect(errorsOf(data({ edges: [edge('a', 'b', { evidance: 'typo' })] }))).toContain(
      'campo desconhecido "evidance"',
    )
    expect(errorsOf(data({ quests: [quest('a', { lvl: 1 }), quest('b')] }))).toContain('campo desconhecido "lvl"')
  })

  it('rejeita ciclo com o caminho', () => {
    expect(errorsOf(data({ edges: [edge('a', 'b'), edge('b', 'a')] }))).toContain('ciclo: a → b → a')
  })

  it('acumula vários erros em vez de parar no primeiro', () => {
    const result = parseQuestData({
      quests: [quest('a', { premium: 'x' }), quest('a')],
      edges: [edge('a', 'zzz', { kind: 'nope' })],
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.length).toBeGreaterThanOrEqual(4)
  })
})
