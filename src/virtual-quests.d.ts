declare module 'virtual:quests' {
  import type { Edge, Quest } from './domain/quest.ts'

  const data: {
    readonly quests: readonly Quest[]
    readonly edges: readonly Edge[]
  }
  export default data
}
