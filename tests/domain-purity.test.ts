import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// CLAUDE.md, seção 6: src/domain/ é puro. O tsconfig não consegue impor
// isso (lib DOM vale para tudo), então o guarda é este teste.
const DOMAIN_DIR = join(import.meta.dirname, '..', 'src', 'domain')
const FORBIDDEN = [/from ['"]node:/, /from ['"]vite['"]/, /from ['"]yaml['"]/, /\bfetch\(/, /Date\.now\(/, /\bimport\(/]

describe('src/domain é puro', () => {
  const files = readdirSync(DOMAIN_DIR).filter((name) => name.endsWith('.ts'))

  it('tem arquivos para checar', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(files)('%s não faz I/O nem importa infraestrutura', (name) => {
    const source = readFileSync(join(DOMAIN_DIR, name), 'utf8')
    for (const pattern of FORBIDDEN) expect(source).not.toMatch(pattern)
  })
})
