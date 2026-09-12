import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readQuestFile } from '../src/quest-file.ts'
import { useTempDir } from './helpers/temp-dir.ts'

const tmp = useTempDir('quest-file-')

describe('readQuestFile', () => {
  it('lê YAML válido e devolve o grafo', () => {
    const file = tmp.write(
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

  it('distingue arquivo inexistente de YAML inválido', () => {
    const result = readQuestFile(join(tmp.path(), 'nope.yaml'))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors[0]).toContain('não foi possível ler')
    expect(result.errors[0]).not.toContain('YAML inválido')
  })

  it('devolve erro legível quando o YAML nem parseia', () => {
    const file = tmp.write('broken.yaml', 'quests: [\nedges: }')
    const result = readQuestFile(file)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors[0]).toContain('YAML inválido')
  })

  it('repassa erros de validação', () => {
    const file = tmp.write('invalid.yaml', 'quests: []\nedges: [{from: a, to: b}]')
    const result = readQuestFile(file)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.join('\n')).toContain('id inexistente')
  })
})
