# Fase 2c: visão geral por blocos de região

Data: 2026-09-12
Fase 2: 2a início e árvore (feito) → 2b dados completos (feito) → **2c blocos**.

## Problema

`#todas` hoje é o grafo das ~110 quests conectadas em dagre puro: uma faixa
larguíssima de componentes lado a lado, ilegível. O jogador pensa em
geografia; a visão geral deve ser organizada por região, com as ligações entre
regiões visíveis.

## Decisões

| Decisão | Escolha | Por quê |
|---|---|---|
| O que aparece | Só quests conectadas (`connectedSubgraph`), agrupadas pelo `region` | Quest isolada não tem topologia; fica na busca. O bloco mostra quantas ficaram de fora |
| Bloco | Nó composto (compound) do Cytoscape por região, rótulo "Região · N (+M sem dependências)" | Nativo do Cytoscape; arestas entre filhos de blocos diferentes desenham sozinhas |
| Layout | dagre dentro de cada bloco (`eles.layout`, `fit: false`), blocos empacotados em prateleiras (`packShelves`, ~40 linhas próprias), ordenados por tamanho | cytoscape-dagre não faz compound; sem dependência nova |
| Interação | Clique em quest = foco com linhagem (como hoje). Clique no bloco = zoom no bloco. Clique no fundo = limpa foco e volta ao todo | Explorar por região sem perder o contexto |
| "Outros" | Bloco normal, por último | Lugares não mapeados ainda aparecem |
| Celular | Mesmo grafo; pinça para zoom | Sem layout alternativo agora |

## Módulos

| Arquivo | Mudança |
|---|---|
| `src/domain/overview.ts` | `buildOverview(graph): Overview { connected: QuestGraph; blocks: Block[] }`, `Block { region, quests, isolated }` ordenado por tamanho desc, "Outros" por último; `UNMAPPED_REGION` compartilhado |
| `src/graph/pack.ts` | `packShelves(items: {id,w,h}[], maxWidth, gap): Map<id,{x,y}>` (prateleiras, esquerda→direita, cima→baixo) |
| `src/graph/elements.ts` | `toBlockElements(overview)`: pais `region:<slug>` com `label`, filhos com `parent` |
| `src/graph/style.ts` | `node:parent` (fundo translúcido, borda, rótulo no topo), `node:parent.dimmed` |
| `src/graph/quest-graph-view.ts` | `renderBlocks(overview)`: adiciona elementos, dagre por bloco, mede, empacota, `shift`, `fit`; tap em pai = `fit` animado no pai; tap no fundo = `fit` no todo |
| `src/ui/mode.ts` | `all` carrega `overview` em vez de `shown` |
| `src/ui/panel.ts` | vazio em `#todas`: "N quests conectadas em R regiões · E ligações · I sem dependências ficam na busca" |
| `src/main.ts` | `renderBlocks` no modo all |

## Testes

- `tests/domain/overview.test.ts`: blocos por região, ordem, "Outros" por
  último, contagem de isoladas por região, quest sem `region` cai em Outros.
- `tests/graph/pack.test.ts`: uma prateleira, quebra de linha, altura da
  prateleira = maior item, gap.
- `tests/graph/elements.test.ts`: `toBlockElements` gera pais e `parent`
  nos filhos; headless: dagre por bloco + `shift` não lança e filhos ficam
  dentro do pai.
- Screenshots em 1400px e 500px.

## Critérios de pronto

- `#todas` mostra blocos por região legíveis, com ligações entre blocos;
  clicar num bloco dá zoom nele; clicar numa quest destaca a linhagem através
  dos blocos; painel funciona; publicado.
