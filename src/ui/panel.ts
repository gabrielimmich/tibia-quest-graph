import { findLineage, type Edge, type EdgeKind, type Quest, type QuestGraph, type QuestId } from '../domain/index.ts'

export type NavigateHandler = (id: QuestId) => void

export interface PanelActions {
  readonly onNavigate: NavigateHandler
  // Presente quando faz sentido re-enraizar a árvore na quest mostrada.
  readonly onShowTree?: NavigateHandler
}

const KIND_LABEL: Record<EdgeKind, string> = {
  required: 'obrigatória',
  access: 'acesso',
  recommended: 'recomendada',
}

export function renderPanel(root: HTMLElement, graph: QuestGraph, selected: QuestId | null, actions: PanelActions): void {
  root.replaceChildren()
  const quest = selected === null ? undefined : graph.quests.get(selected)
  if (!quest) {
    root.append(renderEmpty(graph))
    return
  }
  const lineage = findLineage(graph, quest.id)
  root.append(
    renderHeader(quest, actions.onShowTree),
    renderRelations('Precisa antes', graph.incoming.get(quest.id) ?? [], (edge) => edge.from, lineage.ancestors, graph, actions.onNavigate),
    renderRelations('Libera depois', graph.outgoing.get(quest.id) ?? [], (edge) => edge.to, lineage.descendants, graph, actions.onNavigate),
  )
}

function renderEmpty(graph: QuestGraph): HTMLElement {
  const section = el('section', 'panel-empty')
  section.append(
    el('h2', undefined, 'Escolha uma quest'),
    el(
      'p',
      undefined,
      'Clique num nó para ver os detalhes: tudo que precisa ser feito antes, tudo que libera depois, e a frase da TibiaWiki que comprova cada ligação.',
    ),
    el('p', 'panel-stats', `${graph.quests.size} quests · ${graph.edges.length} ligações`),
  )
  return section
}

function renderHeader(quest: Quest, onShowTree?: NavigateHandler): HTMLElement {
  const header = el('header', 'panel-header')
  const meta: string[] = []
  if (quest.level !== undefined) meta.push(`Level ${quest.level}`)
  meta.push(quest.premium ? 'Premium' : 'Free account')
  header.append(el('h2', undefined, quest.title), el('p', 'panel-meta', meta.join(' · ')))
  const place = dedupe([quest.region, quest.location].filter((part): part is string => part !== undefined))
  if (place.length > 0) header.append(el('p', 'panel-place', place.join(' · ')))
  header.append(externalLink(quest.wiki, 'Ver na TibiaWiki ↗'))
  // unlocks é a descrição em português escrita à mão; reward é o texto literal
  // da wiki e serve de fallback para as quests coletadas.
  if (quest.unlocks !== undefined) header.append(labelled('panel-unlocks', 'Libera: ', quest.unlocks))
  else if (quest.reward !== undefined) header.append(labelled('panel-unlocks', 'Recompensa: ', quest.reward))
  if (onShowTree) {
    const button = el('button', 'panel-action', 'Ver árvore desta quest')
    button.type = 'button'
    button.addEventListener('click', () => onShowTree(quest.id))
    header.append(button)
  }
  return header
}

function renderRelations(
  title: string,
  direct: readonly Edge[],
  otherEnd: (edge: Edge) => QuestId,
  all: ReadonlySet<QuestId>,
  graph: QuestGraph,
  onNavigate: NavigateHandler,
): HTMLElement {
  const section = el('section', 'panel-relations')
  section.append(el('h3', undefined, `${title} (${all.size})`))
  if (all.size === 0) {
    section.append(el('p', 'panel-none', 'Nenhuma das quests mapeadas.'))
    return section
  }

  const list = el('ul', 'panel-direct')
  for (const edge of direct) list.append(renderEdge(edge, otherEnd(edge), graph, onNavigate))
  section.append(list)

  const titleOf = (id: QuestId) => graph.quests.get(id)?.title ?? id
  const indirect = [...all]
    .filter((id) => !direct.some((edge) => otherEnd(edge) === id))
    .sort((a, b) => titleOf(a).localeCompare(titleOf(b)))
  if (indirect.length > 0) {
    const paragraph = el('p', 'panel-indirect')
    paragraph.append(el('span', undefined, 'Indiretas: '))
    indirect.forEach((id, index) => {
      if (index > 0) paragraph.append(document.createTextNode(', '))
      paragraph.append(questButton(graph, id, onNavigate))
    })
    section.append(paragraph)
  }
  return section
}

function renderEdge(edge: Edge, otherId: QuestId, graph: QuestGraph, onNavigate: NavigateHandler): HTMLElement {
  const item = el('li', `panel-edge kind-${edge.kind}`)
  const head = el('div', 'panel-edge-head')
  const badges = el('span', 'panel-badges')
  badges.append(el('span', 'kind-badge', KIND_LABEL[edge.kind]))
  // reviewed ausente = aprovada; false = veio do coletor e ainda não foi conferida.
  if (edge.reviewed === false) badges.append(el('span', 'kind-badge badge-unreviewed', 'não revisada'))
  head.append(questButton(graph, otherId, onNavigate), badges)
  const source = el('p', 'panel-source')
  source.append(externalLink(edge.source, 'TibiaWiki ↗'))
  item.append(head, el('blockquote', 'panel-evidence', `“${edge.evidence}”`), source)
  return item
}

function labelled(className: string, label: string, text: string): HTMLElement {
  const paragraph = el('p', className)
  paragraph.append(el('strong', undefined, label), document.createTextNode(text))
  return paragraph
}

function dedupe(parts: readonly string[]): string[] {
  return parts.filter((part, index) => parts.indexOf(part) === index)
}

function questButton(graph: QuestGraph, id: QuestId, onNavigate: NavigateHandler): HTMLButtonElement {
  const button = el('button', 'quest-link', graph.quests.get(id)?.title ?? id)
  button.type = 'button'
  button.addEventListener('click', () => onNavigate(id))
  return button
}

// href só recebe quest.wiki e edge.source, que parseQuestData garante
// começarem com https://tibia.fandom.com/wiki/.
function externalLink(href: string, text: string): HTMLAnchorElement {
  const anchor = el('a', undefined, text)
  anchor.href = href
  anchor.target = '_blank'
  anchor.rel = 'noopener noreferrer'
  return anchor
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className !== undefined) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}
