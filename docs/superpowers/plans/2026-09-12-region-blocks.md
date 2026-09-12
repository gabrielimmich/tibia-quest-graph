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

- [ ] `tests/domain/overview.test.ts` + `src/domain/overview.ts`:
  ```ts
  export interface Block { readonly region: string; readonly quests: readonly Quest[]; readonly isolated: number }
  export interface Overview { readonly connected: QuestGraph; readonly blocks: readonly Block[]; readonly isolatedTotal: number }
  export function buildOverview(graph: QuestGraph): Overview
  ```
  Blocos: por `quest.region ?? 'Outros'` das quests conectadas; `isolated` = quests da região sem aresta; ordem por `quests.length` desc, título da região asc, "Outros" sempre por último.
- [ ] `tests/graph/pack.test.ts` + `src/graph/pack.ts`:
  ```ts
  export interface PackItem { readonly id: string; readonly w: number; readonly h: number }
  export function packShelves(items: readonly PackItem[], maxWidth: number, gap: number): ReadonlyMap<string, { x: number; y: number }>
  ```
  Prateleiras: item vai à direita do anterior se couber em `maxWidth`, senão nova linha em `y = topo + altura da prateleira + gap`; item mais largo que `maxWidth` ocupa linha sozinha.
- [ ] Commit `feat: buildOverview e packShelves`.

### Task 2: Elementos, estilo e view

- [ ] `elements.ts`: `toBlockElements(overview): ElementDefinition[]` — pai `{ data: { id: 'region:<slug>', label: 'Região · N' ou 'Região · N (+M sem dependências)', region } , classes: 'region' }`, filhos com `parent`. Teste: pais = nº de blocos, filhos com parent certo; headless: `cy.add`, `children.layout({name:'dagre', fit:false}).run()`, `children.shift(...)`, e `parent.boundingBox()` contém os filhos.
- [ ] `style.ts`: `node.region` (shape round-rectangle, `background-opacity: 0.08`, borda `colors.edge`, `label: data(label)`, `text-valign: top`, `text-halign: center`, `font-size: 16`, `font-weight: bold`, `color: colors.nodeText`, `padding: 24`, `text-margin-y: -8`), `node.region.dimmed` opacidade 0.3 (pai apagado demais some).
- [ ] `quest-graph-view.ts`: `renderBlocks(overview)`; `render` continua para árvore. Em blocks: `cy.stop(); cy.resize(); cy.elements().remove(); cy.add(toBlockElements(overview))`; para cada pai: `const kids = parent.children(); kids.layout({ name: 'dagre', rankDir: 'TB', nodeSep: 20, rankSep: 50, fit: false }).run()`; medir `parent.boundingBox()`; `packShelves` com `maxWidth = max(1400, sqrt(área total)*1.6)` e gap 60; `kids.shift({ x: target.x - bb.x1, y: target.y - bb.y1 })`; `cy.fit(undefined, 40)`; guardar `shown = overview.connected`, `root = null`, `blocks = true`. Tap em `node.region` → `cy.animate({ fit: { eles: parent, padding: 40 } }, { duration: 300 })` e não dispara listener de quest. Tap no fundo → `cy.animate({ fit: { eles: cy.elements(), padding: 40 } })` + listener(null).
- [ ] `lineage-classes.ts`: `applyLineageClasses` não deve esmaecer os pais além do `.region.dimmed`; já funciona via `cy.elements()` (pais recebem `dimmed`); só conferir no teste headless que pais recebem/perdem a classe.
- [ ] Commit `feat(graph): blocos por região com dagre interno e empacotamento`.

### Task 3: Modo, painel, main

- [ ] `mode.ts`: `all` → `{ kind: 'all'; overview: Overview; focus }`; `focusQuest` usa `overview.connected`; `modeFromHash('#todas')` chama `buildOverview`.
- [ ] `main.ts`: `if (next.kind === 'all') view.renderBlocks(next.overview)`; painel vazio recebe `overview` para o texto.
- [ ] `panel.ts`: `renderPanel(root, graph, selected, actions, summary?: string)`: parágrafo de stats vem de `summary` quando existir; main monta "N quests conectadas em R regiões · E ligações · I sem dependências ficam na busca".
- [ ] Screenshots 1400px e 500px de `#todas`, e de um foco dentro dos blocos.
- [ ] Commit `feat(ui): visão geral por blocos de região`.

### Task 4: Verificação, revisão, publicação

- [ ] Sequência completa; auditoria; `requesting-code-review`; correções; merge; push; `gh run watch`; "Resultado".
