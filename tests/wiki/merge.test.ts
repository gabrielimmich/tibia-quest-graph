import { describe, expect, it } from 'vitest'
import type { EdgeCandidate } from '../../src/wiki/edges.ts'
import { mergeCollected, REVIEW_COMMENT, type RegionedDraft } from '../../src/wiki/merge.ts'

const WIKI = 'https://tibia.fandom.com/wiki/'

const yamlText = [
  '# Cabeçalho curado à mão.',
  'quests:',
  '  - id: a',
  '    title: A Quest',
  '    premium: true',
  '    wiki: https://tibia.fandom.com/wiki/A_Quest',
  '    unlocks: "Acesso a B" # comentário na quest',
  '',
  '  - id: b',
  '    title: B Quest',
  '    premium: false',
  '    wiki: https://tibia.fandom.com/wiki/B_Quest',
  '    unlocks: "Nada"',
  '',
  'edges:',
  '  - from: a',
  '    to: b',
  '    kind: required',
  '    evidence: "Completed A Quest"',
  '    source: https://tibia.fandom.com/wiki/B_Quest/Spoiler',
  '',
].join('\n')

const draft = (id: string, title: string, extra: Partial<RegionedDraft> = {}): RegionedDraft => ({
  id,
  title,
  premium: true,
  wiki: `${WIKI}${title.replace(/ /g, '_')}`,
  region: 'Thais',
  warnings: [],
  ...extra,
})

const candidate = (fromTitle: string, toTitle: string, extra: Partial<EdgeCandidate> = {}): EdgeCandidate => ({
  fromTitle,
  toTitle,
  kind: 'required',
  ambiguous: false,
  where: 'requirements',
  evidence: `Completed ${fromTitle}`,
  source: `${WIKI}${toTitle.replace(/ /g, '_')}/Spoiler`,
  ...extra,
})

describe('mergeCollected', () => {
  it('acrescenta quests e arestas novas, preserva comentários e o que já existia', () => {
    const result = mergeCollected({
      yamlText,
      drafts: [draft('a', 'A Quest', { reward: 'Sword', location: 'Thais' }), draft('c', 'C Quest', { level: 50, location: 'Zao', region: 'Zao' })],
      candidates: [candidate('B Quest', 'C Quest'), candidate('A Quest', 'B Quest')],
      rejected: new Map(),
    })
    expect(result.ok).toBe(true)
    expect(result.added).toEqual({ quests: 1, fields: 3, edges: 1 })
    // Nada do original mudou: cada linha antiga continua lá, comentários inclusive.
    for (const line of yamlText.split('\n').filter((l) => l.trim() !== '')) expect(result.yamlText).toContain(line)
    expect(result.yamlText).toContain('id: c')
    expect(result.yamlText).toContain('region: Zao')
    expect(result.yamlText).toContain('reviewed: false')
    // A quest curada ganhou só os campos que não tinha; unlocks ficou.
    expect(result.yamlText).toContain('reward: Sword')
    expect(result.yamlText).toContain('unlocks: "Acesso a B"')
  })

  it('nunca sobrescreve campo existente de quest curada', () => {
    const withRegion = yamlText.replace('    unlocks: "Nada"', '    unlocks: "Nada"\n    region: Manual')
    const result = mergeCollected({
      yamlText: withRegion,
      drafts: [draft('b', 'B Quest', { region: 'Automatica' })],
      candidates: [],
      rejected: new Map(),
    })
    expect(result.yamlText).toContain('region: Manual')
    expect(result.yamlText).not.toContain('Automatica')
  })

  it('descarta rejeitadas e as que fechariam ciclo, e a seção de requisitos vence a frase do corpo', () => {
    const result = mergeCollected({
      yamlText,
      drafts: [draft('c', 'C Quest')],
      candidates: [
        // corpo diz C → B, requisitos dizem B → C: os dois juntos fecham ciclo; requisitos ficam
        candidate('C Quest', 'B Quest', { where: 'body', ambiguous: true }),
        candidate('B Quest', 'C Quest'),
        candidate('B Quest', 'A Quest'), // ciclo com a → b já existente
        candidate('C Quest', 'A Quest'), // rejeitada
      ],
      rejected: new Map([['c→a', 'motivo']]),
    })
    expect(result.added.edges).toBe(1)
    expect(result.yamlText).toMatch(/from: b\n\s+to: c/)
    expect(result.discarded.map((d) => `${d.candidate.fromTitle}→${d.candidate.toTitle}: ${d.reason.split(':')[0]}`)).toEqual([
      'B Quest→A Quest: fecharia ciclo',
      'C Quest→A Quest: rejeitada em rejected-edges.yaml',
      'C Quest→B Quest: fecharia ciclo',
    ])
  })

  it('marca ambíguas com comentário e lista todas as não revisadas do documento', () => {
    const first = mergeCollected({
      yamlText,
      drafts: [draft('c', 'C Quest'), draft('d', 'D Quest')],
      candidates: [candidate('B Quest', 'C Quest', { ambiguous: true }), candidate('C Quest', 'D Quest')],
      rejected: new Map(),
    })
    expect(first.yamlText).toContain(`#${REVIEW_COMMENT}`)
    expect(first.unreviewed.map((u) => [u.edge.to, u.flagged]).sort()).toEqual([
      ['c', true],
      ['d', false],
    ])
    // Segunda coleta sem novidades: a fila continua completa.
    const second = mergeCollected({ yamlText: first.yamlText, drafts: [], candidates: [], rejected: new Map() })
    expect(second.added.edges).toBe(0)
    expect(second.unreviewed.map((u) => [u.edge.to, u.flagged]).sort()).toEqual([
      ['c', true],
      ['d', false],
    ])
  })

  it('não grava nada se o YAML atual for inválido', () => {
    const broken = yamlText.replace('kind: required', 'kind: nope')
    const result = mergeCollected({ yamlText: broken, drafts: [], candidates: [], rejected: new Map() })
    expect(result.ok).toBe(false)
    expect(result.yamlText).toBe(broken)
    expect(result.errors[0]).toContain('inválido')
  })
})
