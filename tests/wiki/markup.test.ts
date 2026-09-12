import { describe, expect, it } from 'vitest'
import { infoboxFields, listItems, sectionBody, sentences, stripMarkup } from '../../src/wiki/markup.ts'

describe('stripMarkup', () => {
  it('reduz links, templates e ênfase ao texto renderizado', () => {
    expect(stripMarkup('* Completed [[The Shattered Isles Quest]] until access to [[Ramoa]] is obtained.')).toBe(
      'Completed The Shattered Isles Quest until access to Ramoa is obtained.',
    )
    expect(stripMarkup('Completed all 3 [[Barbarian Test Quest|Barbarian Tests]]')).toBe('Completed all 3 Barbarian Tests')
    expect(stripMarkup('ask about {{KW|task}} and then say {{KW|yes}}')).toBe('ask about task and then say yes')
    expect(
      stripMarkup('Access to [[Feyrist]] (Complete the {{Spoiler Section|Threatened Dreams Quest|Troubled Animals}});'),
    ).toBe('Access to Feyrist (Complete the Threatened Dreams Quest - Troubled Animals);')
    expect(stripMarkup('head to [[Iskan]] ({{Mapper Coords|126.45|121.109|7|3|text=here}}).')).toBe('head to Iskan (here).')
    expect(stripMarkup("(plus the ''Daily Task: Zzuppliezz'')")).toBe('(plus the Daily Task: Zzuppliezz)')
    expect(stripMarkup("'''Note''': In order to <br/> access")).toBe('Note: In order to access')
    expect(stripMarkup('[[File:Outfit Warmaster Male.gif]] base [[Warmaster Outfits|Warmaster Outfit]]')).toBe(
      'base Warmaster Outfit',
    )
  })
})

describe('infoboxFields', () => {
  it('lê campos linha a linha sem engolir a linha seguinte quando o valor é vazio', () => {
    const wt = [
      '{{Infobox Quest|List={{{1|}}}',
      '| name           = Soul War Quest',
      '| aka            = ',
      '| reward         = One random item',
      '| lvl            = 250',
      '| premium        = yes',
      '}}',
    ].join('\n')
    const fields = infoboxFields(wt)
    expect(fields.get('name')).toBe('Soul War Quest')
    expect(fields.get('aka')).toBe('')
    expect(fields.get('reward')).toBe('One random item')
    expect(fields.get('lvl')).toBe('250')
  })
})

describe('sectionBody', () => {
  const wt = [
    '{{spoiler}}',
    '',
    '== Requirements ==',
    '',
    '* Completed the [[Feaster of Souls Quest]]',
    '',
    '== Method ==',
    'text',
    '=== Sub ===',
  ].join('\n')

  it('devolve o corpo da seção até o próximo cabeçalho de qualquer nível', () => {
    expect(sectionBody(wt, ['Requirements'])).toBe('* Completed the [[Feaster of Souls Quest]]')
    expect(sectionBody(wt, ['Method'])).toBe('text')
  })

  it('aceita nomes alternativos e cabeçalhos com 1 a 4 sinais de igual', () => {
    const one = ['=Method=', '* Succeed the [[Barbarian Test Quest]]', '==Befriending the Musher=='].join('\n')
    expect(sectionBody(one, ['Requirements', 'Method'])).toBe('* Succeed the [[Barbarian Test Quest]]')
    const three = ['=== Required Equipment ===', '* [[The New Frontier Quest]] mission 8.', '', 'To start'].join('\n')
    expect(sectionBody(three, ['Requirements', 'Required Equipment'])).toBe(
      '* [[The New Frontier Quest]] mission 8.\n\nTo start',
    )
    expect(sectionBody(wt, ['Nope'])).toBe('')
  })
})

describe('listItems e sentences', () => {
  it('listItems devolve cada item de lista sem os marcadores', () => {
    expect(listItems('* a\n** b\n*: note\ntext\n# c')).toEqual(['a', 'b', 'note', 'text', 'c'])
  })

  it('sentences separa em pontos finais mantendo parênteses', () => {
    expect(sentences('Succeed the Barbarian Test Quest, and then head to Iskan (here). Talk to him. Ok')).toEqual([
      'Succeed the Barbarian Test Quest, and then head to Iskan (here).',
      'Talk to him.',
      'Ok',
    ])
  })
})
