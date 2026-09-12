import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { createWikiClient } from '../src/wiki/client.ts'
import { extractEdgeCandidates, type EdgeCandidate } from '../src/wiki/edges.ts'
import { mergeCollected, type RegionedDraft } from '../src/wiki/merge.ts'
import { parseQuestPage, type QuestDraft } from '../src/wiki/quest-page.ts'
import { resolveRegion, UNMAPPED_REGION, type RegionMap } from '../src/wiki/regions.ts'

// Coleta da TibiaWiki para data/quests.yaml. Toda a lógica de mescla (só
// acrescentar, ciclos, rejeitadas, fila) está em src/wiki/merge.ts, testada;
// aqui é só I/O e relatório.

const root = fileURLToPath(new URL('..', import.meta.url))
const questsFile = `${root}data/quests.yaml`
const rejectedFile = `${root}data/rejected-edges.yaml`
const regionsFile = `${root}data/regions.yaml`
const reviewDir = `${root}docs/superpowers/review`
const today = new Date().toISOString().slice(0, 10)
const refresh = process.argv.includes('--refresh')

const client = createWikiClient({ cacheDir: `${root}.cache/wiki`, refresh })

// ---- 1. quests ----
const regions = loadRegions()
const excluded = new Set(loadExcluded())
const allTitles = (await client.listEmbedding('Template:Infobox Quest')).filter((title) => !title.includes('/'))
const mainPages = await client.fetchWikitext(allTitles)
const drafts: RegionedDraft[] = []
const skipped: string[] = []
const warnings: string[] = []
const unmappedLocations = new Set<string>()
for (const title of allTitles) {
  const wikitext = mainPages.get(title)
  const draft = wikitext === null || wikitext === undefined || excluded.has(title) ? null : parseQuestPage(title, wikitext)
  if (draft === null) {
    skipped.push(title)
    continue
  }
  const region = resolveRegion(draft.location, regions)
  if (region === UNMAPPED_REGION && draft.location !== undefined) unmappedLocations.add(draft.location)
  for (const warning of draft.warnings) warnings.push(`${draft.title}: ${warning}`)
  drafts.push({ ...draft, region })
}
const collisions = findCollisions(drafts)
if (collisions.length > 0) fail(`ids em colisão: ${collisions.join(', ')}`)
console.log(`${drafts.length} quests reais (${skipped.length} páginas ignoradas)`)

// ---- 2. arestas ----
const knownTitles = new Set(drafts.map((draft) => draft.title))
const spoilerPages = await client.fetchWikitext(drafts.map((draft) => `${draft.title}/Spoiler`))
const aliases = await resolveAliases()
const candidates: EdgeCandidate[] = []
for (const draft of drafts) {
  const spoiler = spoilerPages.get(`${draft.title}/Spoiler`)
  if (spoiler === null || spoiler === undefined) continue
  candidates.push(...extractEdgeCandidates(draft.title, spoiler, knownTitles, aliases))
}
console.log(`${candidates.length} arestas candidatas`)

// ---- 3. mescla ----
const merged = mergeCollected({ yamlText: readFileSync(questsFile, 'utf8'), drafts, candidates, rejected: loadRejected() })
if (!merged.ok) fail(merged.errors.join('\n'))
writeFileSync(questsFile, merged.yamlText, 'utf8')
const { quests, fields, edges } = merged.added
console.log(`+${quests} quests, +${fields} campos, +${edges} arestas → data/quests.yaml`)
console.log(
  `${merged.unreviewed.length} arestas não revisadas no total, ${merged.unreviewed.filter((u) => u.flagged).length} marcadas "revisar"`,
)

// ---- 4. documento de revisão ----
mkdirSync(reviewDir, { recursive: true })
const reviewFile = `${reviewDir}/${today}-edge-queue.md`
writeFileSync(reviewFile, reviewMarkdown(), 'utf8')
console.log(`fila de revisão → ${reviewFile}`)

// ---- helpers ----

function findCollisions(list: readonly QuestDraft[]): string[] {
  const seen = new Map<string, string>()
  const collisions: string[] = []
  for (const draft of list) {
    const other = seen.get(draft.id)
    if (other !== undefined) collisions.push(`${draft.id} (${other} / ${draft.title})`)
    seen.set(draft.id, draft.title)
  }
  return collisions
}

