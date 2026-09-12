import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parse, parseDocument, YAMLMap, YAMLSeq } from 'yaml'
import { buildQuestGraph, findCycle, parseQuestData, questId, type Edge, type Quest } from '../src/domain/index.ts'
import { createWikiClient } from '../src/wiki/client.ts'
import { extractEdgeCandidates, type EdgeCandidate } from '../src/wiki/edges.ts'
import { parseQuestPage, type QuestDraft } from '../src/wiki/quest-page.ts'
import { resolveRegion, UNMAPPED_REGION, type RegionMap } from '../src/wiki/regions.ts'

// Coleta da TibiaWiki para data/quests.yaml. Só ACRESCENTA: quests e arestas
// já presentes nunca são alteradas nem removidas (curadoria à mão vence);
// campos opcionais ausentes em quests antigas (reward, location, region)
// são preenchidos. Arestas novas entram com reviewed: false.

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
const drafts: QuestDraft[] = []
const skipped: string[] = []
for (const title of allTitles) {
  const wikitext = mainPages.get(title)
  const draft = wikitext === null || wikitext === undefined || excluded.has(title) ? null : parseQuestPage(title, wikitext)
  if (draft === null) skipped.push(title)
  else drafts.push(draft)
}
const slugCollisions = findCollisions(drafts)
if (slugCollisions.length > 0) fail(`ids em colisão: ${slugCollisions.join(', ')}`)
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

// ---- 3. mescla no YAML ----
const document = parseDocument(readFileSync(questsFile, 'utf8'))
const questsSeq = seqAt(document, 'quests')
const edgesSeq = seqAt(document, 'edges')
const existing = parseQuestData(document.toJS())
if (!existing.ok) fail(`data/quests.yaml atual inválido:\n${existing.errors.join('\n')}`)
const existingQuests = new Map(existing.graph.quests)
const idByTitle = new Map(drafts.map((draft) => [draft.title, draft.id] as const))
for (const quest of existingQuests.values()) idByTitle.set(quest.title, quest.id)

const added = { quests: 0, fields: 0, edges: 0 }
const queue: EdgeCandidate[] = []
const discarded: { candidate: EdgeCandidate; reason: string }[] = []
const warnings: string[] = []
const unmappedLocations = new Set<string>()

for (const draft of drafts) {
  const region = resolveRegion(draft.location, regions)
  if (region === UNMAPPED_REGION && draft.location !== undefined) unmappedLocations.add(draft.location)
  for (const warning of draft.warnings) warnings.push(`${draft.title}: ${warning}`)
  const current = existingQuests.get(questId(draft.id))
  if (current === undefined) {
    questsSeq.add(document.createNode(questRecord(draft, region)))
    existingQuests.set(questId(draft.id), toQuest(draft, region))
    added.quests += 1
    continue
  }
  // Quest curada à mão: só completa o que falta.
  const node = questsSeq.items.find((item) => item instanceof YAMLMap && item.get('id') === draft.id)
  if (!(node instanceof YAMLMap)) continue
  for (const [field, value] of [
    ['reward', draft.reward],
    ['location', draft.location],
    ['region', region],
  ] as const) {
    if (value !== undefined && !node.has(field)) {
      node.set(field, value)
      added.fields += 1
    }
  }
}

const rejected = loadRejected()
const acceptedEdges: Edge[] = [...existing.graph.edges]
const existingPairs = new Set(acceptedEdges.map((edge) => `${edge.from}→${edge.to}`))
const allQuests: Quest[] = [...existingQuests.values()]
// Não ambíguas primeiro: quando o mesmo par aparece duas vezes, a frase
// mais explícita é a que fica.
const ordered = [...candidates].sort((a, b) => Number(a.ambiguous) - Number(b.ambiguous))
for (const candidate of ordered) {
  const from = idByTitle.get(candidate.fromTitle)
  const to = idByTitle.get(candidate.toTitle)
  if (from === undefined || to === undefined) continue
  const pair = `${from}→${to}`
  if (existingPairs.has(pair)) continue
  if (rejected.has(pair)) {
    discarded.push({ candidate, reason: `rejeitada em rejected-edges.yaml: ${rejected.get(pair)}` })
    continue
  }
  const edge: Edge = {
    from: questId(from),
    to: questId(to),
    kind: candidate.kind,
    evidence: candidate.evidence,
    source: candidate.source,
    reviewed: false,
  }
  const cycle = findCycle(buildQuestGraph(allQuests, [...acceptedEdges, edge]))
  if (cycle) {
    discarded.push({ candidate, reason: `fecharia ciclo: ${cycle.join(' → ')}` })
    continue
  }
  acceptedEdges.push(edge)
  existingPairs.add(pair)
  edgesSeq.add(document.createNode(edge))
  added.edges += 1
  if (candidate.ambiguous) queue.push(candidate)
}

const result = parseQuestData(document.toJS())
if (!result.ok) fail(`resultado inválido, nada gravado:\n${result.errors.join('\n')}`)
writeFileSync(questsFile, document.toString({ lineWidth: 0 }), 'utf8')
console.log(`+${added.quests} quests, +${added.fields} campos, +${added.edges} arestas (${queue.length} na fila) → data/quests.yaml`)
console.log(`${result.graph.quests.size} quests, ${result.graph.edges.length} arestas no total`)

// ---- 4. documento de revisão ----
mkdirSync(reviewDir, { recursive: true })
const reviewFile = `${reviewDir}/${today}-edge-queue.md`
writeFileSync(reviewFile, reviewMarkdown(), 'utf8')
console.log(`fila de revisão → ${reviewFile}`)

// ---- helpers ----

function toQuest(draft: QuestDraft, region: string): Quest {
  return {
    id: questId(draft.id),
    title: draft.title,
    ...(draft.level !== undefined ? { level: draft.level } : {}),
    premium: draft.premium,
    wiki: draft.wiki,
    ...(draft.reward !== undefined ? { reward: draft.reward } : {}),
    ...(draft.location !== undefined ? { location: draft.location } : {}),
    region,
  }
}

function questRecord(draft: QuestDraft, region: string): Record<string, unknown> {
  return { ...toQuest(draft, region) }
}

function seqAt(doc: ReturnType<typeof parseDocument>, key: string): YAMLSeq {
  const node = doc.get(key)
  if (node instanceof YAMLSeq) return node
  const created = new YAMLSeq()
  doc.set(key, created)
  return created
}

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
  const resolved = await client.resolveRedirects([...targets])
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
  const line = (candidate: EdgeCandidate, extra = '') =>
    `- **${candidate.fromTitle} → ${candidate.toTitle}** (${candidate.kind}${extra}): "${candidate.evidence}" — [fonte](${candidate.source})`
  return [
    `# Fila de revisão de arestas (${today})`,
    '',
    'Gerado por `npm run collect`. Toda aresta abaixo já está em `data/quests.yaml`',
    'com `reviewed: false` e frase literal da wiki. Para aprovar: remova o',
    '`reviewed: false` (ou troque o `kind`). Para rejeitar: apague a aresta e',
    'registre o par em `data/rejected-edges.yaml`, senão a próxima coleta a traz de volta.',
    '',
    `## Ambíguas (${queue.length}): o tipo é leitura automática, confira`,
    '',
    ...queue.map((candidate) => line(candidate, `, ${candidate.where}`)),
    '',
    `## Descartadas (${discarded.length})`,
    '',
    ...discarded.map(({ candidate, reason }) => `${line(candidate)} — _${reason}_`),
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
