import { describe, expect, it } from 'vitest'
import { classifyKind, extractEdgeCandidates } from '../../src/wiki/edges.ts'

const known = new Set([
  'The New Frontier Quest',
  'Children of the Revolution Quest',
  'Wrath of the Emperor Quest',
  'Barbarian Test Quest',
  'The Ice Islands Quest',
  'Threatened Dreams Quest',
  'The Dream Courts Quest',
  'Forgotten Knowledge Quest',
  'The Secret Library Quest',
  'Feaster of Souls Quest',
  'Soul War Quest',
  'The Pits of Inferno Quest',
  'The Inquisition Quest',
  'In Service of Yalahar Quest',
])
const aliases = new Map([['Ice Islands Quest', 'The Ice Islands Quest']])

const extract = (title: string, wikitext: string) => extractEdgeCandidates(title, wikitext, known, aliases)

describe('classifyKind', () => {
  it('segue a tabela do spec', () => {
    expect(classifyKind('Completed the Feaster of Souls Quest')).toEqual({ kind: 'required', ambiguous: false })
    expect(classifyKind('Completed Children of the Revolution Quest (plus the Daily Task: Zzuppliezz)')).toEqual({
      kind: 'required',
      ambiguous: false,
    })
    expect(classifyKind('Succeed the Barbarian Test Quest, and then head to Iskan')).toEqual({ kind: 'required', ambiguous: false })
    expect(classifyKind('Access to Feyrist (Complete the Threatened Dreams Quest - Troubled Animals);')).toEqual({
      kind: 'access',
      ambiguous: false,
    })
    expect(
      classifyKind('Finally, note that in order to access the Demon Forge you must have absorbed the spirit in The Pits of Inferno Quest.'),
    ).toEqual({ kind: 'access', ambiguous: false })
    expect(classifyKind('Completed The New Frontier Quest (only necessary to be able to use the shortcut).')).toEqual({
      kind: 'recommended',
      ambiguous: false,
    })
    expect(classifyKind('For missiong 5: Completed (or bring a friend who has completed) the first mission of Ice Islands Quest')).toEqual({
      kind: 'recommended',
      ambiguous: false,
    })
    // completado com "permission to": conclusão vence acesso quando a frase não começa por "access"
    expect(classifyKind('The New Frontier Quest completed including mission 9, Mortal Combat (for permission to use the Fire Portal);')).toEqual({
      kind: 'required',
      ambiguous: true,
    })
    expect(classifyKind('The Ice Islands Quest completed up to the The Contactman mission (for access to the Formorgar Mines);')).toEqual({
      kind: 'required',
      ambiguous: true,
    })
    expect(classifyKind('The New Frontier Quest mission 8.')).toEqual({ kind: 'required', ambiguous: true })
    expect(classifyKind('The New Frontier Quest (full quest not needed - received Mortal Kombat mission)')).toEqual({
      kind: 'required',
      ambiguous: true,
    })
    expect(classifyKind('A Ghostsilver Lantern from the Forgotten Knowledge Quest;')).toEqual({ kind: 'required', ambiguous: true })
  })
})

describe('extractEdgeCandidates', () => {
  it('lê a seção de requisitos, item a item, com a frase literal e a fonte', () => {
    const wt = [
      '{{spoiler|name=Soul War Quest}}',
      '',
      '== Requirements ==',
      '',
      '* Completed the [[Feaster of Souls Quest]]',
      '',
      '== Method ==',
      'This quest is not much different from the [[Feaster of Souls Quest]]:',
    ].join('\n')
    expect(extract('Soul War Quest', wt)).toEqual([
      {
        fromTitle: 'Feaster of Souls Quest',
        toTitle: 'Soul War Quest',
        kind: 'required',
        ambiguous: false,
        where: 'requirements',
        evidence: 'Completed the Feaster of Souls Quest',
        source: 'https://tibia.fandom.com/wiki/Soul_War_Quest/Spoiler',
      },
    ])
  })

  it('reconhece link com alias, link para subpágina e redirect conhecido', () => {
    const wt = [
      '== Required Equipment ==',
      '* Completed all 3 [[Barbarian Test Quest|Barbarian Tests]]',
      '* For missiong 5: Completed (or bring a friend who has completed) the first mission of [[Ice Islands Quest]] (Nibelor: Breaking the Ice)',
      '* Access to [[Tyrsung]] (take the [[The Ice Islands Quest/Spoiler#Nibelor_2|Nibelor 2]] from [[The Ice Islands Quest]]);',
    ].join('\n')
    const found = extract('In Service of Yalahar Quest', wt)
    expect(found.map((c) => [c.fromTitle, c.kind])).toEqual([
      ['Barbarian Test Quest', 'required'],
      ['The Ice Islands Quest', 'recommended'],
    ])
  })

  it('fora da seção só entra frase com padrão forte de exigência', () => {
    const wt = [
      '== Required Equipment ==',
      '* Rope',
      '',
      '=Method=',
      '* Succeed the [[Barbarian Test Quest]], and then head to [[Iskan]] ({{Mapper Coords|1|2|3|4|text=here}}).',
      '',
      '(Alternatively you can access the mines through the Ice Portal. See [[Forgotten Knowledge Quest]]- Ice portal)',
    ].join('\n')
    const found = extract('The Ice Islands Quest', wt)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      fromTitle: 'Barbarian Test Quest',
      kind: 'required',
      where: 'body',
      evidence: 'Succeed the Barbarian Test Quest, and then head to Iskan (here).',
    })
  })

  it('ignora auto-referência, quests desconhecidas e pares repetidos', () => {
    const wt = [
      '== Requirements ==',
      '* Completed [[Soul War Quest]] itself',
      '* Completed [[Unknown Quest]]',
      '* Completed the [[Feaster of Souls Quest]]',
      '* Also the [[Feaster of Souls Quest]] again',
    ].join('\n')
    const found = extract('Soul War Quest', wt)
    expect(found.map((c) => c.fromTitle)).toEqual(['Feaster of Souls Quest'])
  })

  it('template Spoiler Section conta como menção', () => {
    const wt = ['== Requirements ==', '* Access to [[Feyrist]] (Complete the {{Spoiler Section|Threatened Dreams Quest|Troubled Animals}});'].join('\n')
    expect(extract('The Dream Courts Quest', wt)[0]).toMatchObject({
      fromTitle: 'Threatened Dreams Quest',
      kind: 'access',
      evidence: 'Access to Feyrist (Complete the Threatened Dreams Quest - Troubled Animals);',
    })
  })
})
