import { questId, type Edge, type EdgeKind, type Quest } from '../../src/domain/quest.ts'

export const id = questId

export function quest(rawId: string): Quest {
  return {
    id: questId(rawId),
    title: rawId,
    premium: false,
    wiki: `https://tibia.fandom.com/wiki/${rawId}`,
    unlocks: 'nada',
  }
}

export function edge(from: string, to: string, kind: EdgeKind = 'required'): Edge {
  return {
    from: questId(from),
    to: questId(to),
    kind,
    evidence: `${to} requires ${from}`,
    source: `https://tibia.fandom.com/wiki/${to}`,
  }
}
