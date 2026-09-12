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
// A wiki grafa {{Infobox Quest}} e {{Infobox_Quest}}.
const INFOBOX = /\{\{\s*Infobox[ _]Quest\b/i

export function parseQuestPage(title: string, wikitext: string): QuestDraft | null {
  if (!INFOBOX.test(wikitext)) return null
  const fields = infoboxFields(wikitext)
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

// Corta em fim de frase (ou vírgula) e sinaliza o corte com reticências.
function clampReward(text: string): string {
  if (text.length <= REWARD_MAX) return text
  const head = text.slice(0, REWARD_MAX)
  const sentence = head.lastIndexOf('. ')
  const comma = head.lastIndexOf(', ')
  const cut = sentence > REWARD_MAX / 2 ? sentence : comma > REWARD_MAX / 2 ? comma : REWARD_MAX
  return `${head.slice(0, cut).trim()}…`
}

// "Various, starts in Thais" → Thais; "In and around Thais" → Thais;
// "Zao." → Zao. O primeiro lugar citado é o que vira região.
function firstLocation(text: string): string {
  const starts = /\b(?:starts?|begins?) (?:in|at) (?:the )?([^,;.(]+)/i.exec(text)
  const raw = starts?.[1] ?? text.replace(/^(?:in|around|near) (?:and around )?/i, '')
  return (raw.split(/,|;|\(| and | or /)[0] ?? '').replace(/\.\s*$/, '').trim()
}
