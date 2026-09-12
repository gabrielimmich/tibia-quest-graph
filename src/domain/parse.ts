import {
  EDGE_KINDS,
  buildQuestGraph,
  questId,
  type Edge,
  type EdgeKind,
  type Quest,
  type QuestGraph,
} from './quest.ts'
import { findCycle } from './traversal.ts'

export type ParseResult =
  | { readonly ok: true; readonly graph: QuestGraph }
  | { readonly ok: false; readonly errors: readonly string[] }

export const WIKI_PREFIX = 'https://tibia.fandom.com/wiki/'
export const EVIDENCE_PLACEHOLDER = '<trecho literal copiado da página da wiki>'

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
const QUEST_FIELDS: ReadonlySet<string> = new Set(['id', 'title', 'level', 'premium', 'wiki', 'unlocks'])
const EDGE_FIELDS: ReadonlySet<string> = new Set(['from', 'to', 'kind', 'evidence', 'source'])

type Raw = Record<string, unknown>

// Acumula todos os erros em vez de parar no primeiro: quem edita o YAML à
// mão quer a lista inteira de uma vez.
export function parseQuestData(raw: unknown): ParseResult {
  if (!isRecord(raw)) return { ok: false, errors: ['raiz deve ser um objeto com "quests" e "edges"'] }

  const errors: string[] = []
  const rawQuests = raw['quests']
  const rawEdges = raw['edges']
  if (!isList(rawQuests)) errors.push('"quests" deve ser uma lista')
  if (!isList(rawEdges)) errors.push('"edges" deve ser uma lista')
  if (!isList(rawQuests) || !isList(rawEdges)) return { ok: false, errors }

  const { quests, knownIds } = parseQuests(rawQuests, errors)
  const edges = parseEdges(rawEdges, knownIds, errors)
  if (errors.length > 0) return { ok: false, errors }

  const graph = buildQuestGraph(quests, edges)
  const cycle = findCycle(graph)
  if (cycle) return { ok: false, errors: [`ciclo: ${cycle.join(' → ')}`] }

  return { ok: true, graph }
}

interface ParsedQuests {
  readonly quests: readonly Quest[]
  // Ids brutos, incluindo os de quests com outros campos inválidos: uma
  // quest com `premium: "yes"` não pode fazer todas as suas arestas
  // reclamarem de "id inexistente".
  readonly knownIds: ReadonlySet<string>
}

function parseQuests(items: readonly unknown[], errors: string[]): ParsedQuests {
  const quests: Quest[] = []
  const knownIds = new Set<string>()
  items.forEach((item, index) => {
    const where = `quest[${index}]`
    if (!isRecord(item)) {
      errors.push(`${where}: deve ser um objeto`)
      return
    }
    const rawId = item['id']
    if (typeof rawId === 'string') {
      if (knownIds.has(rawId)) errors.push(`id duplicado: "${rawId}"`)
      knownIds.add(rawId)
    }
    const quest = parseQuest(item, where, errors)
    if (quest) quests.push(quest)
  })
  return { quests, knownIds }
}

function parseQuest(item: Raw, where: string, errors: string[]): Quest | null {
  const before = errors.length
  rejectUnknownFields(item, QUEST_FIELDS, where, errors)
  const id = expectString(item, 'id', where, errors)
  const title = expectString(item, 'title', where, errors)
  const premium = expectBoolean(item, 'premium', where, errors)
  const wiki = expectWikiUrl(item, 'wiki', where, errors)
  const unlocks = expectString(item, 'unlocks', where, errors)
  const level = expectOptionalLevel(item, where, errors)
  if (id !== null && !ID_PATTERN.test(id)) errors.push(`${where}: id "${id}" deve ser kebab-case`)

  if (errors.length > before) return null
  if (id === null || title === null || premium === null || wiki === null || unlocks === null) return null

  const quest: Quest = { id: questId(id), title, premium, wiki, unlocks }
  return level === undefined ? quest : { ...quest, level }
}

