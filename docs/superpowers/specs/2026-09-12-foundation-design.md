# Fundação: scaffold + domínio

Data: 2026-09-12
Sessão 1 de 3 do MVP (fundação → dados → interface). Ver `CLAUDE.md` para o produto.

## Objetivo

Deixar o repositório pronto para as duas sessões seguintes:

- **dados**: `data/quests.yaml` com as 15 quests, validado por `npm run validate`;
- **interface**: `main.ts` importa `virtual:quests` e recebe dados já validados.

Entregas desta sessão: projeto Vite + TypeScript strict + Vitest, tipos e
travessia do grafo com TDD, validação do YAML com todas as regras, script
`validate`, plugin Vite que carrega o YAML no build, git inicializado.

Fora desta sessão: dados reais, Cytoscape/dagre, painel, busca, deploy, `base`
do Vite (depende de GitHub vs Cloudflare Pages; decide-se na sessão de interface).

## Decisões

| Decisão | Escolha | Por quê |
|---|---|---|
| Travessia segue quais arestas | Todas (`required`, `access`, `recommended`) | Sem parâmetro (YAGNI). A UI distingue `recommended` visualmente. |
| YAML → browser | Plugin Vite próprio (~20 linhas) + `yaml` como devDependency | Parser fora do bundle; YAML inválido quebra o build. |
| `npm run validate` | `node scripts/validate.ts` nativo (Node 24 executa TS) | Zero deps. Script é script, não teste. |
| Schema | Validador à mão, sem `zod` | Regra do `CLAUDE.md`: 40 linhas próprias antes de um pacote. |
| `level` | Opcional | Há quest sem nível mínimo. |
| Direção da aresta | `from` → `to` = "from é pré-requisito de to" | Como no exemplo do `CLAUDE.md`. |

## Estrutura

```
data/quests.yaml            fonte única (nesta sessão: 2 quests do exemplo, edges: [])
scripts/validate.ts         lê YAML → parseQuestData → imprime erros, exit 1 se falhar
src/domain/
  quest.ts                  Quest, Edge, EdgeKind, QuestId, QuestGraph, buildQuestGraph
  parse.ts                  parseQuestData(raw: unknown): ParseResult
  traversal.ts              findAllPrerequisites, findAllUnlocked, findCycle
  index.ts                  re-exports
src/graph/, src/ui/         vazios (sessão de interface)
src/vite-plugin-quests.ts   transforma data/quests.yaml em módulo virtual, valida no build
tests/domain/*.test.ts      fixtures montadas à mão com buildQuestGraph
tests/vite-plugin-quests.test.ts
```

Dependências (todas dev): `vite`, `typescript`, `vitest`, `yaml`.

`tsconfig`: `strict`, `noUncheckedIndexedAccess`, `erasableSyntaxOnly`,
`allowImportingTsExtensions`, `verbatimModuleSyntax`, `noEmit`. Imports de
arquivos locais sempre com extensão `.ts`, exigência do Node nativo.
`erasableSyntaxOnly` proíbe `enum` e `namespace`, alinhado com "união
discriminada em vez de campos opcionais".

## Domínio (`src/domain/`, puro: sem `fetch`, `fs`, `Date.now()`)

```ts
type QuestId = string & { readonly __brand: 'QuestId' }
type EdgeKind = 'required' | 'access' | 'recommended'

interface Quest {
  id: QuestId
  title: string
  level?: number
  premium: boolean
  wiki: string
  unlocks: string
}

interface Edge {
  from: QuestId
  to: QuestId
  kind: EdgeKind
  evidence: string
  source: string
}

interface QuestGraph {
  quests: ReadonlyMap<QuestId, Quest>
  edges: readonly Edge[]
  incoming: ReadonlyMap<QuestId, readonly Edge[]>
  outgoing: ReadonlyMap<QuestId, readonly Edge[]>
}

buildQuestGraph(quests: readonly Quest[], edges: readonly Edge[]): QuestGraph
findAllPrerequisites(graph: QuestGraph, id: QuestId): ReadonlySet<QuestId>
findAllUnlocked(graph: QuestGraph, id: QuestId): ReadonlySet<QuestId>
findCycle(graph: QuestGraph): readonly QuestId[] | null
```

- `buildQuestGraph` só monta os índices; não valida. Toda quest aparece como
  chave em `incoming` e `outgoing`, mesmo com lista vazia.
- `findAllPrerequisites` devolve ancestrais transitivos, excluindo o próprio
  id. `findAllUnlocked` devolve descendentes transitivos, idem. Id inexistente
  devolve conjunto vazio.
