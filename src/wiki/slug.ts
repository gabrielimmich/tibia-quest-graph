import { normalizeText } from '../domain/index.ts'

const WIKI_BASE = 'https://tibia.fandom.com/wiki/'

// "Ferumbras' Ascension Quest" → "ferumbras-ascension". O sufixo " Quest" só
// cai quando é o fim do título: "Citizen Outfits Quest on Rook" mantém.
export function questSlug(title: string): string {
  return normalizeText(title.replace(/ Quest$/i, ''))
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function wikiUrl(title: string, subpage?: string): string {
  const page = subpage === undefined ? title : `${title}/${subpage}`
  // MediaWiki aceita o apóstrofo cru, mas %27 é o que a wiki mesma gera nos links.
  return WIKI_BASE + encodeURIComponent(page.replace(/ /g, '_')).replace(/'/g, '%27').replace(/%2F/g, '/')
}
