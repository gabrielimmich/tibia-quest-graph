import { searchQuests, type QuestGraph, type QuestId } from '../domain/index.ts'

export interface SearchElements {
  readonly input: HTMLInputElement
  readonly results: HTMLElement
}

export function createSearch({ input, results }: SearchElements, graph: QuestGraph, onPick: (id: QuestId) => void): void {
  const close = () => {
    results.replaceChildren()
    results.hidden = true
    input.setAttribute('aria-expanded', 'false')
  }

  const pick = (id: QuestId) => {
    onPick(id)
    input.value = ''
    close()
    input.blur()
  }

  const render = () => {
    const hits = searchQuests(graph, input.value)
    results.replaceChildren()
    for (const quest of hits) {
      const button = document.createElement('button')
      button.type = 'button'
      button.setAttribute('role', 'option')
      button.textContent = quest.title
      button.addEventListener('click', () => pick(quest.id))
      const item = document.createElement('li')
      item.append(button)
      results.append(item)
    }
    results.hidden = hits.length === 0
    input.setAttribute('aria-expanded', String(hits.length > 0))
  }

  input.addEventListener('input', render)
  input.addEventListener('focus', render)
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close()
    if (event.key === 'Enter') {
      event.preventDefault()
      const first = searchQuests(graph, input.value)[0]
      if (first) pick(first.id)
    }
  })
  input.form?.addEventListener('submit', (event) => event.preventDefault())
  document.addEventListener('click', (event) => {
    const target = event.target
    if (target instanceof Node && !input.contains(target) && !results.contains(target)) close()
  })
  close()
}
