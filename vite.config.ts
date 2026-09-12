import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { questsPlugin } from './src/vite-plugin-quests.ts'

export default defineConfig({
  plugins: [questsPlugin({ file: fileURLToPath(new URL('./data/quests.yaml', import.meta.url)) })],
})
