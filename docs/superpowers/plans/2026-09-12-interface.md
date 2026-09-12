# Interface (grafo, painel, busca, deploy) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Site publicado em `https://gabrielimmich.github.io/tibia-quest-graph/` com grafo Cytoscape/dagre, destaque de ancestrais/descendentes ao clicar, painel com evidência e link por aresta, busca por nome, utilizável em celular.

**Architecture:** `domain/` ganha `findLineage` e `searchQuests` (puros, TDD). `graph/` converte o `QuestGraph` em elementos, define o stylesheet e encapsula o Cytoscape em `createQuestGraphView` (`select`/`clear`/`onSelect`). `ui/` renderiza painel e busca com DOM API e `textContent`. `main.ts` liga tudo e espelha a seleção no hash. Spec: `docs/superpowers/specs/2026-09-12-interface-design.md`.

**Tech Stack:** cytoscape 3.34.3, cytoscape-dagre 4.0.1 (ambos com tipos próprios; dagre vem embutido), Vite 8, GitHub Pages via Actions.

## Global Constraints

- Zero `any`, zero `@ts-ignore`, zero `as unknown as`. Eventos do Cytoscape tipados com `EventObjectNode`/`EventObject`.
- `src/domain/` continua puro (o teste-guarda `tests/domain-purity.test.ts` já cobre).
- Texto de wiki e títulos entram só por `textContent`; `href` só recebe `quest.wiki` e `edge.source`.
- Imports locais com `.ts`; sem `enum`; comentários explicam *por quê*.
- Sem `wheelSensitivity` (Cytoscape avisa que quebra em mouses comuns).
- Classes do Cytoscape: `focus`, `ancestor`, `descendant`, `path`, `dimmed` (não usar `selected`, que colide com o estado nativo `:selected`; a seleção nativa fica desligada com `autounselectify: true`).
- Commits terminam com `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- Trabalhar na branch `feat/interface`; fast-forward em `main` no fim.

---

### Task 1: Domínio — `findLineage` e `searchQuests`

**Files:**
- Create: `src/domain/lineage.ts`, `src/domain/search.ts`, `tests/domain/lineage.test.ts`, `tests/domain/search.test.ts`
- Modify: `src/domain/index.ts`

**Interfaces:**
- Consumes: `QuestGraph`, `QuestId`, `Edge`, `Quest`, `findAllPrerequisites`, `findAllUnlocked`
- Produces: `findLineage(graph, id): Lineage { ancestors, descendants, edges }`, `searchQuests(graph, query, limit = 8): readonly Quest[]`, `normalizeText(text): string`

- [x] **Step 1: Teste que falha — `tests/domain/lineage.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { findLineage } from '../../src/domain/lineage.ts'
import { buildQuestGraph } from '../../src/domain/quest.ts'
import { edge, id, quest } from './fixtures.ts'

// a→b, a→c (recommended), b→d (access), c→d, d→e; x isolada.
const ab = edge('a', 'b')
const ac = edge('a', 'c', 'recommended')
const bd = edge('b', 'd', 'access')
const cd = edge('c', 'd')
const de = edge('d', 'e')
const graph = buildQuestGraph(
  [quest('a'), quest('b'), quest('c'), quest('d'), quest('e'), quest('x')],
  [ab, ac, bd, cd, de],
)

describe('findLineage', () => {
  it('reúne ancestrais, descendentes e as arestas desses caminhos', () => {
    const lineage = findLineage(graph, id('d'))
    expect([...lineage.ancestors].sort()).toEqual(['a', 'b', 'c'])
    expect([...lineage.descendants]).toEqual(['e'])
    expect(lineage.edges).toEqual([ab, ac, bd, cd, de])
  })

  it('exclui arestas de ramos que não passam pela quest', () => {
    // c→d chega num descendente de b, mas c não tem relação com b.
    const lineage = findLineage(graph, id('b'))
    expect(lineage.edges).toEqual([ab, bd, de])
  })

  it('quest isolada e id inexistente devolvem tudo vazio', () => {
    for (const target of [id('x'), id('zzz')]) {
      const lineage = findLineage(graph, target)
      expect(lineage.ancestors.size).toBe(0)
      expect(lineage.descendants.size).toBe(0)
      expect(lineage.edges).toEqual([])
    }
  })

  it('não trava num ciclo', () => {
    const cyclic = buildQuestGraph([quest('a'), quest('b')], [edge('a', 'b'), edge('b', 'a')])
    const lineage = findLineage(cyclic, id('a'))
    expect([...lineage.ancestors]).toEqual(['b'])
    expect(lineage.edges).toHaveLength(2)
  })
})
```

- [x] **Step 2: Teste que falha — `tests/domain/search.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { buildQuestGraph } from '../../src/domain/quest.ts'
import { normalizeText, searchQuests } from '../../src/domain/search.ts'
import { quest } from './fixtures.ts'

