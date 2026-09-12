# Fase 2a (início e árvore) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O site abre com "Qual quest você quer fazer?", e escolher uma quest mostra só a árvore dela; `#todas` mantém o grafo completo; título volta ao início.

**Architecture:** Domínio ganha `lineageSubgraph` e `mostConnectedQuests` (puros). A view do Cytoscape vira "burra": `render(graph, root)`, `focus(id)`, `clearFocus()`, `onTap`. `main.ts` é a máquina de modos (`landing | all | tree`) dirigida pelo hash. Spec: `docs/superpowers/specs/2026-09-12-start-and-tree-design.md`.

**Tech Stack:** o mesmo (Vite 8, TS 7, Vitest 5, Cytoscape 3.34 + dagre 4).

## Global Constraints

- Zero `any`, `@ts-ignore`, `as unknown as`; texto só via `textContent`; `href` só de `wiki`/`source`.
- `src/domain/` puro; imports com `.ts`; comentários explicam *por quê*.
- Sem dependência nova. Schema do YAML inalterado.
- Branch `feat/start-and-tree`; fast-forward em `main` no fim; push publica.
- Commits com `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Domínio — `lineageSubgraph` e `mostConnectedQuests`

**Files:**
- Modify: `src/domain/lineage.ts`, `src/domain/index.ts`, `tests/domain/lineage.test.ts`
- Create: `src/domain/suggestions.ts`, `tests/domain/suggestions.test.ts`

**Interfaces:**
- Produces: `lineageSubgraph(graph, id): QuestGraph`, `mostConnectedQuests(graph, limit): readonly Quest[]`

- [x] **Step 1: Testes que falham** — acrescentar ao fim de `tests/domain/lineage.test.ts`:

```ts
describe('lineageSubgraph', () => {
  it('contém a quest, seus ancestrais, descendentes e as arestas entre eles', () => {
    const sub = lineageSubgraph(graph, id('d'))
    expect([...sub.quests.keys()].sort()).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(sub.edges).toEqual([ab, ac, bd, cd, de])
    expect(sub.outgoing.get(id('a'))).toEqual([ab, ac])
  })

  it('quest isolada vira grafo de um nó', () => {
    const sub = lineageSubgraph(graph, id('x'))
    expect([...sub.quests.keys()]).toEqual(['x'])
    expect(sub.edges).toEqual([])
  })

  it('id inexistente devolve grafo vazio', () => {
    const sub = lineageSubgraph(graph, id('zzz'))
    expect(sub.quests.size).toBe(0)
  })
})
```
(e trocar o import por `import { findLineage, lineageSubgraph } from '../../src/domain/lineage.ts'`)

Criar `tests/domain/suggestions.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildQuestGraph } from '../../src/domain/quest.ts'
import { mostConnectedQuests } from '../../src/domain/suggestions.ts'
import { edge, quest } from './fixtures.ts'

// a→b→d, a→c→d, d→e; x isolada. Conexões: d=4, a=4, b=3, c=3, e=4? não: e tem 4 ancestrais.
const graph = buildQuestGraph(
  [quest('x'), quest('e'), quest('d'), quest('c'), quest('b'), quest('a')],
  [edge('a', 'b'), edge('a', 'c'), edge('b', 'd'), edge('c', 'd'), edge('d', 'e')],
)
const ids = (limit: number) => mostConnectedQuests(graph, limit).map((quest) => quest.id)

describe('mostConnectedQuests', () => {
  it('ordena por total de ancestrais + descendentes, desempatando por título', () => {
    // a: 0+4, d: 3+1, e: 4+0 → todos 4; b e c: 1+2 = 3
    expect(ids(10)).toEqual(['a', 'd', 'e', 'b', 'c'])
  })

  it('ignora quests isoladas', () => {
    expect(ids(10)).not.toContain('x')
  })

  it('respeita o limite', () => {
    expect(ids(2)).toEqual(['a', 'd'])
  })
})
```

- [x] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/domain/lineage.test.ts tests/domain/suggestions.test.ts`
Expected: FAIL (`lineageSubgraph` não exportado; módulo `suggestions.ts` inexistente).

- [x] **Step 3: Implementar** — acrescentar ao fim de `src/domain/lineage.ts`:

