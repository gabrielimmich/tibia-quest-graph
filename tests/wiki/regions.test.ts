import { describe, expect, it } from 'vitest'
import { resolveRegion } from '../../src/wiki/regions.ts'

const regions = new Map([
  ['Svargrond', ['Svargrond', 'Nibelor', 'Formorgar Mines']],
  ['Thais', ['Thais']],
])

describe('resolveRegion', () => {
  it('casa lugar exato sem caixa nem acento', () => {
    expect(resolveRegion('nibelor', regions)).toBe('Svargrond')
    expect(resolveRegion('Thaís', regions)).toBe('Thais')
  })

  it('casa por substring com o lugar mais longo', () => {
    expect(resolveRegion('Thais Ancient Temple', regions)).toBe('Thais')
    expect(resolveRegion('Formorgar Mines Hideout', regions)).toBe('Svargrond')
  })

  it('não mapeado vira Outros', () => {
    expect(resolveRegion('Zao', regions)).toBe('Outros')
    expect(resolveRegion(undefined, regions)).toBe('Outros')
  })
})