const titled = (rawId: string, title: string) => ({ ...quest(rawId), title })
const graph = buildQuestGraph(
  [
    titled('soul-war', 'Soul War Quest'),
    titled('feaster-of-souls', 'Feaster of Souls Quest'),
    titled('ferumbras-ascension', "Ferumbras' Ascension Quest"),
    titled('the-ice-islands', 'The Ice Islands Quest'),
  ],
  [],
)
const titles = (query: string, limit?: number) => searchQuests(graph, query, limit).map((quest) => quest.title)

describe('normalizeText', () => {
  it('remove acento e caixa', () => {
    expect(normalizeText('Ferúmbras ÇÃO')).toBe('ferumbras cao')
  })
})

describe('searchQuests', () => {
  it('ignora caixa e acento na busca', () => {
    expect(titles('FERÚMBRAS')).toEqual(["Ferumbras' Ascension Quest"])
  })

  it('match no início do título vem antes', () => {
    expect(titles('soul')).toEqual(['Soul War Quest', 'Feaster of Souls Quest'])
  })

  it('query vazia ou só espaço devolve nada', () => {
    expect(titles('')).toEqual([])
    expect(titles('   ')).toEqual([])
  })

  it('respeita o limite', () => {
    expect(titles('quest', 2)).toHaveLength(2)
    expect(titles('quest')).toHaveLength(4)
  })
})
```

- [x] **Step 3: Rodar e ver falhar**

Run: `npx vitest run tests/domain/lineage.test.ts tests/domain/search.test.ts`
Expected: FAIL — `Cannot find module '../../src/domain/lineage.ts'` e idem para `search.ts`.

- [x] **Step 4: Implementar `src/domain/lineage.ts`**

```ts
import type { Edge, QuestGraph, QuestId } from './quest.ts'
import { findAllPrerequisites, findAllUnlocked } from './traversal.ts'

export interface Lineage {
  readonly ancestors: ReadonlySet<QuestId>
  readonly descendants: ReadonlySet<QuestId>
  // Arestas que ligam a quest aos seus ancestrais/descendentes. Uma aresta
  // entre dois ancestrais está sempre num caminho até a quest (é um DAG),
  // então basta testar se os dois lados pertencem ao mesmo conjunto.
  readonly edges: readonly Edge[]
}

export function findLineage(graph: QuestGraph, id: QuestId): Lineage {
  const ancestors = findAllPrerequisites(graph, id)
  const descendants = findAllUnlocked(graph, id)
  const upstream = new Set<QuestId>([id, ...ancestors])
  const downstream = new Set<QuestId>([id, ...descendants])
  const edges = graph.edges.filter(
    (edge) =>
      (upstream.has(edge.from) && upstream.has(edge.to)) ||
      (downstream.has(edge.from) && downstream.has(edge.to)),
  )
  return { ancestors, descendants, edges }
}
```

- [x] **Step 5: Implementar `src/domain/search.ts`**

```ts
import type { Quest, QuestGraph } from './quest.ts'

