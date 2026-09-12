import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Único módulo de src/wiki com I/O: API MediaWiki + cache em disco.

const API = 'https://tibia.fandom.com/api.php'
const USER_AGENT = 'tibia-quest-graph/0.2 (fansite data curation; gabrielfernandoi@gmail.com)'
const BATCH = 50
const PAUSE_MS = 300

export interface WikiClientOptions {
  readonly cacheDir: string
  readonly refresh?: boolean
}

export interface WikiClient {
  readonly listEmbedding: (template: string) => Promise<string[]>
  readonly fetchWikitext: (titles: readonly string[]) => Promise<ReadonlyMap<string, string | null>>
  readonly resolveRedirects: (titles: readonly string[]) => Promise<ReadonlyMap<string, string>>
}

export function createWikiClient({ cacheDir, refresh = false }: WikiClientOptions): WikiClient {
  mkdirSync(cacheDir, { recursive: true })

  const cached = async (key: string, load: () => Promise<unknown>): Promise<unknown> => {
    const file = join(cacheDir, `${createHash('sha1').update(key).digest('hex')}.json`)
    if (!refresh && existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'))
    const value = await load()
    writeFileSync(file, JSON.stringify(value), 'utf8')
    await pause()
    return value
  }

  const call = async (params: Record<string, string>): Promise<unknown> => {
    const url = `${API}?${new URLSearchParams({ ...params, format: 'json', formatversion: '2' })}`
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`)
    return response.json()
  }

  const listEmbedding = async (template: string): Promise<string[]> => {
    const titles: string[] = []
    let cont: Record<string, string> = {}
    for (;;) {
      const key = `embeddedin:${template}:${JSON.stringify(cont)}`
      const page = await cached(key, () =>
        call({ action: 'query', list: 'embeddedin', eititle: template, eilimit: '500', einamespace: '0', ...cont }),
      )
      const parsed = asEmbeddedIn(page)
      titles.push(...parsed.titles)
      if (parsed.next === null) return titles
      cont = parsed.next
    }
  }

  const fetchWikitext = async (titles: readonly string[]): Promise<ReadonlyMap<string, string | null>> => {
    const result = new Map<string, string | null>()
    for (let index = 0; index < titles.length; index += BATCH) {
      const batch = titles.slice(index, index + BATCH)
      const page = await cached(`revisions:${batch.join('|')}`, () =>
        call({ action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', titles: batch.join('|') }),
      )
      for (const [title, content] of asRevisions(page)) result.set(title, content)
    }
    // Títulos normalizados pela wiki (ex.: primeira letra) voltam com o nome pedido.
    for (const title of titles) if (!result.has(title)) result.set(title, null)
    return result
  }

  const resolveRedirects = async (titles: readonly string[]): Promise<ReadonlyMap<string, string>> => {
    const result = new Map<string, string>()
    for (let index = 0; index < titles.length; index += BATCH) {
      const batch = titles.slice(index, index + BATCH)
      const page = await cached(`redirects:${batch.join('|')}`, () =>
        call({ action: 'query', redirects: '1', titles: batch.join('|') }),
      )
      for (const [from, to] of asRedirects(page)) result.set(from, to)
    }
    return result
  }

  return { listEmbedding, fetchWikitext, resolveRedirects }
}

function pause(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, PAUSE_MS))
}

// ---- leitura defensiva das respostas (a API é JSON sem tipos) ----

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isList(value: unknown): value is readonly unknown[] {
  return Array.isArray(value)
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asEmbeddedIn(page: unknown): { titles: string[]; next: Record<string, string> | null } {
  const titles: string[] = []
  if (!isRecord(page)) return { titles, next: null }
  const query = isRecord(page['query']) ? page['query'] : {}
  for (const item of isList(query['embeddedin']) ? query['embeddedin'] : []) {
    const title = isRecord(item) ? str(item['title']) : null
    if (title !== null) titles.push(title)
  }
  const cont = page['continue']
  if (!isRecord(cont)) return { titles, next: null }
  const next: Record<string, string> = {}
  for (const [key, value] of Object.entries(cont)) {
    const text = str(value)
    if (text !== null) next[key] = text
  }
  return { titles, next }
}

function asRevisions(page: unknown): [string, string | null][] {
  const out: [string, string | null][] = []
  if (!isRecord(page)) return out
  const query = isRecord(page['query']) ? page['query'] : {}
  for (const item of isList(query['pages']) ? query['pages'] : []) {
    if (!isRecord(item)) continue
    const title = str(item['title'])
    if (title === null) continue
    const revisions = isList(item['revisions']) ? item['revisions'] : []
    const first = revisions[0]
    const slots = isRecord(first) && isRecord(first['slots']) ? first['slots'] : {}
    const main = isRecord(slots['main']) ? slots['main'] : {}
    out.push([title, str(main['content'])])
  }
  return out
}

function asRedirects(page: unknown): [string, string][] {
  const out: [string, string][] = []
  if (!isRecord(page)) return out
  const query = isRecord(page['query']) ? page['query'] : {}
  for (const item of isList(query['redirects']) ? query['redirects'] : []) {
    if (!isRecord(item)) continue
    const from = str(item['from'])
    const to = str(item['to'])
    if (from !== null && to !== null) out.push([from, to])
  }
  return out
}