- `findCycle` devolve o caminho fechado (`[a, b, c, a]`) para compor a
  mensagem de erro, ou `null`.
- A travessia devolve só ids. Quem quer as arestas do caminho (a UI, para
  mostrar evidência) consulta `incoming`/`outgoing`.

## Validação (`src/domain/parse.ts`)

```ts
type ParseResult =
  | { ok: true; graph: QuestGraph }
  | { ok: false; errors: readonly string[] }
```

Acumula todos os erros em vez de parar no primeiro. Regras, cada uma com
mensagem que aponta o ofensor:

| Regra | Exemplo de mensagem |
|---|---|
| raiz é objeto com `quests` e `edges` como listas | `"quests" deve ser uma lista` |
| campos de quest com tipo certo; `level`, se presente, inteiro > 0 | `quest[3]: "premium" deve ser boolean` |
| `id` em kebab-case (`^[a-z0-9]+(-[a-z0-9]+)*$`), único | `id duplicado: "soul-war"` |
| `wiki` e `source` começam com `https://tibia.fandom.com/wiki/` | `edge soul-war→feaster-of-souls: source não é página da TibiaWiki` |
| `from` e `to` existem em `quests`; `from ≠ to` | `edge #2: "to" aponta para id inexistente "dream-court"` |
| par `(from, to)` único | `aresta duplicada: the-inquisition→the-pits-of-inferno` |
| `kind` ∈ `required`, `access`, `recommended` | `edge …: kind inválido "optional"` |
| `evidence` não vazia após `trim` e diferente do placeholder do `CLAUDE.md` | `edge …: evidence obrigatória (regra de ouro)` |
| sem ciclo (só verificado se as regras anteriores das arestas passarem) | `ciclo: a → b → c → a` |

Campos desconhecidos em quest ou edge são erro: evita typo silencioso
(`evidance`).

## Consumidores

Todos passam por `parseQuestData`. `fs` aparece só em dois lugares:

- **`scripts/validate.ts`**: `readFileSync('data/quests.yaml')` → `yaml.parse`
  → `parseQuestData`. Sucesso: imprime contagem de quests e arestas. Falha:
  imprime cada erro em uma linha, `process.exit(1)`.
- **`src/vite-plugin-quests.ts`**: resolve `virtual:quests`, faz a mesma
  leitura e emite `export default <JSON>` com os dados brutos validados
  (`{ quests, edges }`). Falha de validação lança, quebrando o build. Adiciona
  o YAML ao watch (`this.addWatchFile`) para o dev server recarregar. O
  `main.ts` da sessão de interface chama `buildQuestGraph` sobre esse JSON,
  porque `Map` não serializa.
- Tipo do módulo virtual declarado em `src/virtual-quests.d.ts`.

Scripts do `package.json`:

```
dev        vite
test       vitest run
typecheck  tsc --noEmit
validate   node scripts/validate.ts
build      npm run validate && npm run typecheck && vite build
```

## Testes (Vitest)

- `tests/domain/traversal.test.ts` (TDD): fixture de ~6 nós via
  `buildQuestGraph`. Casos: cadeia linear (ancestrais e descendentes
  transitivos), diamante (A→B, A→C, B→D, C→D: D tem {A, B, C}, sem
  duplicata), nó isolado (conjuntos vazios), id inexistente, `findCycle` em
  grafo com ciclo (devolve caminho fechado) e sem ciclo (`null`).
- `tests/domain/parse.test.ts`: caso feliz; um teste por regra da tabela;
  teste de que múltiplos erros são acumulados.
- `tests/vite-plugin-quests.test.ts`: YAML inválido lança; válido devolve
  módulo com `export default`.
- Nenhum teste lê `data/quests.yaml`. Fixtures são literais no teste.

## Dados desta sessão

`data/quests.yaml` com as duas quests do exemplo do `CLAUDE.md` e `edges: []`.
A aresta do exemplo fica de fora: a evidence é placeholder, e a regra de ouro
não aceita placeholder. `npm run validate` passa com 2 quests e 0 arestas.

## Git

`git init -b main`, `.gitignore` (`node_modules`, `dist`). Um commit por
marco: spec, scaffold, domínio + travessia, validação, plugin + validate.
Sem remoto ainda; push fica para quando Gabriel criar o repositório.

## Critérios de pronto

- `npm ci && npm test && npm run typecheck && npm run validate && npm run build` passam.
- Zero `any`, zero `@ts-ignore`, zero I/O em `src/domain/`.
- `import graph from 'virtual:quests'` tipado e funcionando num `main.ts` mínimo.
