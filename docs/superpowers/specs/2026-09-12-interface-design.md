# Interface: grafo navegável, painel, busca e deploy

Data: 2026-09-12
Sessão 3 de 3 do MVP (fundação → dados → **interface**). Fundação em
`2026-09-12-foundation-design.md`, dados em `2026-09-12-data-design.md`.

## Objetivo

Fechar os critérios do `CLAUDE.md` §2 que faltam:

- clicar num nó destaca ancestrais e descendentes, com o resto esmaecido;
- busca por nome funciona;
- cada aresta mostra a evidência e linka para a página da wiki;
- o site está publicado e abre em celular.

## Decisões

| Decisão | Escolha | Por quê |
|---|---|---|
| Deploy | GitHub Pages, repo público `gabrielimmich/tibia-quest-graph`, workflow do Actions | `gh` já autenticado; zero configuração manual |
| `base` do Vite | `/tibia-quest-graph/` sempre | Mesmos caminhos em dev, preview e produção |
| Framework de UI | Nenhum; DOM API | Um painel e uma busca não justificam dependência |
| Tema | Escuro, nós âmbar, texto pt-BR | Estilo Tibia; único tema, sem toggle |
| Layout do grafo | dagre `rankDir: 'TB'` | Pré-requisitos em cima, dependentes embaixo |
| Rótulo do nó | título sem o sufixo " Quest" | Cabe no nó; painel mostra o título completo |
| Seleção na URL | `location.hash = id` | Link compartilhável, 10 linhas |
| Tipagens | `cytoscape` e `cytoscape-dagre` trazem as próprias | Sem `@types/*` |

## Layout

```
┌──────────────────────────────────────────────────────────────┐
│ Tibia Quest Graph   [buscar quest…]   legenda: ─ required     │
│                                       ╌ access  ┄ recommended │
├──────────────────────────────────────┬───────────────────────┤
│ grafo (#graph, Cytoscape)            │ painel (#panel)       │
├──────────────────────────────────────┴───────────────────────┤
│ Fansite não oficial · Tibia é marca da CipSoft · TibiaWiki   │
│ CC-BY-SA                                                     │
└──────────────────────────────────────────────────────────────┘
```

- Desktop (≥ 768px): painel à direita, 360px, rolável.
- Celular (< 768px): painel como folha inferior com 45% da altura, rolável,
  botão "fechar"; grafo ocupa o resto; busca em largura total.
- `#graph` precisa de altura explícita (Cytoscape não mede `auto`).

## Comportamento

**Seleção.** Clique no nó → classes no Cytoscape: `focus` no nó (não `selected`,
que colide com o estado nativo `:selected`, desligado via `autounselectify`),
`ancestor` nos ancestrais, `descendant` nos descendentes, `path` nas arestas
que ligam esses conjuntos, `dimmed` em todo o resto (opacidade 0,15). Clique
no fundo limpa tudo. Selecionar faz `cy.center(node)` animado, sem alterar o
zoom.

**Arestas.** `required` linha sólida, `access` tracejada, `recommended`
pontilhada; seta na ponta `to`. Legenda no cabeçalho.

**Painel.** Sem seleção: instruções curtas e contagem de quests/arestas. Com
seleção:

1. título completo, linha "Level N · Premium" (omitindo o que não houver),
   link "Ver na TibiaWiki ↗" (`wiki`);
2. "Libera:" + `unlocks`;
3. "Precisa antes (N)": para cada aresta de entrada, título da quest `from`
   (botão que a seleciona), badge do `kind`, `evidence` entre aspas, link
   "TibiaWiki ↗" para `source`. Depois, "Indiretos:" com os ancestrais que não
   são diretos, só título clicável;
4. "Libera depois (N)": simétrico com arestas de saída e descendentes.

**Busca.** Input com `role="combobox"`; filtra títulos ignorando acento e
caixa; lista até 8 resultados como botões; Enter escolhe o primeiro; Escape
fecha. Escolher = selecionar no grafo.

**URL.** Ao selecionar, `history.replaceState` com `#<id>`; ao carregar, se o
hash for um id válido, seleciona. Hash inválido é ignorado.

