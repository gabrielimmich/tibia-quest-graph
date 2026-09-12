import { infoboxFields, stripMarkup } from './markup.ts'
import { questSlug, wikiUrl } from './slug.ts'

export interface QuestDraft {
  readonly id: string
  readonly title: string
  readonly level?: number
  readonly premium: boolean
  readonly wiki: string
  readonly reward?: string
  readonly location?: string
  readonly warnings: readonly string[]
}

// Mini world changes, eventos e trocas de item têm Infobox Quest na wiki mas
// não são quests com pré-requisitos.
const EXCLUDED_TYPES = new Set(['mwc', 'event', 'change', 'exchange'])
const REWARD_MAX = 300

export function parseQuestPage(title: string, wikitext: string): QuestDraft | null {
  const fields = infoboxFields(wikitext)
  if (!wikitext.includes('{{Infobox Quest')) return null
  if ((fields.get('name') ?? '') === '') return null
  if (EXCLUDED_TYPES.has((fields.get('type') ?? '').trim().toLowerCase())) return null

  const warnings: string[] = []
  const level = parseLevel(fields.get('lvl') ?? '')
  const premium = parsePremium(fields.get('premium') ?? '', warnings)
  const reward = clampReward(stripMarkup(fields.get('reward') ?? ''))
  const location = firstLocation(stripMarkup(fields.get('location') ?? ''))

  return {
    id: questSlug(title),
    title,
    ...(level !== undefined ? { level } : {}),
    premium,
    wiki: wikiUrl(title),
    ...(reward !== '' ? { reward } : {}),
    ...(location !== '' ? { location } : {}),
    warnings,
  }
}

// "77*(for the last mission only)" → 77; "0" e vazio → sem level.
function parseLevel(raw: string): number | undefined {
  const match = /^\s*(\d+)/.exec(raw)
  if (!match) return undefined
  const level = Number(match[1])
  return level > 0 ? level : undefined
}

// partial e ? exigem premium em alguma parte da quest: true, com aviso para a
// curadoria. Vazio também vira true, o caso mais comum na wiki.
function parsePremium(raw: string, warnings: string[]): boolean {
  const value = raw.trim().toLowerCase()
  if (value === 'no') return false
  if (value === 'yes') return true
  warnings.push(`premium "${raw}" interpretado como true`)
  return true
}

// Corta em vírgula/ponto para não terminar no meio de um item.
function clampReward(text: string): string {
  if (text.length <= REWARD_MAX) return text
  const head = text.slice(0, REWARD_MAX)
  const cut = Math.max(head.lastIndexOf(', '), head.lastIndexOf('. '))
  return (cut > REWARD_MAX / 2 ? head.slice(0, cut) : head).trim()
}

function firstLocation(text: string): string {
  return (text.split(/,|;|\(| and | or /)[0] ?? '').trim()
}
