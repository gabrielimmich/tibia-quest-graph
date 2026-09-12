# Fase 2a: início e árvore da quest

Data: 2026-09-12
Fase 2 em três etapas: **2a início e árvore** → 2b dados completos → 2c visão
geral por blocos de região. Contexto e números da fase 2 em
`2026-09-12-phase2-context.md`.

## Problema

O MVP abre com o grafo inteiro e nada selecionado: "dados jogados na tela".
Com as ~290 quests da 2b isso ficaria inutilizável (1 componente de 82 nós +
~260 nós isolados). A tela precisa começar por uma pergunta e mostrar só o que
importa para a resposta.

## Decisões

| Decisão | Escolha | Por quê |
|---|---|---|
| Início | Pergunta + busca grande + 4 sugestões calculadas | Sem curadoria; sugestões = quests mais conectadas |
| Árvore | Só o `findLineage` da quest escolhida, com dagre | Sempre legível; nada esmaecido porque nada sobra |
| Clique num nó da árvore | Mostra detalhes no painel; a árvore não muda | Árvore só muda quando o usuário pede ("Ver árvore desta quest") |
| Navegar para quest fora da árvore | Re-enraíza nela | Único caso em que a árvore troca sem o botão |
| "Ver todas" | Mantém o grafo completo atual (destaque ao clicar) | A 2c substitui por blocos; não vale polir agora |
| Rotas | sem hash = início; `#todas`; `#<id>` = árvore | Botão voltar funciona; link compartilhável |
| Schema | Inalterado | Campos novos (`reward`, `region`, `reviewed`) entram com os dados, na 2b |

## Modos

```
landing  ──busca/sugestão──▶ tree(root, focus)  ◀──"Ver árvore desta"── all(focus)
   ▲                             │  clique em nó: focus muda, root não             ▲
   └──── título ─────────────────┴──────────────── "ver todas" (landing) ─────────┘
```

- **landing**: overlay sobre a área do grafo com título, frase, busca grande,
  chips de sugestão e o link "ver todas as quests no grafo". A busca do topo
  fica escondida (é redundante). O Cytoscape já existe por baixo, com tamanho
  real; overlay evita inicializar o Cytoscape em container `display: none`.
- **tree(root, focus)**: grafo recebe só `lineageSubgraph(graph, root)` e roda
  o dagre. `root` tem a classe `focus` (dourado). `focus` (o nó cujos detalhes
  estão no painel) tem a classe `inspect` (borda grossa clara). Inicialmente
  `focus = root`. Clique em nó: `focus` muda. Painel mostra "Ver árvore desta
  quest" quando `focus ≠ root`.
- **all(focus)**: comportamento atual (grafo inteiro; clique aplica
  `applyLineageClasses`). Painel mostra "Ver árvore desta quest" quando há
  foco.

Navegação pelo painel (`quest-link`): se a quest está na tela, vira `focus`;
se não está (ex.: ancestral do foco que não é ancestral da raiz), `goTree(id)`.

## Sugestões

`mostConnectedQuests(graph, 4)`: ordena por `ancestors.size + descendants.size`
desc, depois título; ignora quests isoladas. Hoje: Dream Courts, Forgotten
Knowledge, Ice Islands, New Frontier (ou empates equivalentes).

## Rotas

| Hash | Modo |
|---|---|
| vazio | landing |
| `#todas` | all, sem foco |
| `#<id válido>` | tree(root = id, focus = id) |
| outro | landing |

`goTree`/`goAll` fazem `location.hash = …` e um listener de `hashchange`
aplica o modo (assim voltar/avançar funcionam). `goLanding` usa
`history.pushState` para limpar o hash sem deixar `#` solto. Trocar o foco não
mexe no hash.

## Módulos

| Arquivo | Mudança |
|---|---|
| `src/domain/lineage.ts` | + `lineageSubgraph(graph, id): QuestGraph` |
| `src/domain/suggestions.ts` | novo: `mostConnectedQuests(graph, limit)` |
| `src/graph/lineage-classes.ts` | + `setInspect(cy, id \| null)` e classe `inspect` em `LINEAGE_CLASSES` |
| `src/graph/style.ts` | + `node.inspect` |
| `src/graph/quest-graph-view.ts` | `render(graph, root)`, `focus(id)`, `clearFocus()`, `onTap(listener)`. Sem lógica de modo. |
| `src/ui/panel.ts` | `renderPanel(root, graph, selected, { onNavigate, onShowTree? })`: botão "Ver árvore desta quest" quando `onShowTree` vier |
| `src/ui/landing.ts` | novo: `renderSuggestions(list, quests, onPick)` |
| `src/main.ts` | máquina de modos + rotas |
| `index.html`, `src/styles.css` | seção `#landing`, título vira link para o início, `body[data-mode]` |

## Testes

- `tests/domain/lineage.test.ts`: `lineageSubgraph` de `d` no diamante tem 5
  quests e 5 arestas; de `x` tem 1 quest e 0 arestas; id inexistente → grafo
  vazio.
- `tests/domain/suggestions.test.ts`: ordem por conexões e título; ignora
  isoladas; respeita limite.
- `tests/graph/lineage-classes.test.ts`: `setInspect` move a classe; `null`
  limpa.
- UI verificada por build + Edge headless (landing, árvore, "ver todas") e
  manualmente.

## Critérios de pronto

- Abrir o site sem hash mostra o início; escolher "Soul War" mostra árvore
  com 2 nós; `#the-dream-courts` abre a árvore de 6 nós; clicar em "Forgotten
  Knowledge" nela mostra os detalhes sem trocar a árvore; "Ver árvore desta
  quest" re-enraíza; título volta ao início; `#todas` mostra o grafo inteiro.
- Testes, typecheck, validate, build verdes; publicado.
