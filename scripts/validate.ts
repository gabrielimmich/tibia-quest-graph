import { readQuestFile } from '../src/quest-file.ts'

const FILE = 'data/quests.yaml'
const result = readQuestFile(FILE)

if (result.ok) {
  console.log(`${FILE}: ${result.graph.quests.size} quests, ${result.graph.edges.length} arestas. OK.`)
} else {
  console.error(`${FILE}: ${result.errors.length} erro(s)`)
  for (const error of result.errors) console.error(`  - ${error}`)
  process.exit(1)
}