**Segurança.** Todo texto entra por `textContent`. `href` recebe apenas `wiki`
e `source`, que o validador já garante começarem com
`https://tibia.fandom.com/wiki/`. Links externos com `rel="noopener"` e
`target="_blank"`.

## Módulos

| Arquivo | Exporta | Puro? |
|---|---|---|
| `src/domain/lineage.ts` | `findLineage(graph, id): Lineage` com `ancestors`, `descendants`, `edges` (arestas cujos dois lados estão em `{id} ∪ ancestors` ou em `{id} ∪ descendants`) | sim |
| `src/domain/search.ts` | `searchQuests(graph, query, limit = 8): readonly Quest[]`; `normalize(text)` remove acento e caixa; query vazia devolve `[]`; ordena por posição do match e depois por título | sim |
| `src/graph/elements.ts` | `toElements(graph): ElementDefinition[]`; `nodeLabel(quest)` | sim (tipos do Cytoscape só) |
| `src/graph/style.ts` | `stylesheet: StylesheetJson`; constantes de cor | sim |
| `src/graph/quest-graph-view.ts` | `createQuestGraphView(container, graph): QuestGraphView` com `select(id)`, `clear()`, `onSelect(listener)` | não (DOM) |
| `src/ui/panel.ts` | `renderPanel(root, graph, selected: QuestId \| null, onNavigate)` | não (DOM) |
| `src/ui/search.ts` | `createSearch(form, graph, onPick)` | não (DOM) |
| `src/main.ts` | liga tudo, hash da URL | não |
| `src/styles.css` | tema e layout responsivo | — |

`QuestGraphView.select` aplica as classes a partir de `findLineage` e dispara
os listeners; o `main.ts` renderiza o painel e atualiza o hash no listener.
Selecionar pela busca ou pelo painel chama o mesmo `select`.

## Testes

- `tests/domain/lineage.test.ts` (TDD): diamante do fixture; `edges` inclui só
  arestas dos caminhos (a→b, a→c, b→d, c→d ao selecionar d; nenhuma ao
  selecionar e); ciclo não trava; id inexistente devolve conjuntos vazios.
- `tests/domain/search.test.ts` (TDD): acento ("Ferúmbras" acha "Ferumbras"),
  caixa, query vazia, limite 8, ordem (match no início primeiro).
- `tests/graph/elements.test.ts`: 15 nós e 14 arestas do fixture pequeno; ids
  de aresta únicos (`from→to`); rótulo sem " Quest"; `kind` no `data` da aresta
  para o seletor de estilo. Roda o Cytoscape headless com o `stylesheet` e o
  layout dagre para garantir que nenhum seletor/opção quebra.
- UI (`panel`, `search`, `view`, `main`) verificada por `npm run build` e
  manualmente no browser; sem jsdom no MVP.

## Deploy

- `vite.config.ts`: `base: '/tibia-quest-graph/'`.
- `.github/workflows/deploy.yml`: `on: push (main)` + `workflow_dispatch`;
  `actions/checkout`, `actions/setup-node` (Node 24, cache npm), `npm ci`,
  `npm run build`, `actions/configure-pages`, `actions/upload-pages-artifact`
  (`dist`), `actions/deploy-pages`. Permissões `pages: write`, `id-token: write`.
- `gh repo create gabrielimmich/tibia-quest-graph --public --source=. --push`,
  depois `gh api -X POST repos/gabrielimmich/tibia-quest-graph/pages -f build_type=workflow`.
- Conferir com `gh run watch` e `curl` em `https://gabrielimmich.github.io/tibia-quest-graph/`.
- `README.md` curto: o que é, como rodar, licença/atribuição.

## Critérios de pronto

- `npm test`, `npm run typecheck`, `npm run build` verdes.
- No browser: clicar em `the-dream-courts` acende `barbarian-test`,
  `the-ice-islands`, `forgotten-knowledge`, `the-new-frontier`,
  `threatened-dreams` como ancestrais; clicar em `barbarian-test` acende os
  descendentes até `the-dream-courts`; busca "soul" lista Soul War; painel
  mostra evidência e link para cada aresta; `#soul-war` na URL abre selecionado.
- Site no ar em `https://gabrielimmich.github.io/tibia-quest-graph/`, com
  rodapé de atribuição, utilizável em largura de 400px.