```ts
// Grafo só com a quest e sua linhagem: é o que a árvore mostra. Reusa
// buildQuestGraph para que a view não precise saber de sub-grafos.
export function lineageSubgraph(graph: QuestGraph, id: QuestId): QuestGraph {
  const lineage = findLineage(graph, id)
  const ids = [id, ...lineage.ancestors, ...lineage.descendants]
  const quests = ids.flatMap((questId) => {
    const quest = graph.quests.get(questId)
    return quest ? [quest] : []
  })
  return buildQuestGraph(quests, lineage.edges)
}
```
e ajustar o import do topo: `import { buildQuestGraph, type Edge, type QuestGraph, type QuestId } from './quest.ts'`.

Criar `src/domain/suggestions.ts`:

```ts
import type { Quest, QuestGraph } from './quest.ts'
import { findAllPrerequisites, findAllUnlocked } from './traversal.ts'

// Sugestões da tela inicial sem curadoria: as quests com mais ligações são as
// que mais se beneficiam de um mapa.
export function mostConnectedQuests(graph: QuestGraph, limit: number): readonly Quest[] {
  const ranked = [...graph.quests.values()]
    .map((quest) => ({
      quest,
      connections: findAllPrerequisites(graph, quest.id).size + findAllUnlocked(graph, quest.id).size,
    }))
    .filter((entry) => entry.connections > 0)
    .sort((a, b) => b.connections - a.connections || a.quest.title.localeCompare(b.quest.title))
  return ranked.slice(0, limit).map((entry) => entry.quest)
}
```

Em `src/domain/index.ts`: trocar a linha do lineage por
`export { findLineage, lineageSubgraph, type Lineage } from './lineage.ts'` e acrescentar
`export { mostConnectedQuests } from './suggestions.ts'`.

- [x] **Step 4: Rodar e ver passar**

Run: `npx vitest run && npx tsc --noEmit`
Expected: verde (+3 lineage, +3 suggestions, +1 purity).

- [x] **Step 5: Commit**

```bash
git add src/domain tests/domain
git commit -m "feat(domain): lineageSubgraph e mostConnectedQuests"
```

---

### Task 2: Grafo — `setInspect`, estilo, view com `render`/`focus`

**Files:**
- Modify: `src/graph/lineage-classes.ts`, `src/graph/style.ts`, `src/graph/quest-graph-view.ts`, `tests/graph/lineage-classes.test.ts`

**Interfaces:**
- Produces: `setInspect(cy, id | null)`, `QuestGraphView { render(graph, root), focus(id), clearFocus(), onTap(listener) }`

- [x] **Step 1: Teste que falha** — acrescentar a `tests/graph/lineage-classes.test.ts` (import `setInspect` junto dos outros):

```ts
describe('setInspect', () => {
  it('move a classe inspect entre nós e null limpa', () => {
    const cy = headless()
    setInspect(cy, id('a'))
    expect(cy.getElementById('a').hasClass('inspect')).toBe(true)
    setInspect(cy, id('b'))
    expect(cy.getElementById('a').hasClass('inspect')).toBe(false)
    expect(cy.getElementById('b').hasClass('inspect')).toBe(true)
    setInspect(cy, null)
    expect(cy.nodes('.inspect')).toHaveLength(0)
  })

  it('não conflita com as classes de linhagem', () => {
    const cy = headless()
    applyLineageClasses(cy, graph, id('d'))
    setInspect(cy, id('a'))
    expect(cy.getElementById('a').classes().sort()).toEqual(['ancestor', 'inspect'])
    applyLineageClasses(cy, graph, id('x'))
    expect(cy.getElementById('a').hasClass('inspect')).toBe(false)
  })
})
```

- [x] **Step 2: Rodar e ver falhar**: `npx vitest run tests/graph` → FAIL (`setInspect` não existe).

- [x] **Step 3: Implementar**

`src/graph/lineage-classes.ts`: `LINEAGE_CLASSES = 'focus ancestor descendant path dimmed inspect'` e acrescentar

```ts
// Marca o nó cujos detalhes estão no painel, sem esmaecer nada: na árvore
// tudo que está na tela é relevante.
export function setInspect(cy: Core, id: QuestId | null): void {
  cy.nodes().removeClass('inspect')
  if (id !== null) cy.getElementById(id).addClass('inspect')
}
```

`src/graph/style.ts`: acrescentar `inspect: '#fff3c4'` em `colors` e, depois de `node.focus`:

```ts
  { selector: 'node.inspect', style: { 'border-color': colors.inspect, 'border-width': 4 } },
```

`src/graph/quest-graph-view.ts` (substituir):

