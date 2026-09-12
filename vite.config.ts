import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { questsPlugin } from './src/vite-plugin-quests.ts'

export default defineConfig({
  // Mesmo caminho em dev, preview e GitHub Pages (https://<user>.github.io/tibia-quest-graph/).
  base: '/tibia-quest-graph/',
  plugins: [questsPlugin({ file: fileURLToPath(new URL('./data/quests.yaml', import.meta.url)) })],
})