function parseEdges(items: readonly unknown[], knownIds: ReadonlySet<string>, errors: string[]): Edge[] {
  const edges: Edge[] = []
  const seenPairs = new Set<string>()
  items.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push(`edge[${index}]: deve ser um objeto`)
      return
    }
    const edge = parseEdge(item, index, knownIds, errors)
    if (!edge) return
    const pair = `${edge.from}→${edge.to}`
    if (seenPairs.has(pair)) errors.push(`aresta duplicada: ${pair}`)
    seenPairs.add(pair)
    edges.push(edge)
  })
  return edges
}

function parseEdge(item: Raw, index: number, knownIds: ReadonlySet<string>, errors: string[]): Edge | null {
  const before = errors.length
  const rawFrom = item['from']
  const rawTo = item['to']
  const where =
    typeof rawFrom === 'string' && typeof rawTo === 'string' ? `edge ${rawFrom}→${rawTo}` : `edge[${index}]`

  rejectUnknownFields(item, EDGE_FIELDS, where, errors)
  const from = expectString(item, 'from', where, errors)
  const to = expectString(item, 'to', where, errors)
  const kind = expectEdgeKind(item, where, errors)
  const evidence = expectEvidence(item, where, errors)
  const source = expectWikiUrl(item, 'source', where, errors)
  if (from !== null && !knownIds.has(from)) errors.push(`${where}: "from" aponta para id inexistente "${from}"`)
  if (to !== null && !knownIds.has(to)) errors.push(`${where}: "to" aponta para id inexistente "${to}"`)
  if (from !== null && to !== null && from === to) errors.push(`${where}: uma quest não pode depender de si mesma`)

  if (errors.length > before) return null
  if (from === null || to === null || kind === null || evidence === null || source === null) return null

  return { from: questId(from), to: questId(to), kind, evidence, source }
}

function isRecord(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Array.isArray devolve any[]; este guard mantém unknown[] e o zero-any.
function isList(value: unknown): value is readonly unknown[] {
  return Array.isArray(value)
}

function rejectUnknownFields(item: Raw, allowed: ReadonlySet<string>, where: string, errors: string[]): void {
  for (const key of Object.keys(item)) {
    if (!allowed.has(key)) errors.push(`${where}: campo desconhecido "${key}"`)
  }
}

function expectString(item: Raw, field: string, where: string, errors: string[]): string | null {
  const value = item[field]
  if (typeof value === 'string' && value.trim() !== '') return value
  errors.push(`${where}: "${field}" deve ser texto não vazio`)
  return null
}

function expectBoolean(item: Raw, field: string, where: string, errors: string[]): boolean | null {
  const value = item[field]
  if (typeof value === 'boolean') return value
  errors.push(`${where}: "${field}" deve ser boolean`)
  return null
}

function expectWikiUrl(item: Raw, field: string, where: string, errors: string[]): string | null {
  const value = expectString(item, field, where, errors)
  if (value === null) return null
  if (value.startsWith(WIKI_PREFIX)) return value
  errors.push(`${where}: "${field}" não é página da TibiaWiki (esperado prefixo ${WIKI_PREFIX})`)
  return null
}

function expectOptionalLevel(item: Raw, where: string, errors: string[]): number | undefined {
  const value = item['level']
  if (value === undefined) return undefined
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value
  errors.push(`${where}: "level" deve ser inteiro maior que zero`)
  return undefined
}

function expectEdgeKind(item: Raw, where: string, errors: string[]): EdgeKind | null {
  const value = item['kind']
  const kind = EDGE_KINDS.find((candidate) => candidate === value)
  if (kind) return kind
  errors.push(`${where}: kind inválido ${JSON.stringify(value)} (use ${EDGE_KINDS.join(' | ')})`)
  return null
}

function expectEvidence(item: Raw, where: string, errors: string[]): string | null {
  const value = item['evidence']
  if (typeof value === 'string') {
    // Block scalars do YAML (`>` / `|`) deixam "\n" no fim; tirar espaço
    // externo não altera a citação, e evita que ele chegue ao painel.
    const trimmed = value.trim()
    if (trimmed !== '' && trimmed !== EVIDENCE_PLACEHOLDER) return trimmed
  }
  errors.push(`${where}: evidence obrigatória, copiada literalmente da wiki (regra de ouro)`)
  return null
}
