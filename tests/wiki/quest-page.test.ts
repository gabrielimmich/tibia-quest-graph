import { describe, expect, it } from 'vitest'
import { parseQuestPage } from '../../src/wiki/quest-page.ts'

const soulWar = [
  '{{Infobox Quest|List={{{1|}}}|GetValue={{{GetValue|}}}',
  '| name           = Soul War Quest',
  '| aka            = ',
  '| reward         = One random item from the [[Soul Set]], [[File:Achievement Grade Symbol.gif]] [[Soul Mender]] [[achievement]] (under certain conditions), and base [[Revenant Outfits]] [[Image:Outfit_Revenant_Male.gif]]',
  '| location       = [[Zarganash]], [[Claustrophobic Inferno]], [[Rotten Wasteland]]',
  '| type           = ',
  '| lvl            = 250',
  '| premium        = yes',
  '}}',
].join('\n')

describe('parseQuestPage', () => {
  it('extrai id, level, premium, recompensa literal e primeiro lugar', () => {
    const quest = parseQuestPage('Soul War Quest', soulWar)
    expect(quest).toMatchObject({
      id: 'soul-war',
      title: 'Soul War Quest',
      level: 250,
      premium: true,
      wiki: 'https://tibia.fandom.com/wiki/Soul_War_Quest',
      location: 'Zarganash',
    })
    expect(quest?.reward).toBe(
      'One random item from the Soul Set, Soul Mender achievement (under certain conditions), and base Revenant Outfits',
    )
    expect(quest?.warnings).toEqual([])
  })

  it('lvl 0 ou com texto vira level ausente ou o inteiro inicial', () => {
    const zero = parseQuestPage('Barbarian Test Quest', soulWar.replace('lvl            = 250', 'lvl            = 0'))
    expect(zero).not.toHaveProperty('level')
    const text = parseQuestPage(
      'The New Frontier Quest',
      soulWar.replace('lvl            = 250', 'lvl            = 77*(for the last mission only)'),
    )
    expect(text?.level).toBe(77)
  })

  it('premium partial e ? viram true com aviso; no vira false', () => {
    expect(parseQuestPage('X Quest', soulWar.replace('premium        = yes', 'premium        = no'))?.premium).toBe(false)
    const partial = parseQuestPage('X Quest', soulWar.replace('premium        = yes', 'premium        = partial'))
    expect(partial?.premium).toBe(true)
    expect(partial?.warnings.join(' ')).toContain('premium')
  })

  it('página sem name (cidade com lista) ou com type excluído devolve null', () => {
    expect(parseQuestPage('Carlin', '{{Infobox Quest|List=yes}}\nCarlin quests')).toBeNull()
    expect(parseQuestPage('Some Event', soulWar.replace('| type           = ', '| type           = mwc'))).toBeNull()
    expect(parseQuestPage('Some Event', soulWar.replace('| type           = ', '| type           = event'))).toBeNull()
  })

  it('recompensa é cortada em fronteira de vírgula até 300 caracteres', () => {
    const long = `${'A'.repeat(150)}, ${'B'.repeat(140)}, ${'C'.repeat(100)}`
    const quest = parseQuestPage('X Quest', soulWar.replace(/\| reward.*$/m, `| reward         = ${long}`))
    expect(quest?.reward?.length).toBeLessThanOrEqual(300)
    expect(quest?.reward?.endsWith('B'.repeat(140))).toBe(true)
  })
})
