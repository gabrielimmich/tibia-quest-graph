export interface PackItem {
  readonly id: string
  readonly w: number
  readonly h: number
}

export interface Placement {
  readonly x: number
  readonly y: number
}

// Empacotamento em prateleiras: da esquerda para a direita, quebrando a linha
// quando o próximo não cabe. Simples e previsível; blocos grandes primeiro
// (quem chama já ordena) dá um mapa que se lê de cima para baixo.
export function packShelves(items: readonly PackItem[], maxWidth: number, gap: number): ReadonlyMap<string, Placement> {
  const placed = new Map<string, Placement>()
  let x = 0
  let y = 0
  let shelfHeight = 0
  for (const item of items) {
    const fits = x === 0 || x + item.w <= maxWidth
    if (!fits) {
      x = 0
      y += shelfHeight + gap
      shelfHeight = 0
    }
    placed.set(item.id, { x, y })
    x += item.w + gap
    shelfHeight = Math.max(shelfHeight, item.h)
  }
  return placed
}
