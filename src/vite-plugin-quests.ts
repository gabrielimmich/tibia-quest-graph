import type { Plugin } from 'vite'
import { readQuestFile } from './quest-file.ts'

const MODULE_ID = 'virtual:quests'
// Prefixo \0 é a convenção do Rollup/Vite para módulos virtuais: impede que
// outros plugins tentem tratar o id como caminho de arquivo.
const RESOLVED_ID = '\0virtual:quests'

export interface QuestsPluginOptions {
  readonly file: string
}

export function questsPlugin({ file }: QuestsPluginOptions): Plugin {
  return {
    name: 'tibia-quest-graph:quests',
    resolveId(id) {
      return id === MODULE_ID ? RESOLVED_ID : null
    },
    load(id) {
      if (id !== RESOLVED_ID) return null
      this.addWatchFile(file)
      return questsModuleSource(file)
    },
  }
}

// Serializa o grafo validado como arrays: Map não sobrevive a JSON, e o
// main.ts remonta o grafo com buildQuestGraph.
export function questsModuleSource(file: string): string {
  const result = readQuestFile(file)
  if (!result.ok) {
    throw new Error(`${file} inválido:\n${result.errors.map((error) => `  - ${error}`).join('\n')}`)
  }
  const data = { quests: [...result.graph.quests.values()], edges: result.graph.edges }
  return `export default ${JSON.stringify(data)}`
}
