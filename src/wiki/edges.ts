import type { EdgeKind } from '../domain/index.ts'
import { sentences, stripMarkup } from './markup.ts'
import { wikiUrl } from './slug.ts'

export interface EdgeCandidate {
  readonly fromTitle: string
  readonly toTitle: string
  readonly kind: EdgeKind
  // true = a frase cita a quest mas o tipo de exigência é uma leitura minha
  // (parcial, menção sem verbo): vai para a fila de revisão.
  readonly ambiguous: boolean
  readonly where: 'requirements' | 'body'
  readonly evidence: string
  readonly source: string
}

export type TitleAliases = ReadonlyMap<string, string>

const REQUIREMENT_SECTIONS = new Set(['requirements', 'required equipment', 'prerequisites', 'requirement'])

// Fora da seção de requisitos só entra frase que exige explicitamente.
const STRONG_REQUIREMENT =
  /\b(must have (completed|finished|done)|needs? to have (completed|finished|done)|required to (have )?(complete|finish)|you (need|have) to (complete|finish)|succeed(ed)? (the|in)|having (completed|finished))\b/i

// Exigência parcial (missão, rank, estágio): a aresta existe, mas "required"
// da quest inteira é leitura minha, então vai para a fila.
const PARTIAL =
  /\b(missions? \d|first \d+|up to|until|full quest not needed|only the first|at least|\brank\b|\bstage\b|\bstarted\b|\w+ mission of|mission \w+:)\b/
const SOFT =
  /\b(recommended|advisable|optional|only necessary|bring a friend|helpful but|wise to|smart to|good idea|if required|if needed|if necessary)\b/
// "Completing this quest ... allows you to start X": a página descreve o que
// ELA libera, então a aresta é da página para X, não o contrário.
const UNLOCKS = /\b(allows? you to (start|do|begin)|unlocks?|you can (now |then )?start|lets you (start|do)|gives (you )?access to)\b/i
const COMPLETION = /\b(complet(e|ed|ing|ion)|finish(ed)?|succeed(ed)?|done)\b/
const ACCESS = /\b(access|permission to|to enter|to reach|shortcut)\b/

export function classifyKind(sentence: string): { kind: EdgeKind; ambiguous: boolean } {
  const text = sentence.toLowerCase()
  if (SOFT.test(text)) return { kind: 'recommended', ambiguous: false }
  // "Access to X (Complete the Y)": a exigência é o acesso; o "complete"
  // dentro do parêntese é o meio.
  if (/^access to\b/.test(text)) return { kind: 'access', ambiguous: PARTIAL.test(text) }
  if (COMPLETION.test(text)) return { kind: 'required', ambiguous: PARTIAL.test(text) }
  if (ACCESS.test(text)) return { kind: 'access', ambiguous: PARTIAL.test(text) }
  return { kind: 'required', ambiguous: true }
}

export function extractEdgeCandidates(
  title: string,
  spoilerWikitext: string,
  knownTitles: ReadonlySet<string>,
  aliases: TitleAliases,
): EdgeCandidate[] {
  const source = wikiUrl(title, 'Spoiler')
  const canonical = (raw: string): string | null => {
    const name = normalizeTitle(raw)
    if (knownTitles.has(name)) return name
    return aliases.get(name) ?? null
  }
  const found = new Map<string, EdgeCandidate>()
  const consider = (mentioned: string, evidence: string, where: EdgeCandidate['where']) => {
    if (mentioned === title) return
    const reversed = UNLOCKS.test(evidence)
    const [fromTitle, toTitle] = reversed ? [title, mentioned] : [mentioned, title]
    const key = `${fromTitle}→${toTitle}`
    if (found.has(key)) return
    const { kind, ambiguous } = classifyKind(evidence)
    // Direção invertida e frase fora da seção de requisitos são leitura
    // minha: vão para a fila (decisão da fase 2: "fora da seção vai para fila").
    found.set(key, {
      fromTitle,
      toTitle,
      kind,
      ambiguous: reversed || where === 'body' || ambiguous,
      where,
      evidence,
      source,
    })
  }

  for (const section of splitSections(spoilerWikitext)) {
    const inRequirements = REQUIREMENT_SECTIONS.has(section.title.toLowerCase())
    for (const line of section.lines) {
      const mentions = findMentions(line, canonical)
      if (mentions.length === 0) continue
      const text = stripMarkup(line)
      if (inRequirements) {
        for (const mention of mentions) consider(mention.title, text, 'requirements')
        continue
      }
      const parts = sentences(text)
      for (const sentence of parts) {
        if (!STRONG_REQUIREMENT.test(sentence)) continue
        for (const mention of mentions) {
          // Alias de uma palavra ("it", "this") casaria com qualquer frase.
          const byDisplay = mention.display.includes(' ') && sentence.includes(mention.display)
          const cited = parts.length === 1 || sentence.includes(mention.title) || byDisplay
          if (cited) consider(mention.title, sentence, 'body')
        }
      }
    }
  }
  return [...found.values()]
}

interface Mention {
  readonly title: string
  readonly display: string
}

// Menções por link ([[X]], [[X|alias]], [[X/Spoiler#s|alias]]), por template
// {{Spoiler Section|X|...}} e por texto puro com o título exato.
function findMentions(line: string, canonical: (raw: string) => string | null): Mention[] {
  const mentions = new Map<string, Mention>()
  const add = (raw: string, display: string) => {
    const title = canonical(raw)
    if (title !== null && !mentions.has(title)) mentions.set(title, { title, display })
  }
  for (const match of line.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g)) {
    const target = (match[1] ?? '').split('/')[0] ?? ''
    add(target, match[2] ?? target)
  }
  for (const match of line.matchAll(/\{\{Spoiler Section\|([^}|]*)/gi)) add(match[1] ?? '', match[1] ?? '')
  const plain = stripMarkup(line)
  for (const [raw] of [...plain.matchAll(/[A-Z][^.;]*?Quest\b/g)]) {
    // O texto puro pode conter o título inteiro em qualquer posição: do
    // sufixo mais longo ao mais curto, e só o primeiro que casa vale, senão
    // "Hero of Rathleton Quest" também contaria como "Rathleton Quest".
    for (const candidate of titlesWithin(plain, raw)) {
      if (canonical(candidate) === null) continue
      add(candidate, candidate)
      break
    }
  }
  return [...mentions.values()]
}

// Sufixos do trecho terminado em "Quest", do mais longo ao mais curto.
function* titlesWithin(text: string, fragment: string): Generator<string> {
  const end = text.indexOf(fragment) + fragment.length
  const words = text.slice(0, end).split(' ')
  for (let start = Math.max(0, words.length - 8); start < words.length; start++) {
    yield words.slice(start).join(' ')
  }
}

function normalizeTitle(raw: string): string {
  const trimmed = raw.replace(/_/g, ' ').trim()
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

interface Section {
  readonly title: string
  readonly lines: string[]
}

function splitSections(wikitext: string): Section[] {
  const heading = /^(={1,4})\s*(.+?)\s*\1\s*$/
  const sections: Section[] = [{ title: '', lines: [] }]
  for (const line of wikitext.split('\n')) {
    const match = heading.exec(line)
    if (match) sections.push({ title: match[2] ?? '', lines: [] })
    else sections[sections.length - 1]?.lines.push(line)
  }
  return sections
}