export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export function searchQuests(graph: QuestGraph, query: string, limit = 8): readonly Quest[] {
  const needle = normalizeText(query.trim())
  if (needle === '') return []

  const hits: { quest: Quest; position: number }[] = []
  for (const quest of graph.quests.values()) {
    const position = normalizeText(quest.title).indexOf(needle)
    if (position >= 0) hits.push({ quest, position })
  }
  hits.sort((a, b) => a.position - b.position || a.quest.title.localeCompare(b.quest.title))
  return hits.slice(0, limit).map((hit) => hit.quest)
}
```

- [x] **Step 6: Exportar em `src/domain/index.ts`** (acrescentar ao fim)

```ts
export { findLineage, type Lineage } from './lineage.ts'
export { normalizeText, searchQuests } from './search.ts'
```

- [x] **Step 7: Rodar e ver passar**

Run: `npx vitest run && npx tsc --noEmit`
Expected: `Tests 58 passed` (49 + 4 + 5), tsc sem saída.

- [x] **Step 8: Commit**

```bash
git add src/domain/lineage.ts src/domain/search.ts src/domain/index.ts tests/domain/lineage.test.ts tests/domain/search.test.ts
git commit -m "feat(domain): findLineage e searchQuests"
```

---

### Task 2: Grafo — elementos e stylesheet do Cytoscape

**Files:**
- Create: `src/graph/elements.ts`, `src/graph/style.ts`, `tests/graph/elements.test.ts`
- Modify: `package.json` (deps)

**Interfaces:**
- Produces: `toElements(graph): ElementDefinition[]`, `nodeLabel(quest): string`, `edgeElementId(from, to): string`, `stylesheet: StylesheetJson`, `colors`

- [x] **Step 1: Instalar**

Run: `npm install cytoscape@3.34.3 cytoscape-dagre@4.0.1`
Expected: `dependencies` com os dois; nenhum `@types/*`.

- [x] **Step 2: Teste que falha — `tests/graph/elements.test.ts`**

```ts
import cytoscape from 'cytoscape'
import dagre, { type DagreLayoutOptions } from 'cytoscape-dagre'
import { describe, expect, it } from 'vitest'
import { buildQuestGraph } from '../../src/domain/quest.ts'
import { edgeElementId, nodeLabel, toElements } from '../../src/graph/elements.ts'
import { stylesheet } from '../../src/graph/style.ts'
import { edge, quest } from '../domain/fixtures.ts'

const graph = buildQuestGraph(
  [{ ...quest('a'), title: 'Alpha Quest' }, { ...quest('b'), title: 'Beta Quest' }, quest('c')],
  [edge('a', 'b'), edge('a', 'c', 'access')],
)

describe('toElements', () => {
  it('gera um nó por quest e uma aresta por dependência', () => {
    const elements = toElements(graph)
    expect(elements.filter((element) => element.group === 'nodes')).toHaveLength(3)
    expect(elements.filter((element) => element.group === 'edges')).toHaveLength(2)
  })

  it('rótulo é o título sem o sufixo Quest', () => {
    expect(nodeLabel({ ...quest('a'), title: 'Alpha Quest' })).toBe('Alpha')
    expect(nodeLabel({ ...quest('a'), title: 'Sem sufixo' })).toBe('Sem sufixo')
  })

  it('aresta carrega kind e id determinístico', () => {
    const elements = toElements(graph)
    const ab = elements.find((element) => element.data.id === edgeElementId('a', 'b'))
    expect(ab?.data).toMatchObject({ source: 'a', target: 'b', kind: 'required' })
  })
})

describe('stylesheet + dagre (headless)', () => {
  it('Cytoscape aceita os elementos, o stylesheet e o layout', () => {
    cytoscape.use(dagre)
    const cy = cytoscape({ headless: true, styleEnabled: true, elements: toElements(graph), style: stylesheet })
    const layout: DagreLayoutOptions = { name: 'dagre', rankDir: 'TB' }
    cy.layout(layout).run()
    expect(cy.nodes()).toHaveLength(3)
    expect(cy.getElementById(edgeElementId('a', 'c')).data('kind')).toBe('access')
    // b e c ficam abaixo de a no rankDir TB
    const y = (id: string) => cy.getElementById(id).position('y')
    expect(y('b')).toBeGreaterThan(y('a'))
    expect(y('c')).toBeGreaterThan(y('a'))
  })
})
```

- [x] **Step 3: Rodar e ver falhar**

Run: `npx vitest run tests/graph/elements.test.ts`
Expected: FAIL — `Cannot find module '../../src/graph/elements.ts'`.

- [x] **Step 4: Implementar `src/graph/elements.ts`**

```ts
import type { ElementDefinition } from 'cytoscape'
import type { Quest, QuestGraph } from '../domain/index.ts'

export function nodeLabel(quest: Quest): string {
  return quest.title.replace(/ Quest$/, '')
}

// Cytoscape exige id por aresta; from→to é único porque o validador recusa
// pares duplicados. Buscar sempre por getElementById, nunca por seletor #id,
// porque a seta não é caractere válido em seletor.
export function edgeElementId(from: string, to: string): string {
  return `${from}→${to}`
}

export function toElements(graph: QuestGraph): ElementDefinition[] {
  const nodes = [...graph.quests.values()].map(
    (quest): ElementDefinition => ({ group: 'nodes', data: { id: quest.id, label: nodeLabel(quest) } }),
  )
  const edges = graph.edges.map(
    (edge): ElementDefinition => ({
      group: 'edges',
      data: { id: edgeElementId(edge.from, edge.to), source: edge.from, target: edge.to, kind: edge.kind },
    }),
  )
  return [...nodes, ...edges]
}
```

- [x] **Step 5: Implementar `src/graph/style.ts`**

```ts
import type { StylesheetJson } from 'cytoscape'

export const colors = {
  node: '#3a3127',
  nodeBorder: '#8a6d3b',
  nodeText: '#f1e6c8',
  edge: '#6b5a42',
  focus: '#f5c542',
  focusText: '#1a1408',
  ancestor: '#5aa9e6',
  descendant: '#7ed37e',
} as const

export const stylesheet: StylesheetJson = [
  {
    selector: 'node',
    style: {
      shape: 'round-rectangle',
      width: 150,
      height: 44,
      'background-color': colors.node,
      'border-width': 2,
      'border-color': colors.nodeBorder,
      label: 'data(label)',
      color: colors.nodeText,
      'font-size': 12,
      'font-family': 'system-ui, sans-serif',
      'text-wrap': 'wrap',
      'text-max-width': '140px',
      'text-valign': 'center',
      'text-halign': 'center',
      'transition-property': 'opacity, border-color, background-color',
      'transition-duration': 150,
    },
  },
  {
    selector: 'edge',
    style: {
      width: 2,
      'line-color': colors.edge,
      'target-arrow-color': colors.edge,
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      'arrow-scale': 1.2,
      'transition-property': 'opacity, line-color, target-arrow-color',
      'transition-duration': 150,
    },
  },
  { selector: 'edge[kind = "access"]', style: { 'line-style': 'dashed', 'line-dash-pattern': [8, 4] } },
  { selector: 'edge[kind = "recommended"]', style: { 'line-style': 'dotted' } },
  {
    selector: 'node.focus',
    style: {
      'background-color': colors.focus,
      'border-color': colors.focus,
      color: colors.focusText,
      'font-weight': 'bold',
    },
  },
  { selector: 'node.ancestor', style: { 'border-color': colors.ancestor, 'border-width': 3 } },
  { selector: 'node.descendant', style: { 'border-color': colors.descendant, 'border-width': 3 } },
  { selector: 'edge.path', style: { width: 3, 'line-color': colors.focus, 'target-arrow-color': colors.focus } },
  { selector: '.dimmed', style: { opacity: 0.15 } },
]
```

- [x] **Step 6: Rodar e ver passar**

Run: `npx vitest run && npx tsc --noEmit`
Expected: `Tests 62 passed`, tsc sem saída.

- [x] **Step 7: Commit**

```bash
git add package.json package-lock.json src/graph/elements.ts src/graph/style.ts tests/graph/elements.test.ts
git commit -m "feat(graph): elementos e stylesheet do Cytoscape"
```

---

### Task 3: View do grafo, painel, busca, página

**Files:**
- Create: `src/graph/quest-graph-view.ts`, `src/ui/panel.ts`, `src/ui/search.ts`, `src/styles.css`
- Modify: `src/main.ts`, `index.html`

**Interfaces:**
- Consumes: Task 1 e 2; `buildQuestGraph`, `questId`, `QuestGraph`, `QuestId`, `Edge`, `Quest`
- Produces: `createQuestGraphView(container, graph): QuestGraphView { select, clear, onSelect }`, `renderPanel(root, graph, selected, onNavigate)`, `createSearch({ input, results }, graph, onPick)`

- [x] **Step 1: `src/graph/quest-graph-view.ts`**

```ts
import cytoscape, { type EventObject, type EventObjectNode } from 'cytoscape'
import dagre, { type DagreLayoutOptions } from 'cytoscape-dagre'
import { findLineage, questId, type QuestGraph, type QuestId } from '../domain/index.ts'
import { edgeElementId, toElements } from './elements.ts'
import { stylesheet } from './style.ts'

cytoscape.use(dagre)

export type SelectionListener = (id: QuestId | null) => void

export interface QuestGraphView {
  readonly select: (id: QuestId) => void
  readonly clear: () => void
  readonly onSelect: (listener: SelectionListener) => void
}

const LINEAGE_CLASSES = 'focus ancestor descendant path dimmed'

const layout: DagreLayoutOptions = { name: 'dagre', rankDir: 'TB', nodeSep: 30, rankSep: 70, padding: 24 }

export function createQuestGraphView(container: HTMLElement, graph: QuestGraph): QuestGraphView {
  const cy = cytoscape({
    container,
    elements: toElements(graph),
    style: stylesheet,
    layout,
    // A seleção é nossa (classes por linhagem); a nativa só atrapalharia.
    autounselectify: true,
    minZoom: 0.3,
    maxZoom: 2.5,
  })

  const listeners: SelectionListener[] = []
  const notify = (id: QuestId | null) => {
    for (const listener of listeners) listener(id)
  }

  const clear = () => {
    cy.elements().removeClass(LINEAGE_CLASSES)
    notify(null)
  }

  const select = (id: QuestId) => {
    const node = cy.getElementById(id)
    if (node.empty()) return
    const lineage = findLineage(graph, id)
    cy.batch(() => {
      cy.elements().removeClass(LINEAGE_CLASSES).addClass('dimmed')
      node.removeClass('dimmed').addClass('focus')
      for (const ancestor of lineage.ancestors) cy.getElementById(ancestor).removeClass('dimmed').addClass('ancestor')
      for (const descendant of lineage.descendants) {
        cy.getElementById(descendant).removeClass('dimmed').addClass('descendant')
      }
      for (const edge of lineage.edges) {
        cy.getElementById(edgeElementId(edge.from, edge.to)).removeClass('dimmed').addClass('path')
      }
    })
    cy.animate({ center: { eles: node } }, { duration: 250 })
    notify(id)
  }

  cy.on('tap', 'node', (event: EventObjectNode) => select(questId(event.target.id())))
  cy.on('tap', (event: EventObject) => {
    if (event.target === cy) clear()
  })

  return { select, clear, onSelect: (listener) => listeners.push(listener) }
}
```

- [x] **Step 2: `src/ui/panel.ts`**

```ts
import { findLineage, type Edge, type EdgeKind, type Quest, type QuestGraph, type QuestId } from '../domain/index.ts'

export type NavigateHandler = (id: QuestId) => void

const KIND_LABEL: Record<EdgeKind, string> = {
  required: 'obrigatória',
  access: 'acesso',
  recommended: 'recomendada',
}

export function renderPanel(root: HTMLElement, graph: QuestGraph, selected: QuestId | null, onNavigate: NavigateHandler): void {
  root.replaceChildren()
  const quest = selected === null ? undefined : graph.quests.get(selected)
  if (!quest) {
    root.append(renderEmpty(graph))
    return
  }
  const lineage = findLineage(graph, quest.id)
  root.append(
    renderHeader(quest),
    renderRelations('Precisa antes', graph.incoming.get(quest.id) ?? [], (edge) => edge.from, lineage.ancestors, graph, onNavigate),
    renderRelations('Libera depois', graph.outgoing.get(quest.id) ?? [], (edge) => edge.to, lineage.descendants, graph, onNavigate),
  )
}

function renderEmpty(graph: QuestGraph): HTMLElement {
  const section = el('section', 'panel-empty')
  section.append(
    el('h2', undefined, 'Escolha uma quest'),
    el(
      'p',
      undefined,
      'Clique num nó do grafo ou use a busca. Você verá tudo que precisa ser feito antes, tudo que ela libera depois, e a frase da TibiaWiki que comprova cada ligação.',
    ),
    el('p', 'panel-stats', `${graph.quests.size} quests · ${graph.edges.length} ligações`),
  )
  return section
}

function renderHeader(quest: Quest): HTMLElement {
  const header = el('header', 'panel-header')
  const meta: string[] = []
  if (quest.level !== undefined) meta.push(`Level ${quest.level}`)
  meta.push(quest.premium ? 'Premium' : 'Free account')
  const unlocks = el('p', 'panel-unlocks')
  unlocks.append(el('strong', undefined, 'Libera: '), document.createTextNode(quest.unlocks))
  header.append(
    el('h2', undefined, quest.title),
    el('p', 'panel-meta', meta.join(' · ')),
    externalLink(quest.wiki, 'Ver na TibiaWiki ↗'),
    unlocks,
  )
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

  const indirect = [...all].filter((id) => !direct.some((edge) => otherEnd(edge) === id))
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
  head.append(questButton(graph, otherId, onNavigate), el('span', 'kind-badge', KIND_LABEL[edge.kind]))
  const source = el('p', 'panel-source')
  source.append(externalLink(edge.source, 'TibiaWiki ↗'))
  item.append(head, el('blockquote', 'panel-evidence', `“${edge.evidence}”`), source)
  return item
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
```

- [x] **Step 3: `src/ui/search.ts`**

```ts
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
```

- [x] **Step 4: `src/main.ts`** (substituir o conteúdo)

```ts
import data from 'virtual:quests'
import { buildQuestGraph, questId } from './domain/index.ts'
import { createQuestGraphView } from './graph/quest-graph-view.ts'
import { renderPanel } from './ui/panel.ts'
import { createSearch } from './ui/search.ts'

const graph = buildQuestGraph(data.quests, data.edges)

const graphElement = mustFind('#graph')
const panel = mustFind('#panel')
const panelClose = mustFind('#panel-close')
const searchInput = mustFindInput('#search')
const searchResults = mustFind('#search-results')

const view = createQuestGraphView(graphElement, graph)

view.onSelect((id) => {
  renderPanel(panel, graph, id, view.select)
  panel.classList.toggle('open', id !== null)
  // replaceState em vez de location.hash: não polui o histórico a cada clique.
  history.replaceState(null, '', id === null ? `${location.pathname}${location.search}` : `#${id}`)
})

createSearch({ input: searchInput, results: searchResults }, graph, view.select)
panelClose.addEventListener('click', view.clear)

renderPanel(panel, graph, null, view.select)
const initial = questId(decodeURIComponent(location.hash.slice(1)))
if (graph.quests.has(initial)) view.select(initial)

function mustFind(selector: string): HTMLElement {
  const element = document.querySelector(selector)
  if (!(element instanceof HTMLElement)) throw new Error(`index.html sem ${selector}`)
  return element
}

function mustFindInput(selector: string): HTMLInputElement {
  const element = document.querySelector(selector)
  if (!(element instanceof HTMLInputElement)) throw new Error(`index.html sem input ${selector}`)
  return element
}
```

- [x] **Step 5: `index.html`** (substituir)

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      name="description"
      content="Mapa navegável de dependências entre quests do Tibia, com a frase da TibiaWiki que comprova cada ligação."
    />
    <title>Tibia Quest Graph</title>
    <link rel="stylesheet" href="/src/styles.css" />
  </head>
  <body>
    <header class="topbar">
      <h1>Tibia Quest Graph</h1>
      <form class="search" role="search" autocomplete="off">
        <label class="visually-hidden" for="search">Buscar quest</label>
        <input
          id="search"
          type="search"
          placeholder="Buscar quest…"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded="false"
          aria-controls="search-results"
        />
        <ul id="search-results" class="search-results" role="listbox" hidden></ul>
      </form>
      <ul class="legend" aria-label="Tipos de ligação">
        <li class="legend-required">obrigatória</li>
        <li class="legend-access">acesso</li>
        <li class="legend-recommended">recomendada</li>
      </ul>
    </header>
    <main class="workspace">
      <div id="graph" class="graph" role="application" aria-label="Grafo de quests"></div>
      <aside id="panel" class="panel" aria-live="polite"></aside>
      <button id="panel-close" class="panel-close" type="button" aria-label="Fechar painel">×</button>
    </main>
    <footer class="footer">
      Fansite não oficial. Tibia é marca registrada da CipSoft GmbH. Dados e citações da
      <a href="https://tibia.fandom.com/" target="_blank" rel="noopener noreferrer">TibiaWiki</a>, sob
      <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener noreferrer">CC-BY-SA</a>.
    </footer>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [x] **Step 6: `src/styles.css`**

```css
:root {
  --bg: #141210;
  --bg-panel: #1c1916;
  --bg-top: #100e0c;
  --border: #2f2922;
  --text: #f1e6c8;
  --muted: #a8977a;
  --accent: #f5c542;
  --ancestor: #5aa9e6;
  --descendant: #7ed37e;
  --panel-w: 360px;
  --sheet-h: 45%;
  color-scheme: dark;
}

* {
  box-sizing: border-box;
}

html,
body {
  height: 100%;
  margin: 0;
}

body {
  display: flex;
  flex-direction: column;
  background: var(--bg);
  color: var(--text);
  font: 14px/1.45 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}

[hidden] {
  display: none !important;
}

a {
  color: var(--accent);
}

/* ---- topo ---- */
.topbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
  padding: 10px 16px;
  background: var(--bg-top);
  border-bottom: 1px solid var(--border);
}