// Links como [[Ice Islands Quest]] são redirects para o título real; a API
// resolve em lote. Só interessa o que aponta para uma quest conhecida.
async function resolveAliases(): Promise<Map<string, string>> {
  const targets = new Set<string>()
  for (const spoiler of spoilerPages.values()) {
    for (const match of (spoiler ?? '').matchAll(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g)) {
      const target = (match[1] ?? '').split('/')[0]?.replace(/_/g, ' ').trim() ?? ''
      if (/Quest$/i.test(target) && !knownTitles.has(target)) targets.add(target)
    }
  }
  const resolved = await client.resolveRedirects([...targets].sort())
  const aliases = new Map<string, string>()
  for (const [from, to] of resolved) if (knownTitles.has(to)) aliases.set(from, to)
  console.log(`${aliases.size} redirects de quests resolvidos`)
  return aliases
}

function loadRegions(): RegionMap {
  if (!existsSync(regionsFile)) return new Map()
  const raw: unknown = parse(readFileSync(regionsFile, 'utf8'))
  const regionsRaw = isRecord(raw) && isRecord(raw['regions']) ? raw['regions'] : {}
  const map = new Map<string, string[]>()
  for (const [region, places] of Object.entries(regionsRaw)) {
    if (Array.isArray(places)) map.set(region, places.filter((place): place is string => typeof place === 'string'))
  }
  return map
}

function loadExcluded(): string[] {
  if (!existsSync(regionsFile)) return []
  const raw: unknown = parse(readFileSync(regionsFile, 'utf8'))
  const list = isRecord(raw) && Array.isArray(raw['excluded']) ? raw['excluded'] : []
  return list.filter((title): title is string => typeof title === 'string')
}

function loadRejected(): Map<string, string> {
  const map = new Map<string, string>()
  if (!existsSync(rejectedFile)) return map
  const raw: unknown = parse(readFileSync(rejectedFile, 'utf8'))
  const list = isRecord(raw) && Array.isArray(raw['rejected']) ? raw['rejected'] : []
  for (const item of list) {
    if (!isRecord(item)) continue
    const from = item['from']
    const to = item['to']
    const reason = item['reason']
    if (typeof from === 'string' && typeof to === 'string') {
      map.set(`${from}→${to}`, typeof reason === 'string' ? reason : '')
    }
  }
  return map
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function reviewMarkdown(): string {
  const titleOf = new Map(drafts.map((draft) => [draft.id, draft.title] as const))
  const name = (id: string) => titleOf.get(id) ?? id
  const flagged = merged.unreviewed.filter((u) => u.flagged)
  const plain = merged.unreviewed.filter((u) => !u.flagged)
  const line = ({ edge }: (typeof merged.unreviewed)[number]) =>
    `- **${name(edge.from)} → ${name(edge.to)}** (${edge.kind}): "${edge.evidence}" — [fonte](${edge.source})`
  return [
    `# Fila de revisão de arestas (${today})`,
    '',
    'Gerado por `npm run collect` a partir de tudo que está em `data/quests.yaml` com',
    '`reviewed: false`, então sobrevive a coletas futuras. Para aprovar: remova o',
    '`reviewed: false` (e o comentário `revisar`, se houver) ou troque o `kind`. Para',
    'rejeitar: apague a aresta e registre o par em `data/rejected-edges.yaml`, senão a',
    'próxima coleta a traz de volta.',
    '',
    `## Marcadas "revisar" (${flagged.length}): tipo ou direção lidos automaticamente`,
    '',
    ...flagged.map(line),
    '',
    `## Demais não revisadas (${plain.length}): frase inequívoca da seção de requisitos`,
    '',
    ...plain.map(line),
    '',
    `## Descartadas nesta coleta (${merged.discarded.length})`,
    '',
    ...merged.discarded.map(
      ({ candidate, reason }) =>
        `- **${candidate.fromTitle} → ${candidate.toTitle}** (${candidate.kind}): "${candidate.evidence}" — [fonte](${candidate.source}) — _${reason}_`,
    ),
    '',
    `## Lugares sem região (${unmappedLocations.size}): acrescente em \`data/regions.yaml\``,
    '',
    ...[...unmappedLocations].sort().map((location) => `- ${location}`),
    '',
    `## Avisos (${warnings.length})`,
    '',
    ...warnings.map((warning) => `- ${warning}`),
    '',
    `## Páginas ignoradas (${skipped.length}): sem infobox de quest, tipo excluído ou em \`excluded\``,
    '',
    skipped.sort().join(' · '),
    '',
  ].join('\n')
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}
