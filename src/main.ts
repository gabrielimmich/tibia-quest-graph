import data from 'virtual:quests'
import { buildQuestGraph } from './domain/index.ts'

// Entrada mínima da fundação. A sessão de interface substitui isto pelo
// Cytoscape; o que importa aqui é provar que virtual:quests chega tipado.
const graph = buildQuestGraph(data.quests, data.edges)

const app = document.querySelector('#app')
if (app) {
  app.textContent = `${graph.quests.size} quests, ${graph.edges.length} arestas carregadas de data/quests.yaml.`
}