```ts
import cytoscape, { type EventObject, type EventObjectNode } from 'cytoscape'
import dagre, { type DagreLayoutOptions } from 'cytoscape-dagre'
import { questId, type QuestGraph, type QuestId } from '../domain/index.ts'
import { toElements } from './elements.ts'
import { applyLineageClasses, clearLineageClasses, setInspect } from './lineage-classes.ts'
import { stylesheet } from './style.ts'

cytoscape.use(dagre)

export type TapListener = (id: QuestId | null) => void

export interface QuestGraphView {
  // Substitui o que está na tela. root ≠ null é a raiz de uma árvore: fica
  // dourada e o foco não esmaece nada; root = null é o grafo completo.
  readonly render: (graph: QuestGraph, root: QuestId | null) => void
  readonly focus: (id: QuestId) => void
  readonly clearFocus: () => void
  readonly onTap: (listener: TapListener) => void
}

const layout: DagreLayoutOptions = { name: 'dagre', rankDir: 'TB', nodeSep: 30, rankSep: 70, padding: 24 }

export function createQuestGraphView(container: HTMLElement, initial: QuestGraph): QuestGraphView {
  const cy = cytoscape({
    container,
    elements: toElements(initial),
    style: stylesheet,
    layout,
    autounselectify: true,
    minZoom: 0.3,
    maxZoom: 2.5,
  })

  let shown: QuestGraph = initial
  let root: QuestId | null = null
  const listeners: TapListener[] = []

  const render = (graph: QuestGraph, nextRoot: QuestId | null) => {
    shown = graph
    root = nextRoot
    cy.elements().remove()
    cy.add(toElements(graph))
    if (root !== null) cy.getElementById(root).addClass('focus')
    cy.layout(layout).run()
  }

  const focus = (id: QuestId) => {
    const node = cy.getElementById(id)
    if (node.empty()) return
    if (root === null) applyLineageClasses(cy, shown, id)
    else setInspect(cy, id)
    cy.stop()
    cy.animate({ center: { eles: node } }, { duration: 250 })
  }

  const clearFocus = () => {
    if (root === null) clearLineageClasses(cy)
    else setInspect(cy, null)
  }

  cy.on('tap', 'node', (event: EventObjectNode) => {
    for (const listener of listeners) listener(questId(event.target.id()))
  })
  cy.on('tap', (event: EventObject) => {
    if (event.target !== cy) return
    for (const listener of listeners) listener(null)
  })

  return {
    render,
    focus,
    clearFocus,
    onTap: (listener) => {
      listeners.push(listener)
    },
  }
}
```

- [x] **Step 4: Rodar e ver passar**: `npx vitest run && npx tsc --noEmit` (o `main.ts` antigo quebra o tsc por usar `select`/`onSelect`; isso se resolve na Task 3, então nesta task só `npx vitest run` precisa passar).

- [x] **Step 5: Commit**

```bash
git add src/graph tests/graph
git commit -m "feat(graph): view com render/focus e classe inspect"
```

---

### Task 3: Painel, landing, main e página

**Files:**
- Modify: `src/ui/panel.ts`, `src/main.ts`, `index.html`, `src/styles.css`
- Create: `src/ui/landing.ts`

- [x] **Step 1: `src/ui/panel.ts`** — trocar a assinatura e o header:

```ts
export interface PanelActions {
  readonly onNavigate: NavigateHandler
  // Presente quando faz sentido re-enraizar a árvore na quest mostrada.
  readonly onShowTree?: NavigateHandler
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
```

`renderHeader(quest: Quest, onShowTree?: NavigateHandler)`: depois de `unlocks`, se `onShowTree` existir:

```ts
  if (onShowTree) {
    const button = el('button', 'panel-action', 'Ver árvore desta quest')
    button.type = 'button'
    button.addEventListener('click', () => onShowTree(quest.id))
    header.append(button)
  }
```

`renderEmpty`: trocar o texto por `'Clique num nó para ver os detalhes: tudo que precisa ser feito antes, tudo que libera depois, e a frase da TibiaWiki que comprova cada ligação.'`.

- [x] **Step 2: `src/ui/landing.ts`**

```ts
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
```

- [x] **Step 3: `src/main.ts`** (substituir)

