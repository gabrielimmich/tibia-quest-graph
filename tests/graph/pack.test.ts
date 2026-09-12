import { describe, expect, it } from 'vitest'
import { packShelves } from '../../src/graph/pack.ts'

describe('packShelves', () => {
  it('coloca itens lado a lado até estourar a largura, depois quebra a prateleira', () => {
    const placed = packShelves(
      [
        { id: 'a', w: 100, h: 50 },
        { id: 'b', w: 100, h: 80 },
        { id: 'c', w: 100, h: 30 },
      ],
      230,
      10,
    )
    expect(placed.get('a')).toEqual({ x: 0, y: 0 })
    expect(placed.get('b')).toEqual({ x: 110, y: 0 })
    // c não cabe (110 + 100 + 10 > 230): nova prateleira abaixo da mais alta (80) + gap
    expect(placed.get('c')).toEqual({ x: 0, y: 90 })
  })

  it('item mais largo que a prateleira ocupa uma linha sozinho', () => {
    const placed = packShelves(
      [
        { id: 'wide', w: 500, h: 40 },
        { id: 'b', w: 50, h: 40 },
      ],
      200,
      10,
    )
    expect(placed.get('wide')).toEqual({ x: 0, y: 0 })
    expect(placed.get('b')).toEqual({ x: 0, y: 50 })
  })

  it('lista vazia devolve mapa vazio', () => {
    expect(packShelves([], 100, 10).size).toBe(0)
  })
})
