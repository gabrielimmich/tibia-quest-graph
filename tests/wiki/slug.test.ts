import { describe, expect, it } from 'vitest'
import { questSlug, wikiUrl } from '../../src/wiki/slug.ts'

describe('questSlug', () => {
  it('kebab-case sem o sufixo Quest, sem acento nem apóstrofo', () => {
    expect(questSlug("Ferumbras' Ascension Quest")).toBe('ferumbras-ascension')
    expect(questSlug('The Djinn War - Marid Faction')).toBe('the-djinn-war-marid-faction')
    expect(questSlug('Citizen Outfits Quest on Rook')).toBe('citizen-outfits-quest-on-rook')
    expect(questSlug('Kingdom of Kormarak Quest')).toBe('kingdom-of-kormarak')
    expect(questSlug('20 Years a Cook Quest')).toBe('20-years-a-cook')
  })
})

describe('wikiUrl', () => {
  it('monta a URL da página com underscores e apóstrofo codificado', () => {
    expect(wikiUrl("Ferumbras' Ascension Quest")).toBe('https://tibia.fandom.com/wiki/Ferumbras%27_Ascension_Quest')
    expect(wikiUrl('Soul War Quest', 'Spoiler')).toBe('https://tibia.fandom.com/wiki/Soul_War_Quest/Spoiler')
  })
})