```ts
import data from 'virtual:quests'
import { buildQuestGraph, lineageSubgraph, mostConnectedQuests, questId, type QuestId } from './domain/index.ts'
import { createQuestGraphView } from './graph/quest-graph-view.ts'
import { renderSuggestions } from './ui/landing.ts'
import { renderPanel } from './ui/panel.ts'
import { createSearch } from './ui/search.ts'

type Mode =
  | { readonly kind: 'landing' }
  | { readonly kind: 'all'; readonly focus: QuestId | null }
  | { readonly kind: 'tree'; readonly root: QuestId; readonly focus: QuestId }

const ALL_HASH = 'todas'

const graph = buildQuestGraph(data.quests, data.edges)
const view = createQuestGraphView(mustFind('#graph'), graph)
const panel = mustFind('#panel')

let mode: Mode = { kind: 'landing' }

// ---- transições (as que mudam a rota passam pelo hash, para o botão voltar funcionar) ----

function goLanding(): void {
  history.pushState(null, '', `${location.pathname}${location.search}`)
  applyRoute()
}

function goAll(): void {
  location.hash = ALL_HASH
}

function goTree(id: QuestId): void {
  if (location.hash.slice(1) === id) applyRoute()
  else location.hash = id
}

function focusQuest(id: QuestId): void {
  if (mode.kind === 'landing') return
  if (!isOnScreen(id)) {
    goTree(id)
    return
  }
  mode = mode.kind === 'all' ? { kind: 'all', focus: id } : { ...mode, focus: id }
  view.focus(id)
  renderPanelFor(mode)
}

function clearFocus(): void {
  if (mode.kind !== 'all') return
  mode = { kind: 'all', focus: null }
  view.clearFocus()
  renderPanelFor(mode)
}

function isOnScreen(id: QuestId): boolean {
  return mode.kind === 'all' || (mode.kind === 'tree' && lineageSubgraph(graph, mode.root).quests.has(id))
}

// ---- rota → modo ----

function applyRoute(): void {
  const hash = location.hash.slice(1)
  if (hash === ALL_HASH) enter({ kind: 'all', focus: null })
  else if (graph.quests.has(questId(hash))) enter({ kind: 'tree', root: questId(hash), focus: questId(hash) })
  else enter({ kind: 'landing' })
}

function enter(next: Mode): void {
  mode = next
  document.body.dataset['mode'] = next.kind
  if (next.kind === 'all') view.render(graph, null)
  if (next.kind === 'tree') {
    view.render(lineageSubgraph(graph, next.root), next.root)
    view.focus(next.focus)
  }
  renderPanelFor(next)
  if (next.kind === 'landing') mustFindInput('#landing-search').focus()
}

function renderPanelFor(current: Mode): void {
  const focus = current.kind === 'landing' ? null : current.focus
  const canShowTree = current.kind === 'all' ? focus !== null : current.kind === 'tree' && focus !== current.root
  renderPanel(panel, graph, focus, { onNavigate: focusQuest, ...(canShowTree ? { onShowTree: goTree } : {}) })
  panel.classList.toggle('open', focus !== null)
}

// ---- ligações ----

view.onTap((id) => (id === null ? clearFocus() : focusQuest(id)))
mustFind('#panel-close').addEventListener('click', clearFocus)
mustFind('#home').addEventListener('click', (event) => {
  event.preventDefault()
  goLanding()
})
mustFind('#show-all').addEventListener('click', goAll)
createSearch({ input: mustFindInput('#search'), results: mustFind('#search-results') }, graph, (id) => {
  goTree(id)
  panel.focus()
})
createSearch({ input: mustFindInput('#landing-search'), results: mustFind('#landing-results') }, graph, goTree)
renderSuggestions(mustFind('#suggestions'), mostConnectedQuests(graph, 4), goTree)

window.addEventListener('hashchange', applyRoute)
applyRoute()

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

- [x] **Step 4: `index.html`** — trocar `<h1>Tibia Quest Graph</h1>` por `<h1><a id="home" href="#">Tibia Quest Graph</a></h1>` e inserir, dentro de `<main class="workspace">`, antes de `#graph`:

```html
      <section id="landing" class="landing" aria-label="Início">
        <div class="landing-card">
          <h2>Qual quest você quer fazer?</h2>
          <p>Escolha uma e veja tudo que precisa ser feito antes, tudo que ela libera depois, e a frase da TibiaWiki que comprova cada ligação.</p>
          <form class="search search-big" role="search" autocomplete="off">
            <label class="visually-hidden" for="landing-search">Buscar quest</label>
            <input
              id="landing-search"
              type="search"
              placeholder="Buscar quest…"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded="false"
              aria-controls="landing-results"
            />
            <ul id="landing-results" class="search-results" role="listbox" hidden></ul>
          </form>
          <p class="landing-hint">Sugestões</p>
          <ul id="suggestions" class="suggestions" aria-label="Sugestões de quests"></ul>
          <p class="landing-all"><button id="show-all" type="button" class="quest-link">ver todas as quests no grafo</button></p>
        </div>
      </section>
```

- [x] **Step 5: `src/styles.css`** — acrescentar:

