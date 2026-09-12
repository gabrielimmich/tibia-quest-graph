import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { parseQuestData, type ParseResult } from './domain/parse.ts'

// Único ponto de contato com o disco: script de validação e plugin Vite
// passam por aqui para nunca divergirem sobre o que é um YAML válido.
export function readQuestFile(file: string): ParseResult {
  let text: string
  try {
    text = readFileSync(file, 'utf8')
  } catch (error) {
    return { ok: false, errors: [`não foi possível ler ${file}: ${describe(error)}`] }
  }

  let raw: unknown
  try {
    raw = parse(text)
  } catch (error) {
    return { ok: false, errors: [`YAML inválido: ${describe(error)}`] }
  }

  return parseQuestData(raw)
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
