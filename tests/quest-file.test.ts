import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readQuestFile } from '../src/quest-file.ts'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'quest-file-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function write(name: string, content: string): string {
  const file = join(dir, name)
  writeFileSync(file, content, 'utf8')
  return file
}

describe('readQuestFile', () => {
  it('lê YAML válido e devolve o grafo', () => {
    const file = write(
      'ok.yaml',
      [
        'quests:',
        '  - id: a',
        '    title: A Quest',
        '    premium: false',
        '    wiki: https://tibia.fandom.com/wiki/A_Quest',
        '    unlocks: nada',
        'edges: []',
      ].join('\n'),
    )
    const result = readQuestFile(file)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.graph.quests.size).toBe(1)
  })

  it('devolve erro legível quando o YAML nem parseia', () => {
    const file = write('broken.yaml', 'quests: [\nedges: }')
    const result = readQuestFile(file)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors[0]).toContain('YAML inválido')
  })

  it('repassa erros de validação', () => {
    const file = write('invalid.yaml', 'quests: []\nedges: [{from: a, to: b}]')
    const result = readQuestFile(file)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.join('\n')).toContain('id inexistente')
  })
})
