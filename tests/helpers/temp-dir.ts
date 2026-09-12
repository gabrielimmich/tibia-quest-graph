import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach } from 'vitest'

export interface TempDir {
  readonly path: () => string
  readonly write: (name: string, content: string) => string
}

// Diretório temporário por teste, para exercitar leitura de arquivo real
// sem tocar em data/quests.yaml.
export function useTempDir(prefix: string): TempDir {
  let dir = ''
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), prefix))
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })
  return {
    path: () => dir,
    write: (name, content) => {
      const file = join(dir, name)
      writeFileSync(file, content, 'utf8')
      return file
    },
  }
}