.topbar h1 {
  margin: 0;
  font-size: 18px;
  white-space: nowrap;
}

.search {
  position: relative;
  flex: 1 1 220px;
  max-width: 420px;
  margin: 0;
}

.search input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-panel);
  color: var(--text);
  font: inherit;
}

.search-results {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 20;
  margin: 0;
  padding: 4px;
  list-style: none;
  max-height: 50vh;
  overflow: auto;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.search-results button {
  display: block;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.search-results button:hover,
.search-results button:focus {
  background: var(--border);
  outline: none;
}

.legend {
  display: flex;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--muted);
  font-size: 12px;
}

.legend li::before {
  content: '';
  display: inline-block;
  width: 22px;
  margin-right: 6px;
  vertical-align: middle;
  border-top: 2px solid var(--muted);
}

.legend-access::before {
  border-top-style: dashed;
}

.legend-recommended::before {
  border-top-style: dotted;
}

/* ---- área de trabalho ---- */
.workspace {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
}

/* Cytoscape mede o container; ele precisa de tamanho real, não auto. */
.graph {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
}

.panel {
  flex: 0 0 var(--panel-w);
  width: var(--panel-w);
  overflow: auto;
  padding: 16px;
  background: var(--bg-panel);
  border-left: 1px solid var(--border);
}

.panel-close {
  display: none;
}

/* ---- painel ---- */
.panel h2 {
  margin: 0 0 4px;
  font-size: 18px;
}

.panel h3 {
  margin: 20px 0 8px;
  font-size: 12px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
}

.panel-meta {
  margin: 0 0 6px;
  color: var(--muted);
}

.panel-unlocks {
  margin: 10px 0 0;
}

.panel-direct {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.panel-edge {
  padding: 10px 12px;
  border-left: 3px solid var(--muted);
  border-radius: 8px;
  background: var(--bg);
}

.panel-edge.kind-required {
  border-left-color: var(--accent);
}

.panel-edge.kind-access {
  border-left-color: var(--ancestor);
}

.panel-edge.kind-recommended {
  border-left-color: var(--descendant);
}

.panel-edge-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.kind-badge {
  padding: 1px 8px;
  border: 1px solid var(--border);
  border-radius: 999px;
  font-size: 11px;
  white-space: nowrap;
  color: var(--muted);
}

.panel-evidence {
  margin: 8px 0 4px;
  padding: 0;
  font-style: italic;
}

.panel-source {
  margin: 0;
  font-size: 12px;
}

.panel-indirect,
.panel-none,
.panel-stats {
  margin: 10px 0 0;
  color: var(--muted);
}

.quest-link {
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent);
  font: inherit;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}

.quest-link:hover {
  text-decoration: underline;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* ---- rodapé ---- */
.footer {
  padding: 6px 16px;
  font-size: 12px;
  line-height: 1.3;
  color: var(--muted);
  background: var(--bg-top);
  border-top: 1px solid var(--border);
}

/* ---- celular: painel vira folha inferior ---- */
@media (max-width: 767px) {
  .topbar {
    padding: 8px 12px;
    gap: 8px;
  }

  .topbar h1 {
    flex: 1 1 100%;
    font-size: 16px;
  }

  .search {
    flex: 1 1 100%;
    max-width: none;
  }

  .legend {
    flex: 1 1 100%;
    gap: 10px;
  }

  .workspace {
    flex-direction: column;
  }

  .panel {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    width: auto;
    height: var(--sheet-h);
    border-left: 0;
    border-top: 1px solid var(--border);
    transform: translateY(100%);
    transition: transform 0.2s;
  }

  .panel.open {
    transform: none;
  }

  .panel-close {
    position: absolute;
    right: 8px;
    bottom: calc(var(--sheet-h) + 8px);
    z-index: 5;
    width: 36px;
    height: 36px;
    border: 1px solid var(--border);
    border-radius: 50%;
    background: var(--bg-panel);
    color: var(--text);
    font-size: 20px;
  }

  .panel.open + .panel-close {
    display: block;
  }
}
```

- [x] **Step 7: Build, typecheck, dev server**

Run: `npm run typecheck && npm run build`
Expected: tsc silencioso; `dist/assets/*.js` inclui cytoscape (≈ 400 kB antes de gzip é normal) e `dist/assets/*.css`.

Run: `npx vite --port 5173 --strictPort` em background; `curl -s http://localhost:5173/tibia-quest-graph/` deve conter `id="graph"` e `id="panel"`; `curl -s http://localhost:5173/tibia-quest-graph/src/main.ts` deve conter `createQuestGraphView`. Encerrar.

- [x] **Step 8: Commit**

```bash
git add src/graph/quest-graph-view.ts src/ui/panel.ts src/ui/search.ts src/main.ts src/styles.css index.html
git commit -m "feat(ui): grafo interativo, painel com evidências, busca e layout responsivo"
```

> `vite.config.ts` com `base` entra na Task 4 junto com o deploy; até lá o dev server serve em `/`.

---

### Task 4: Deploy no GitHub Pages

**Files:**
- Create: `.github/workflows/deploy.yml`, `README.md`
- Modify: `vite.config.ts`

- [x] **Step 1: `vite.config.ts`** (substituir)

```ts
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { questsPlugin } from './src/vite-plugin-quests.ts'

export default defineConfig({
  // Mesmo caminho em dev, preview e GitHub Pages (https://<user>.github.io/tibia-quest-graph/).
  base: '/tibia-quest-graph/',
  plugins: [questsPlugin({ file: fileURLToPath(new URL('./data/quests.yaml', import.meta.url)) })],
})
```

- [x] **Step 2: Descobrir os majors atuais das actions**

Run: `for a in actions/checkout actions/setup-node actions/configure-pages actions/upload-pages-artifact actions/deploy-pages; do echo "$a $(gh api repos/$a/releases/latest --jq .tag_name)"; done`
Expected: uma tag por action. Usar o major de cada (`@v4`, `@v5`…) no workflow abaixo, substituindo os que estiverem diferentes.

- [x] **Step 3: `.github/workflows/deploy.yml`**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [x] **Step 4: `README.md`**

```markdown
# Tibia Quest Graph

Mapa navegável de dependências entre quests do Tibia. Clique numa quest e veja
o que precisa ser feito antes, o que ela libera depois, e a frase da TibiaWiki
que comprova cada ligação.

**Site:** https://gabrielimmich.github.io/tibia-quest-graph/

## Rodar localmente

```bash
npm ci
npm run dev        # http://localhost:5173/tibia-quest-graph/
npm test
npm run validate   # confere data/quests.yaml
npm run build
```

## Dados

`data/quests.yaml` é a única fonte. Cada aresta carrega `evidence`, copiada
literalmente da TibiaWiki, e `source`, a página de onde veio. Ver `CLAUDE.md`.

## Licença e atribuição

Fansite não oficial. Tibia é marca registrada da CipSoft GmbH. Dados e citações
da [TibiaWiki](https://tibia.fandom.com/), sob
[CC-BY-SA](https://creativecommons.org/licenses/by-sa/3.0/).
```

- [x] **Step 5: Build e commit**

Run: `npm run build && ls dist/assets`
Expected: verde; `dist/index.html` referencia `/tibia-quest-graph/assets/...`.

```bash
git add vite.config.ts .github/workflows/deploy.yml README.md
git commit -m "chore: base do GitHub Pages, workflow de deploy e README"
```

- [x] **Step 6: Fast-forward em `main` e criar o repositório**

```bash
git checkout main && git merge --ff-only feat/interface && git branch -d feat/interface
gh repo create gabrielimmich/tibia-quest-graph --public --description "Mapa navegável de dependências entre quests do Tibia, com evidência da TibiaWiki" --source=. --remote=origin --push
gh api -X POST repos/gabrielimmich/tibia-quest-graph/pages -f build_type=workflow
```
Expected: repo criado, `main` no remoto, Pages habilitado com fonte "GitHub Actions". Se o POST de Pages responder 409 (já existe), usar `-X PUT`.

- [x] **Step 7: Acompanhar o deploy e conferir**

Run: `gh run list --limit 1` e depois `gh run watch <id> --exit-status`
Expected: run verde. Depois: `curl -s -o /dev/null -w "%{http_code}\n" https://gabrielimmich.github.io/tibia-quest-graph/` → `200`, e `curl -s https://gabrielimmich.github.io/tibia-quest-graph/ | grep -c 'id="graph"'` → `1`.

---

### Task 5: Verificação final e revisão

- [x] **Step 1: Sequência dos critérios de pronto**

Run: `rm -rf node_modules dist && npm ci && npm test && npm run typecheck && npm run validate && npm run build`
Expected: tudo verde, `Tests 62 passed`.

- [x] **Step 2: Auditoria**

Run:
```bash
grep -rnE "\bany\b|@ts-ignore|as unknown as|innerHTML" src scripts tests --include=*.ts | grep -v "^src/domain/parse.ts:.*// " ; echo "---"
grep -rn "wheelSensitivity" src ; echo "---"
```
Expected: nenhuma ocorrência real (só o comentário em `parse.ts`).

- [x] **Step 3: Code review** com `superpowers:requesting-code-review` sobre `git diff 3a18632..HEAD`; corrigir Critical/Important; commitar `refactor: ajustes da revisão de código`; push.

- [x] **Step 4: Marcar o plano como executado** com seção "Resultado" e commitar.

---

## Resultado (2026-09-12)

Executado na branch `feat/interface`, revisado, fundido em `main` e publicado:
**https://gabrielimmich.github.io/tibia-quest-graph/** (repo
`gabrielimmich/tibia-quest-graph`, Pages via Actions, primeiro deploy verde).
70 testes, `typecheck`, `validate` e `build` verdes. Render conferido com Edge
headless em 1280px, 1100px e 400px (via iframe) e na URL publicada.

Desvios em relação ao plano, vindos da revisão de código:

- Revisão feita **antes** do merge/push, para o primeiro deploy público já sair revisado.
- Classes de linhagem extraídas para `src/graph/lineage-classes.ts`, com teste
  headless que também confere o stylesheet aplicado (Cytoscape só avisa em
  propriedade inválida, não lança).
- Hash lido sem `decodeURIComponent` (ids são `[a-z0-9-]`; `#%` lançava).
- `cy.stop()` antes do pan; `li role=none` na lista da busca; foco vai ao
  painel ao escolher pela busca; painel é região rotulada (sem `aria-live`);
  folha inferior fica `visibility: hidden` fechada; `:focus-visible`; `100dvh`;
  `prefers-reduced-motion`; `cancel-in-progress: false` no workflow.
- Bug pego por screenshot: legenda tracejada/pontilhada perdia para
  `.legend li::before` em especificidade.

### Fase 2 (fora do MVP, ideias registradas)

- `hashchange` para trocar a seleção colando outro `#id` na mesma aba.
- Navegação por setas na busca (`aria-activedescendant`).
- Zoom mínimo legível ao selecionar em telas pequenas.
- As outras quests (comentários `# fase 2:` no YAML já apontam as primeiras).
