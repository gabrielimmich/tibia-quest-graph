import { describe, expect, it } from 'vitest'
import { build } from 'vite'
import { questsModuleSource, questsPlugin } from '../src/vite-plugin-quests.ts'
import { useTempDir } from './helpers/temp-dir.ts'

const tmp = useTempDir('quests-plugin-')

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

const INVALID = 'quests: []\nedges: [{from: a, to: b}]'

describe('questsModuleSource', () => {
  it('emite export default com quests e arestas validadas', () => {
    const source = questsModuleSource(tmp.write('ok.yaml', VALID))
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
    expect(() => questsModuleSource(tmp.write('bad.yaml', INVALID))).toThrow(/id inexistente/)
  })
})

// Build real do Vite num diretório temporário: prova que resolveId/load
// entregam `virtual:quests` ao bundle e que YAML inválido quebra o build.
describe('questsPlugin', () => {
  async function bundle(yaml: string): Promise<string> {
    const file = tmp.write('quests.yaml', yaml)
    const entry = tmp.write('entry.ts', "import data from 'virtual:quests'\nexport default data\n")
    const result = await build({
      root: tmp.path(),
      configFile: false,
      logLevel: 'silent',
      plugins: [questsPlugin({ file })],
      build: { write: false, lib: { entry, formats: ['es'], fileName: 'out' } },
    })
    const outputs = Array.isArray(result) ? result : 'output' in result ? [result] : []
    return outputs
      .flatMap((output) => output.output)
      .map((chunk) => ('code' in chunk ? chunk.code : ''))
      .join('\n')
  }

  it('entrega o YAML validado como módulo virtual no bundle', async () => {
    const code = await bundle(VALID)
    expect(code).toContain('A Quest')
    expect(code).toContain('You must have completed A Quest.')
  })

  it('quebra o build quando o YAML é inválido', async () => {
    await expect(bundle(INVALID)).rejects.toThrow(/id inexistente/)
  })
})
