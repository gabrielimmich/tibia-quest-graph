import { describe, expect, it } from 'vitest'
import { infoboxFields, sentences, stripMarkup } from '../../src/wiki/markup.ts'

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

  it('não deixa espaço órfão antes de pontuação quando remove imagem ou link', () => {
    expect(stripMarkup('Demon Hunter Outfit and addons [[Image:Addon.gif]], access to the forge')).toBe(
      'Demon Hunter Outfit and addons, access to the forge',
    )
    expect(stripMarkup('It can be found [[File:x.png]].')).toBe('It can be found.')
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

  it('junta linhas de continuação de um campo (reward em lista)', () => {
    const wt = [
      '{{Infobox Quest',
      '| reward         = Choose one:',
      '* [[Sorcerer]]s: [[Dragon Robe]]',
      '* [[Druid]]s: [[Dragon Robe]]',
      '',
      '| lvl            = 100',
      '}}',
      'Text after the infobox',
    ].join('\n')
    const fields = infoboxFields(wt)
    expect(fields.get('reward')).toBe('Choose one: [[Sorcerer]]s: [[Dragon Robe]]; [[Druid]]s: [[Dragon Robe]]')
    expect(fields.get('lvl')).toBe('100')
    expect(fields.size).toBe(2)
  })
})

describe('sentences', () => {
  it('separa em pontos finais mantendo parênteses', () => {
    expect(sentences('Succeed the Barbarian Test Quest, and then head to Iskan (here). Talk to him. Ok')).toEqual([
      'Succeed the Barbarian Test Quest, and then head to Iskan (here).',
      'Talk to him.',
      'Ok',
    ])
  })
})
