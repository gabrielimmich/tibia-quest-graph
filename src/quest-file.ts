import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { parseQuestData, type ParseResult } from './domain/parse.ts'

// Único ponto de contato com o disco: script de validação e plugin Vite
// passam por aqui para nunca divergirem sobre o que é um YAML válido.
export function readQuestFile(file: string): ParseResult {
  let raw: unknown
  try {
    raw = parse(readFileSync(file, 'utf8'))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, errors: [`YAML inválido: ${message}`] }
  }
  return parseQuestData(raw)
}
