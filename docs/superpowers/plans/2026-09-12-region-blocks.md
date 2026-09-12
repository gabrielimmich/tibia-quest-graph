# Fase 2c (blocos por região) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `#todas` vira um mapa de blocos por região (nós compostos do Cytoscape), dagre dentro de cada bloco, blocos empacotados em prateleiras, ligações entre blocos visíveis; clique no bloco dá zoom; clique na quest destaca a linhagem.

**Architecture:** `domain/overview.ts` agrupa (puro); `graph/pack.ts` empacota (puro); `graph/elements.ts` gera pais e filhos; a view ganha `renderBlocks`. Spec: `docs/superpowers/specs/2026-09-12-region-blocks-design.md`.

**Tech Stack:** o mesmo. Sem dependência nova.

## Global Constraints

- Zero `any`/`@ts-ignore`/`as unknown as`; `src/domain/` puro; `textContent` só.
- Branch `feat/region-blocks`; commits com `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

---

### Task 1: `buildOverview` (domínio) e `packShelves` (grafo), TDD

- [x] `tests/domain/overview.test.ts` + `src/domain/overview.ts`:
  ```ts
  export interface Block { readonly region: string; readonly quests: readonly Quest[]; readonly isolated: number }
  export interface Overview { readonly connected: QuestGraph; readonly blocks: readonly Block[]; readonly isolatedTotal: number }
  export function buildOverview(graph: QuestGraph): Overview
  ```
  Blocos: por `quest.region ?? 'Outros'` das quests conectadas; `isolated` = quests da região sem aresta; ordem por `quests.length` desc, título da região asc, "Outros" sempre por último.
- [x] `tests/graph/pack.test.ts` + `src/graph/pack.ts`:
  ```ts
  export interface PackItem { readonly id: string; readonly w: number; readonly h: number }
  export function packShelves(items: readonly PackItem[], maxWidth: number, gap: number): ReadonlyMap<string, { x: number; y: number }>
  ```
  Prateleiras: item vai à direita do anterior se couber em `maxWidth`, senão nova linha em `y = topo + altura da prateleira + gap`; item mais largo que `maxWidth` ocupa linha sozinha.
- [x] Commit `feat: buildOverview e packShelves`.

### Task 2: Elementos, estilo e view

- [x] `elements.ts`: `toBlockElements(overview): ElementDefinition[]` — pai `{ data: { id: 'region:<slug>', label: 'Região · N' ou 'Região · N (+M sem dependências)', region } , classes: 'region' }`, filhos com `parent`. Teste: pais = nº de blocos, filhos com parent certo; headless: `cy.add`, `children.layout({name:'dagre', fit:false}).run()`, `children.shift(...)`, e `parent.boundingBox()` contém os filhos.
- [x] `style.ts`: `node.region` (shape round-rectangle, `background-opacity: 0.08`, borda `colors.edge`, `label: data(label)`, `text-valign: top`, `text-halign: center`, `font-size: 16`, `font-weight: bold`, `color: colors.nodeText`, `padding: 24`, `text-margin-y: -8`), `node.region.dimmed` opacidade 0.3 (pai apagado demais some).
- [x] `quest-graph-view.ts`: `renderBlocks(overview)`; `render` continua para árvore. Em blocks: `cy.stop(); cy.resize(); cy.elements().remove(); cy.add(toBlockElements(overview))`; para cada pai: `const kids = parent.children(); kids.layout({ name: 'dagre', rankDir: 'TB', nodeSep: 20, rankSep: 50, fit: false }).run()`; medir `parent.boundingBox()`; `packShelves` com `maxWidth = max(1400, sqrt(área total)*1.6)` e gap 60; `kids.shift({ x: target.x - bb.x1, y: target.y - bb.y1 })`; `cy.fit(undefined, 40)`; guardar `shown = overview.connected`, `root = null`, `blocks = true`. Tap em `node.region` → `cy.animate({ fit: { eles: parent, padding: 40 } }, { duration: 300 })` e não dispara listener de quest. Tap no fundo → `cy.animate({ fit: { eles: cy.elements(), padding: 40 } })` + listener(null).
- [x] `lineage-classes.ts`: `applyLineageClasses` não deve esmaecer os pais além do `.region.dimmed`; já funciona via `cy.elements()` (pais recebem `dimmed`); só conferir no teste headless que pais recebem/perdem a classe.
- [x] Commit `feat(graph): blocos por região com dagre interno e empacotamento`.

### Task 3: Modo, painel, main

- [x] `mode.ts`: `all` → `{ kind: 'all'; overview: Overview; focus }`; `focusQuest` usa `overview.connected`; `modeFromHash('#todas')` chama `buildOverview`.
- [x] `main.ts`: `if (next.kind === 'all') view.renderBlocks(next.overview)`; painel vazio recebe `overview` para o texto.
- [x] `panel.ts`: `renderPanel(root, graph, selected, actions, summary?: string)`: parágrafo de stats vem de `summary` quando existir; main monta "N quests conectadas em R regiões · E ligações · I sem dependências ficam na busca".
- [x] Screenshots 1400px e 500px de `#todas`, e de um foco dentro dos blocos.
- [x] Commit `feat(ui): visão geral por blocos de região`.

### Task 4: Verificação, revisão, publicação

- [x] Sequência completa; auditoria; `requesting-code-review`; correções; merge; push; `gh run watch`; "Resultado".

---

## Resultado (2026-09-12)

`#todas` é um mapa de 19 blocos de região (87 quests conectadas, 97 ligações;
222 sem dependências ficam na busca e aparecem na contagem do bloco). 140
testes. Publicado.

Desvios vindos da revisão de código:

- **Bug visual pego pela revisão**: esmaecer os pais compostos multiplicava a
  opacidade dos filhos e apagava a própria linhagem em foco (regra
  `node.region.dimmed` ainda perdia por ordem de stylesheet). Pais ficam fora
  do `dimmed`; teste com `effectiveOpacity`.
- Dentro do bloco: dagre por componente conexo interno + empacotamento, em vez
  de um dagre por bloco (que virava uma tira). Empacotamento externo mede e
  move pela mesma caixa com rótulo.
- Tap no bloco com teto de zoom (1.25); segundo tap volta ao mapa.

Fase 2 (2a + 2b + 2c) concluída. Pendências para Gabriel: fila de revisão de
arestas e lugares sem região (`docs/superpowers/review/2026-09-12-edge-queue.md`).
