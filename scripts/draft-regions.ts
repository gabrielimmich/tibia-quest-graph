import { existsSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { stringify } from 'yaml'
import { createWikiClient } from '../src/wiki/client.ts'
import { infoboxFields, stripMarkup } from '../src/wiki/markup.ts'
import { parseQuestPage } from '../src/wiki/quest-page.ts'

// Rascunho de data/regions.yaml: agrupa os lugares das quests pela `city` que
// a página do lugar declara na wiki. O resultado é ponto de partida para
// curadoria à mão; o script não sobrescreve um arquivo existente.

const root = fileURLToPath(new URL('..', import.meta.url))
const regionsFile = `${root}data/regions.yaml`
if (existsSync(regionsFile) && !process.argv.includes('--force')) {
  console.error(`${regionsFile} já existe; use --force para regerar`)
  process.exit(1)
}

const client = createWikiClient({ cacheDir: `${root}.cache/wiki`, refresh: process.argv.includes('--refresh') })
const titles = (await client.listEmbedding('Template:Infobox Quest')).filter((title) => !title.includes('/'))
const pages = await client.fetchWikitext(titles)

const locations = new Map<string, number>()
for (const [title, wikitext] of pages) {
  if (wikitext === null) continue
  const draft = parseQuestPage(title, wikitext)
  if (draft?.location !== undefined) locations.set(draft.location, (locations.get(draft.location) ?? 0) + 1)
}
console.log(`${locations.size} lugares distintos em ${titles.length} páginas`)

const placePages = await client.fetchWikitext([...locations.keys()])
const regions = new Map<string, Set<string>>()
const unmapped: string[] = []
for (const [place] of locations) {
  const wikitext = placePages.get(place)
  const fields = wikitext === null || wikitext === undefined ? new Map<string, string>() : infoboxFields(wikitext)
  const isCity = wikitext?.includes('{{Infobox City') ?? false
  const city = isCity ? place : stripMarkup(fields.get('city') ?? '')
  if (city === '') {
    unmapped.push(place)
    continue
  }
  const places = regions.get(city) ?? new Set<string>()
  places.add(place)
  regions.set(city, places)
}

const sorted = [...regions.entries()].sort(([a], [b]) => a.localeCompare(b))
const document = {
  regions: Object.fromEntries(sorted.map(([region, places]) => [region, [...places].sort()])),
  excluded: [],
}
writeFileSync(
  regionsFile,
  [
    '# Região → lugares (valor do campo `location` do infobox da quest).',
    '# Rascunho gerado por `npm run draft-regions` a partir do campo `city` das',
    '# páginas de lugar da wiki; curado à mão depois. Lugar sem região vira "Outros".',
    '#',
    `# Sem city na wiki (${unmapped.length}): ${unmapped.sort().join(' | ')}`,
    '',
    stringify(document),
  ].join('\n'),
  'utf8',
)
console.log(`${regions.size} regiões, ${unmapped.length} lugares sem city → ${regionsFile}`)
