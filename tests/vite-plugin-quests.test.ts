import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { questsModuleSource, questsPlugin } from '../src/vite-plugin-quests.ts'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'quests-plugin-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function write(name: string, content: string): string {
  const file = join(dir, name)
  writeFileSync(file, content, 'utf8')
  return file
}

const VALID = [
  'quests:',
  '  - id: a',
  '    title: A Quest',
  '    premium: false',
  '    wiki: https://tibia.fandom.com/wiki/A_Quest',
  '    unlocks: nada',
  '  - id: b',
  '    title: B Quest',
  '    level: 20',
  '    premium: true',
  '    wiki: https://tibia.fandom.com/wiki/B_Quest',
  '    unlocks: nada',
  'edges:',
  '  - from: a',
  '    to: b',
  '    kind: required',
  '    evidence: "You must have completed A Quest."',
  '    source: https://tibia.fandom.com/wiki/B_Quest',
].join('\n')

describe('questsModuleSource', () => {
  it('emite export default com quests e arestas validadas', () => {
    const source = questsModuleSource(write('ok.yaml', VALID))
    expect(source.startsWith('export default ')).toBe(true)
    const data: unknown = JSON.parse(source.slice('export default '.length))
    expect(data).toEqual({
      quests: [
        { id: 'a', title: 'A Quest', premium: false, wiki: 'https://tibia.fandom.com/wiki/A_Quest', unlocks: 'nada' },
        { id: 'b', title: 'B Quest', premium: true, wiki: 'https://tibia.fandom.com/wiki/B_Quest', unlocks: 'nada', level: 20 },
      ],
      edges: [
        {
          from: 'a',
          to: 'b',
          kind: 'required',
          evidence: 'You must have completed A Quest.',
          source: 'https://tibia.fandom.com/wiki/B_Quest',
        },
      ],
    })
  })

  it('lança com a lista de erros quando o YAML é inválido', () => {
    const file = write('bad.yaml', 'quests: []\nedges: [{from: a, to: b}]')
    expect(() => questsModuleSource(file)).toThrow(/id inexistente/)
  })
})

describe('questsPlugin', () => {
  it('tem nome e recebe o caminho do arquivo', () => {
    const plugin = questsPlugin({ file: 'data/quests.yaml' })
    expect(plugin.name).toBe('tibia-quest-graph:quests')
    expect(typeof plugin.resolveId).toBe('function')
    expect(typeof plugin.load).toBe('function')
  })
})
