import { fileURLToPath } from 'node:url'
import { readQuestFile } from '../src/quest-file.ts'

// Resolvido a partir deste arquivo, não do cwd, para funcionar de qualquer
// diretório (CI, hooks, `node scripts/validate.ts` à mão).
const FILE = fileURLToPath(new URL('../data/quests.yaml', import.meta.url))
const LABEL = 'data/quests.yaml'
const result = readQuestFile(FILE)

if (result.ok) {
  console.log(`${LABEL}: ${result.graph.quests.size} quests, ${result.graph.edges.length} arestas. OK.`)
} else {
  console.error(`${LABEL}: ${result.errors.length} erro(s)`)
  for (const error of result.errors) console.error(`  - ${error}`)
  process.exit(1)
}
