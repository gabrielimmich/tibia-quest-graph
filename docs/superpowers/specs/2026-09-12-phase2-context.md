# Fase 2: contexto, números e decomposição

Data: 2026-09-12

## Pedido

Mapear todas as quests do Tibia; a tela começa perguntando qual quest o
jogador quer e mostra a árvore de dependências dela; há uma visão geral de
todas, organizada em blocos que se interligam.

Isso reabre duas regras do `CLAUDE.md` §2 escritas para o MVP: "as outras 349
quests" e "scraper/pipeline de dados". A regra de ouro (evidence literal +
aprovação de Gabriel) continua, adaptada ao volume (ver "Aprovação híbrida").

## O que a TibiaWiki tem (levantamento de 2026-09-12, API MediaWiki)

| Medida | Valor |
|---|---|
| Páginas principais que transcluem `Template:Infobox Quest` | 395 |
| Com infobox real (`name` preenchido) | 371 |
| Dessas, `type` = mwc / event / change / exchange (não são quests) | ~85 |
| Com subpágina `/Spoiler` | 370 |
| Com seção `Requirements` / `Required Equipment` | 212 |
| Arestas candidatas só por links nessa seção (piso) | 132 |
| Estimativa incluindo menções no corpo | ~180 |
| Quests envolvidas em alguma aresta | 108 |
| Componentes conexos | 1 de 82 quests + 10 de 2–5 |
| `lvl` numérico | 351 / 371 |
| `location` distintos (primeiro lugar citado) | 240 |

Consequências:

- Grafo completo numa tela só não serve (teia de 82 + ~260 pontos soltos).
- "Blocos" não emergem da topologia; o eixo escolhido é **região do jogo**,
  com um mapa lugar → região curado (`data/regions.yaml`). A página de cada
  lugar na wiki tem `city`, o que ajuda a rascunhar o mapa.
- `unlocks` em português à mão não escala para ~290 quests: na 2b entra
  `reward` literal da wiki e `unlocks` vira opcional.

## Decisões tomadas com Gabriel

| Decisão | Escolha |
|---|---|
| Aprovação das ~180 arestas | **Híbrida**: padrão inequívoco na seção de requisitos ("Completed X Quest") entra automático como `required` com a frase literal e `reviewed: false`; casos parciais/acesso/fora da seção vão para fila de aprovação por lote. A UI marca "não revisada". |
| Eixo dos blocos | **Região do jogo** (~15 blocos); level como cor/badge |
| Ordem | 2a início e árvore → 2b dados completos → 2c blocos |

## Etapas

- **2a** `2026-09-12-start-and-tree-design.md`: tela inicial, árvore só da
  quest escolhida, rotas. Schema inalterado.
- **2b** (spec futuro): `scripts/collect.ts`, schema v2 (`reward`, `region`,
  `location`, `reviewed`; `unlocks` opcional), `data/regions.yaml`, fila de
  aprovação, ~290 quests.
- **2c** (spec futuro): visão geral por blocos de região: dagre dentro de cada
  bloco, blocos numa grade, arestas entre blocos por cima, colapsar/expandir.
  Sem dependência nova: cytoscape-dagre não faz nós compostos, e ~40 linhas
  próprias resolvem.

## Notas técnicas para a 2b

- Listar quests: `list=embeddedin&eititle=Template:Infobox Quest` (namespace
  0, sem `/`), filtrar `name` vazio e `type` ∈ {mwc, event, change, exchange}.
- Conteúdo em lote: `prop=revisions&rvslots=main` aceita 50 títulos por
  chamada (8 chamadas para todos os spoilers).
- Frase literal: HTML renderizado (`prop=text`) para quem tem template dentro
  da frase; wikitext com marcação removida serve para o resto.
- User-Agent identificando o projeto em toda chamada.