```css
/* ---- início ---- */
.topbar h1 a {
  color: inherit;
  text-decoration: none;
}

.topbar h1 a:hover {
  color: var(--accent);
}

/* Overlay sobre o grafo: o Cytoscape já nasce com tamanho real por baixo. */
.landing {
  position: absolute;
  inset: 0;
  z-index: 8;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  overflow: auto;
  background: var(--bg);
}

.landing-card {
  width: 100%;
  max-width: 560px;
  text-align: center;
}

.landing h2 {
  margin: 0 0 8px;
  font-size: 28px;
}

.landing-card > p {
  margin: 0 0 20px;
  color: var(--muted);
}

.search-big {
  max-width: none;
  margin: 0 auto;
}

.search-big input {
  padding: 14px 16px;
  font-size: 18px;
}

.landing-hint {
  margin: 24px 0 8px;
  font-size: 12px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
}

.suggestions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.chip {
  padding: 8px 14px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg-panel);
  color: var(--text);
  font: inherit;
  cursor: pointer;
}

.chip:hover,
.chip:focus-visible {
  border-color: var(--accent);
  outline: none;
}

.landing-all {
  margin: 24px 0 0;
}

.panel-action {
  display: inline-block;
  margin-top: 12px;
  padding: 8px 12px;
  border: 1px solid var(--accent);
  border-radius: 8px;
  background: none;
  color: var(--accent);
  font: inherit;
  cursor: pointer;
}

.panel-action:hover,
.panel-action:focus-visible {
  background: var(--accent);
  color: var(--bg);
  outline: none;
}

body:not([data-mode='landing']) .landing {
  display: none;
}

body[data-mode='landing'] .topbar .search,
body[data-mode='landing'] .panel,
body[data-mode='landing'] .panel-close {
  display: none;
}
```

- [x] **Step 6: Build, screenshots e verificação**

Run: `npm run typecheck && npm test && npm run build`. Depois dev server e Edge headless em `/tibia-quest-graph/` (landing), `#the-dream-courts` (árvore de 6), `#todas` (grafo inteiro), e 400px via iframe. Conferir: sugestões aparecem; árvore mostra só 6 nós com Dream Courts dourada; grafo completo igual ao de antes.

- [x] **Step 7: Commit**

```bash
git add src/ui src/main.ts index.html src/styles.css
git commit -m "feat(ui): tela inicial, árvore da quest escolhida e rotas por hash"
```

---

### Task 4: Verificação, revisão, publicação

- [x] `rm -rf node_modules dist && npm ci && npm test && npm run typecheck && npm run validate && npm run build`
- [x] Auditoria: `grep -rnE "\bany\b|@ts-ignore|as unknown as|innerHTML" src tests --include=*.ts | grep -v "// "`
- [x] `superpowers:requesting-code-review` sobre `git diff 0c9f740..HEAD`; corrigir Critical/Important.
- [x] `git checkout main && git merge --ff-only feat/start-and-tree && git branch -d feat/start-and-tree && git push`
- [x] `gh run watch` verde; `curl` da URL publicada; screenshot da URL publicada com `#the-dream-courts`.
- [x] Marcar o plano como executado com "Resultado"; commit; push.

---

## Resultado (2026-09-12)

Executado, revisado e publicado. 93 testes; render conferido com Edge headless
(início, árvore, `#todas`, 400px e 500px).

Desvios vindos da revisão de código:

- **Bug real pego pela revisão**: `lineageSubgraph` reusava `findLineage.edges`,
  que só tinha arestas ancestral↔ancestral e descendente↔descendente; a aresta
  direta ancestral → descendente que passa ao largo da quest sumia da árvore
  (Barbarian Test → Yalahar na árvore de Ice Islands). Linhagem agora é o
  subgrafo induzido; spec atualizado.
- Máquina de modos extraída para `src/ui/mode.ts` (pura, 11 testes). Foco na
  árvore é anulável: a folha inferior fecha no celular.
- View: sem layout no construtor; `cy.stop()` + `cy.resize()` antes de
  renderizar; zoom máximo 1.25 no fit; pan na árvore só se o nó sair da tela;
  `replaceElements`/`markFocus`/`unmarkFocus` em `lineage-classes.ts` com testes.
- Foco de teclado vai ao painel ao entrar num grafo, com `preventScroll`;
  `.workspace { overflow: hidden }` (a folha fechada estendia a rolagem e o
  `focus()` rolava a página inteira — visto em screenshot de 400px).

Fase 2b (dados completos) é a próxima etapa; spec de contexto em
`docs/superpowers/specs/2026-09-12-phase2-context.md`.
