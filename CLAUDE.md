# CLAUDE.md

Instruções permanentes deste repositório. Leia antes de qualquer tarefa.

---

## 1. O produto

**tibia-quest-graph**: mind map navegável de dependências entre quests do Tibia.

O jogador clica em uma quest e vê:

- **o que precisa antes**: todos os pré-requisitos, incluindo os indiretos;
- **o que ela libera**: todas as quests que ficam acessíveis depois dela;
- **por quê**: a frase da TibiaWiki que comprova cada ligação.

Nada equivalente existe hoje. O que existe são tabelas planas. Nenhuma mostra a
topologia, que é justamente a parte difícil de descobrir jogando.

---

## 2. Escopo do MVP

O MVP é **a versão final funcionando, com 15 quests**. Não é protótipo descartável.

Pronto quando:

- [ ] as 15 quests da seção 3 estão no grafo com suas dependências;
- [ ] clicar em um nó destaca ancestrais e descendentes, com o resto esmaecido;
- [ ] busca por nome funciona;
- [ ] cada aresta mostra a evidência e linka para a página da wiki;
- [ ] o site está publicado e abre em celular.

### Fora do escopo (não implemente, não sugira)

Scraper automatizado, extração por LLM, pipeline de build de dados, chave de API,
backend, banco de dados, login, marcar progresso do jogador, filtros avançados,
as outras 349 quests.

Tudo isso é fase 2, e será mais fácil de construir depois que o formato dos dados
estiver validado pelo uso.

---

## 3. As 15 quests

Escolhidas por formarem cadeias reais de múltiplos saltos, que é o que faz o mind
map valer a pena.

```
The New Frontier Quest              Threatened Dreams Quest
Children of the Revolution Quest    The Dream Courts Quest
Wrath of the Emperor Quest          The Secret Library Quest
In Service of Yalahar Quest         Forgotten Knowledge Quest
The Inquisition Quest               Feaster of Souls Quest
The Pits of Inferno Quest           Soul War Quest
Ferumbras' Ascendant Quest          Barbarian Test Quest
The Ice Islands Quest
```

---

## 4. Os dados

Fonte única: **`data/quests.yaml`**, escrito à mão, versionado no git.
Não existe pipeline. Com 15 quests, curadoria manual é mais rápida e mais confiável.

```yaml
quests:
  - id: the-new-frontier
    title: The New Frontier Quest
    level: 50
    premium: true
    wiki: https://tibia.fandom.com/wiki/The_New_Frontier_Quest
    unlocks: "Acesso ao continente de Zao"

  - id: children-of-the-revolution
    title: Children of the Revolution Quest
    level: 60
    premium: true
    wiki: https://tibia.fandom.com/wiki/Children_of_the_Revolution_Quest
    unlocks: "Continuação da linha de Zao"

edges:
  - from: the-new-frontier
    to: children-of-the-revolution
    kind: required          # required | access | recommended
    evidence: "<trecho literal copiado da página da wiki>"
    source: https://tibia.fandom.com/wiki/Children_of_the_Revolution_Quest
```

### Regra de ouro

> **Nenhuma aresta entra sem `evidence` copiada literalmente da página da wiki.**

Isto vale especialmente para você, agente. Você tem conhecimento de treino sobre
Tibia e ele **não conta como fonte**. Se for propor uma dependência, abra a página,
cite o trecho, e deixe o Gabriel aprovar. Uma dependência que você "sabe" mas não
consegue citar é uma hipótese, e hipótese fica de fora do arquivo.

Na dúvida entre criar ou não criar uma aresta: não crie, e pergunte.

### Regra do DAG

O grafo não pode ter ciclo. Se A exige B e B exige A, alguém errou a leitura da
wiki. O teste de validação quebra o build nesse caso.

---

## 5. Stack

TypeScript `strict`, Vite, Cytoscape.js com layout `dagre` (hierárquico, que é o
que torna um grafo de dependência legível em vez de teia de aranha), Vitest.
Deploy estático no GitHub Pages ou Cloudflare Pages.

```
data/quests.yaml      # fonte única da verdade
src/
  domain/             # tipos, validação, travessia do grafo. Puro, sem I/O.
  graph/              # setup do Cytoscape, layout, interação
  ui/                 # painel lateral, busca
tests/
```

Não adicione dependência sem justificar. Preferimos 40 linhas próprias a um pacote.

---

## 6. Qualidade

- **Zero `any`, zero `@ts-ignore`.** Se aparecer, o tipo está errado, não o compilador.
- **`domain/` é puro**: sem `fetch`, sem `fs`, sem `Date.now()`. Lógica de grafo
  testável isoladamente.
- **Nomes do domínio**: `findAllPrerequisites`, não `processData`.
- **Comentário explica *por quê***, nunca *o quê*. Se o código precisa de comentário
  para ser entendido, reescreva o código.
- **Estado inválido irrepresentável**: união discriminada em vez de cinco campos
  opcionais.
- **TDD na travessia do grafo.** Ancestrais, descendentes e detecção de ciclo são
  a lógica que realmente importa aqui e são triviais de testar. Fixture pequena,
  grafo montado à mão, sem ler arquivo.
- **Texto da wiki vai para a tela com `textContent`, nunca `innerHTML`.** É conteúdo
  editável por terceiros.

---

## 7. Workflow com Superpowers

- `/superpowers:brainstorm` antes de decisão de design aberta.
- `/superpowers:write-plan` antes de implementar, `/superpowers:execute-plan` para executar.
- `requesting-code-review` antes de fechar uma etapa.
- Preencher dados e construir interface são tarefas de sessões separadas.

---

## 8. Comandos

```bash
npm ci
npm run dev
npm test
npm run typecheck
npm run validate    # schema do YAML + ausência de ciclo + evidence presente
npm run build
```

---

## 9. Licença

Conteúdo da TibiaWiki é CC-BY-SA: creditar a fonte com link é obrigação legal, e
cada aresta já carrega o seu. Tibia é marca da CipSoft. Fansite não oficial, e o
rodapé deve dizer isso.