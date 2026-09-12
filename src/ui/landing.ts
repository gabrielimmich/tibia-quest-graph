import type { Quest, QuestId } from '../domain/index.ts'

export function renderSuggestions(list: HTMLElement, quests: readonly Quest[], onPick: (id: QuestId) => void): void {
  list.replaceChildren()
  for (const quest of quests) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'chip'
    button.textContent = quest.title
    button.addEventListener('click', () => onPick(quest.id))
    const item = document.createElement('li')
    item.append(button)
    list.append(item)
  }
}
