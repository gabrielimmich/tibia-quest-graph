import { normalizeText } from '../domain/index.ts'

export type RegionMap = ReadonlyMap<string, readonly string[]>

export const UNMAPPED_REGION = 'Outros'

// Lugar exato primeiro; depois o lugar mapeado mais longo que apareça dentro
// do texto ("Thais Ancient Temple" → Thais). Nada → Outros, para a curadoria
// achar o que falta no regions.yaml.
export function resolveRegion(location: string | undefined, regions: RegionMap): string {
  if (location === undefined) return UNMAPPED_REGION
  const needle = normalizeText(location)
  let best: { region: string; length: number } | null = null
  for (const [region, places] of regions) {
    for (const place of places) {
      const candidate = normalizeText(place)
      if (candidate === needle) return region
      if (needle.includes(candidate) && (best === null || candidate.length > best.length)) {
        best = { region, length: candidate.length }
      }
    }
  }
  return best?.region ?? UNMAPPED_REGION
}
