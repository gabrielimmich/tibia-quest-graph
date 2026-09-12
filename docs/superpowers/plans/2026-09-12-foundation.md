# Fundação (scaffold + domínio) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repositório com Vite + TypeScript strict + Vitest, domínio puro do grafo de quests (tipos, travessia, validação) com TDD, `npm run validate` e plugin Vite que entrega `data/quests.yaml` validado ao browser.

**Architecture:** `src/domain/` é puro (sem I/O) e expõe `buildQuestGraph`, `findAllPrerequisites`, `findAllUnlocked`, `findCycle` e `parseQuestData(raw: unknown)`. Um único leitor com `fs` (`src/quest-file.ts`) alimenta tanto `scripts/validate.ts` quanto `src/vite-plugin-quests.ts`, que expõe o módulo virtual `virtual:quests` já validado e serializado. Spec: `docs/superpowers/specs/2026-09-12-foundation-design.md`.

**Tech Stack:** Node 24 (executa `.ts` nativamente), TypeScript 7.0.2, Vite 8.3.0, Vitest 5.0.0, `yaml` 2.9.1, `@types/node`.

## Global Constraints

- Zero `any`, zero `@ts-ignore`, zero `as unknown as`. `Array.isArray` devolve `any[]`: sempre embrulhar num type guard próprio.
- `src/domain/` não importa `node:*`, `vite`, `yaml`, nem usa `fetch`/`Date.now()`.
- Imports de arquivos locais sempre com extensão `.ts` (exigência do Node nativo).
- Sem `enum`, `namespace`, parameter properties (`erasableSyntaxOnly`).
- Comentário só explica *por quê*. Nomes do domínio: `findAllPrerequisites`, não `processData`.
- Mensagens de erro de validação em português, apontando o ofensor.
- Nenhuma aresta com `evidence` placeholder entra em `data/quests.yaml`.
- Commits terminam com `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- Sem dependência além de: `vite`, `vitest`, `typescript`, `yaml`, `@types/node` (todas dev).

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `package.json`, `tsconfig.json`, `.gitignore` | scaffold |
| `vitest.config.ts` | só `include: tests/**/*.test.ts` |
| `vite.config.ts` | registra `questsPlugin` |
| `index.html`, `src/main.ts` | entrada mínima: importa `virtual:quests`, monta grafo, mostra contagem |
| `src/virtual-quests.d.ts` | tipo do módulo virtual |
| `src/domain/quest.ts` | tipos + `buildQuestGraph` + `questId` |
| `src/domain/traversal.ts` | `findAllPrerequisites`, `findAllUnlocked`, `findCycle` |
| `src/domain/parse.ts` | `parseQuestData(raw: unknown): ParseResult` |
| `src/domain/index.ts` | re-exports |
| `src/quest-file.ts` | `readQuestFile(file): ParseResult` — único lugar com `fs` + `yaml` |
| `src/vite-plugin-quests.ts` | `questsPlugin({ file })`, `questsModuleSource(file)` |
| `scripts/validate.ts` | CLI: imprime erros, exit 1 |
| `data/quests.yaml` | fixture: 2 quests do `CLAUDE.md`, `edges: []` |
| `tests/domain/fixtures.ts` | `quest()`, `edge()`, `id()` para montar grafos à mão |
| `tests/domain/quest.test.ts` | índices de `buildQuestGraph` |
| `tests/domain/traversal.test.ts` | travessia e ciclo |
| `tests/domain/parse.test.ts` | uma regra por teste |
| `tests/quest-file.test.ts` | YAML sintaticamente inválido |
| `tests/vite-plugin-quests.test.ts` | `questsModuleSource` válido/inválido |

---

### Task 1: Scaffold + `buildQuestGraph`

**Files:**
- Create: `package.json`, `tsconfig.json`, `.gitignore`, `vitest.config.ts`
- Create: `src/domain/quest.ts`, `tests/domain/fixtures.ts`, `tests/domain/quest.test.ts`

**Interfaces:**
- Produces: `QuestId`, `EdgeKind`, `EDGE_KINDS`, `Quest`, `Edge`, `QuestGraph`, `questId(raw: string): QuestId`, `buildQuestGraph(quests: readonly Quest[], edges: readonly Edge[]): QuestGraph`

- [ ] **Step 1: Criar `package.json`**

```json
{
  "name": "tibia-quest-graph",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "validate": "node scripts/validate.ts",
    "build": "npm run validate && npm run typecheck && vite build",
    "preview": "vite preview"
  }
}
```

- [ ] **Step 2: Instalar dependências**

Run: `npm install -D vite@8.3.0 vitest@5.0.0 typescript@7.0.2 yaml@2.9.1 @types/node@^24`
Expected: `package-lock.json` criado, `devDependencies` com as 5 entradas. Se `@types/node@^24` não existir no registry, usar `@types/node@^22`.

- [ ] **Step 3: Criar `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["node"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "erasableSyntaxOnly": true,
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src", "tests", "scripts", "vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 4: Criar `.gitignore` e `vitest.config.ts`**

`.gitignore`:
```
node_modules
dist
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] },
})
```

- [ ] **Step 5: Criar `tests/domain/fixtures.ts`**

```ts
import { questId, type Edge, type EdgeKind, type Quest } from '../../src/domain/quest.ts'

export const id = questId

export function quest(rawId: string): Quest {
  return {
    id: questId(rawId),
    title: rawId,
    premium: false,
    wiki: `https://tibia.fandom.com/wiki/${rawId}`,
    unlocks: '',
  }
}

export function edge(from: string, to: string, kind: EdgeKind = 'required'): Edge {
  return {
    from: questId(from),
    to: questId(to),
    kind,
    evidence: `${to} requires ${from}`,
    source: `https://tibia.fandom.com/wiki/${to}`,
  }
}
```

- [ ] **Step 6: Escrever o teste que falha — `tests/domain/quest.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { buildQuestGraph } from '../../src/domain/quest.ts'
import { edge, id, quest } from './fixtures.ts'

describe('buildQuestGraph', () => {
  const ab = edge('a', 'b')
  const ac = edge('a', 'c', 'recommended')
  const graph = buildQuestGraph([quest('a'), quest('b'), quest('c'), quest('d')], [ab, ac])

  it('indexa quests por id', () => {
    expect(graph.quests.get(id('a'))?.title).toBe('a')
    expect(graph.quests.size).toBe(4)
  })

  it('indexa arestas de saída pelo from', () => {
    expect(graph.outgoing.get(id('a'))).toEqual([ab, ac])
    expect(graph.outgoing.get(id('b'))).toEqual([])
  })

  it('indexa arestas de entrada pelo to', () => {
    expect(graph.incoming.get(id('b'))).toEqual([ab])
    expect(graph.incoming.get(id('a'))).toEqual([])
  })

  it('toda quest tem entrada nos índices, mesmo isolada', () => {
    expect(graph.incoming.has(id('d'))).toBe(true)
    expect(graph.outgoing.has(id('d'))).toBe(true)
  })

  it('preserva a lista de arestas na ordem original', () => {
    expect(graph.edges).toEqual([ab, ac])
  })
})
```

- [ ] **Step 7: Rodar e ver falhar**

Run: `npx vitest run tests/domain/quest.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/domain/quest.ts"`.

- [ ] **Step 8: Implementar `src/domain/quest.ts`**

```ts
export type QuestId = string & { readonly __brand: 'QuestId' }

export const EDGE_KINDS = ['required', 'access', 'recommended'] as const
export type EdgeKind = (typeof EDGE_KINDS)[number]

export interface Quest {
  readonly id: QuestId
  readonly title: string
  readonly level?: number
  readonly premium: boolean
  readonly wiki: string
  readonly unlocks: string
}

export interface Edge {
  readonly from: QuestId
  readonly to: QuestId
  readonly kind: EdgeKind
  readonly evidence: string
  readonly source: string
}

export interface QuestGraph {
  readonly quests: ReadonlyMap<QuestId, Quest>
  readonly edges: readonly Edge[]
  readonly incoming: ReadonlyMap<QuestId, readonly Edge[]>
  readonly outgoing: ReadonlyMap<QuestId, readonly Edge[]>
}

export function questId(raw: string): QuestId {
  return raw as QuestId
}

// Só monta índices. Consistência (ids existentes, ausência de ciclo) é
// responsabilidade de parseQuestData, para que fixtures de teste possam
// montar grafos inválidos de propósito.
export function buildQuestGraph(quests: readonly Quest[], edges: readonly Edge[]): QuestGraph {
  const byId = new Map<QuestId, Quest>()
  const incoming = new Map<QuestId, Edge[]>()
  const outgoing = new Map<QuestId, Edge[]>()

  for (const quest of quests) {
    byId.set(quest.id, quest)
    incoming.set(quest.id, [])
    outgoing.set(quest.id, [])
  }
  for (const edge of edges) {
    outgoing.get(edge.from)?.push(edge)
    incoming.get(edge.to)?.push(edge)
  }

  return { quests: byId, edges: [...edges], incoming, outgoing }
}
```

- [ ] **Step 9: Rodar e ver passar**

Run: `npx vitest run tests/domain/quest.test.ts && npx tsc --noEmit`
Expected: `Tests 5 passed`, tsc sem saída.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json tsconfig.json .gitignore vitest.config.ts src/domain/quest.ts tests/domain/fixtures.ts tests/domain/quest.test.ts
git commit -m "feat: scaffold Vite/TS/Vitest e buildQuestGraph"
```

---

### Task 2: Travessia — `findAllPrerequisites`, `findAllUnlocked`, `findCycle`

**Files:**
- Create: `src/domain/traversal.ts`, `tests/domain/traversal.test.ts`

**Interfaces:**
- Consumes: `QuestGraph`, `QuestId`, `Edge`, `buildQuestGraph` de `src/domain/quest.ts`
- Produces: `findAllPrerequisites(graph, id): ReadonlySet<QuestId>`, `findAllUnlocked(graph, id): ReadonlySet<QuestId>`, `findCycle(graph): readonly QuestId[] | null`

- [ ] **Step 1: Escrever o teste que falha — `tests/domain/traversal.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { buildQuestGraph } from '../../src/domain/quest.ts'
import { findAllPrerequisites, findAllUnlocked, findCycle } from '../../src/domain/traversal.ts'
import { edge, id, quest } from './fixtures.ts'

// Diamante a→b, a→c, b→d, c→d (a→c é recommended) mais e isolada.
const diamond = buildQuestGraph(
  [quest('a'), quest('b'), quest('c'), quest('d'), quest('e')],
  [edge('a', 'b'), edge('a', 'c', 'recommended'), edge('b', 'd', 'access'), edge('c', 'd')],
)

const ids = (set: ReadonlySet<string>) => [...set].sort()

describe('findAllPrerequisites', () => {
  it('devolve ancestrais transitivos sem duplicar o diamante', () => {
    expect(ids(findAllPrerequisites(diamond, id('d')))).toEqual(['a', 'b', 'c'])
  })

  it('segue arestas recommended', () => {
    expect(ids(findAllPrerequisites(diamond, id('c')))).toEqual(['a'])
  })

  it('raiz não tem pré-requisitos', () => {
    expect(findAllPrerequisites(diamond, id('a')).size).toBe(0)
  })

  it('quest isolada e id inexistente devolvem vazio', () => {
    expect(findAllPrerequisites(diamond, id('e')).size).toBe(0)
    expect(findAllPrerequisites(diamond, id('zzz')).size).toBe(0)
  })

  it('não inclui a própria quest mesmo num ciclo', () => {
    const cyclic = buildQuestGraph([quest('a'), quest('b')], [edge('a', 'b'), edge('b', 'a')])
    expect(ids(findAllPrerequisites(cyclic, id('a')))).toEqual(['b'])
  })
})

describe('findAllUnlocked', () => {
  it('devolve descendentes transitivos', () => {
    expect(ids(findAllUnlocked(diamond, id('a')))).toEqual(['b', 'c', 'd'])
  })

  it('folha não libera nada', () => {
    expect(findAllUnlocked(diamond, id('d')).size).toBe(0)
  })

  it('quest isolada e id inexistente devolvem vazio', () => {
    expect(findAllUnlocked(diamond, id('e')).size).toBe(0)
    expect(findAllUnlocked(diamond, id('zzz')).size).toBe(0)
  })
})

describe('findCycle', () => {
  it('devolve null num DAG', () => {
    expect(findCycle(diamond)).toBeNull()
  })

  it('devolve o caminho fechado do ciclo', () => {
    const cyclic = buildQuestGraph(
      [quest('a'), quest('b'), quest('c')],
      [edge('a', 'b'), edge('b', 'c'), edge('c', 'a')],
    )
    expect(findCycle(cyclic)).toEqual(['a', 'b', 'c', 'a'])
  })

  it('detecta ciclo que não passa pela primeira quest', () => {
    const cyclic = buildQuestGraph(
      [quest('x'), quest('a'), quest('b')],
      [edge('x', 'a'), edge('a', 'b'), edge('b', 'a')],
    )
    expect(findCycle(cyclic)).toEqual(['a', 'b', 'a'])
  })

  it('detecta auto-referência', () => {
    const selfLoop = buildQuestGraph([quest('a')], [edge('a', 'a')])
    expect(findCycle(selfLoop)).toEqual(['a', 'a'])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/domain/traversal.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/domain/traversal.ts"`.

- [ ] **Step 3: Implementar `src/domain/traversal.ts`**

```ts
import type { Edge, QuestGraph, QuestId } from './quest.ts'

export function findAllPrerequisites(graph: QuestGraph, id: QuestId): ReadonlySet<QuestId> {
  return collectReachable(graph.incoming, id, (edge) => edge.from)
}

export function findAllUnlocked(graph: QuestGraph, id: QuestId): ReadonlySet<QuestId> {
  return collectReachable(graph.outgoing, id, (edge) => edge.to)
}

function collectReachable(
  adjacency: ReadonlyMap<QuestId, readonly Edge[]>,
  start: QuestId,
  next: (edge: Edge) => QuestId,
): ReadonlySet<QuestId> {
  const seen = new Set<QuestId>()
  const pending = [start]
  for (let current = pending.pop(); current !== undefined; current = pending.pop()) {
    for (const edge of adjacency.get(current) ?? []) {
      const neighbour = next(edge)
      if (!seen.has(neighbour)) {
        seen.add(neighbour)
        pending.push(neighbour)
      }
    }
  }
  // Num ciclo a busca volta ao ponto de partida; o jogador não é
  // pré-requisito de si mesmo.
  seen.delete(start)
  return seen
}

// DFS com três estados. Devolve o caminho fechado (ex.: [a, b, c, a]) para
// que a mensagem de validação mostre exatamente onde a leitura da wiki errou.
export function findCycle(graph: QuestGraph): readonly QuestId[] | null {
  const state = new Map<QuestId, 'visiting' | 'done'>()
  const path: QuestId[] = []

  const visit = (id: QuestId): readonly QuestId[] | null => {
    const mark = state.get(id)
    if (mark === 'visiting') return [...path.slice(path.indexOf(id)), id]
    if (mark === 'done') return null

    state.set(id, 'visiting')
    path.push(id)
    for (const edge of graph.outgoing.get(id) ?? []) {
      const cycle = visit(edge.to)
      if (cycle) return cycle
    }
    path.pop()
    state.set(id, 'done')
    return null
  }

  for (const id of graph.quests.keys()) {
    const cycle = visit(id)
    if (cycle) return cycle
  }
  return null
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/domain/traversal.test.ts && npx tsc --noEmit`
Expected: `Tests 12 passed`, tsc sem saída.

- [ ] **Step 5: Commit**

```bash
git add src/domain/traversal.ts tests/domain/traversal.test.ts
git commit -m "feat: travessia do grafo (ancestrais, descendentes, ciclo)"
```

---

### Task 3: Validação — `parseQuestData`

**Files:**
- Create: `src/domain/parse.ts`, `src/domain/index.ts`, `tests/domain/parse.test.ts`

**Interfaces:**
- Consumes: `EDGE_KINDS`, `buildQuestGraph`, `questId`, tipos de `quest.ts`; `findCycle` de `traversal.ts`
- Produces: `ParseResult`, `parseQuestData(raw: unknown): ParseResult`, `EVIDENCE_PLACEHOLDER`, `WIKI_PREFIX`

- [ ] **Step 1: Escrever o teste que falha — `tests/domain/parse.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { parseQuestData } from '../../src/domain/parse.ts'
import { questId } from '../../src/domain/quest.ts'

const WIKI = 'https://tibia.fandom.com/wiki/'

type Raw = Record<string, unknown>

const quest = (id: string, patch: Raw = {}): Raw => ({
  id,
  title: `${id} Quest`,
  premium: true,
  wiki: `${WIKI}${id}`,
  unlocks: 'algo',
  ...patch,
})

const edge = (from: string, to: string, patch: Raw = {}): Raw => ({
  from,
  to,
  kind: 'required',
  evidence: `You need ${from} to start ${to}.`,
  source: `${WIKI}${to}`,
  ...patch,
})

const data = (patch: Raw = {}): Raw => ({
  quests: [quest('a', { level: 50 }), quest('b')],
  edges: [edge('a', 'b')],
  ...patch,
})

function errorsOf(raw: unknown): string {
  const result = parseQuestData(raw)
  return result.ok ? '' : result.errors.join('\n')
}

describe('parseQuestData', () => {
  it('aceita dados válidos e monta o grafo', () => {
    const result = parseQuestData(data())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.graph.quests.size).toBe(2)
    expect(result.graph.edges).toHaveLength(1)
    expect(result.graph.quests.get(questId('a'))?.level).toBe(50)
  })

  it('aceita quest sem level', () => {
    const result = parseQuestData(data({ quests: [quest('a'), quest('b')] }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect([...result.graph.quests.values()][0]).not.toHaveProperty('level')
  })

  it('rejeita raiz que não é objeto', () => {
    expect(errorsOf('nope')).toContain('raiz deve ser um objeto')
    expect(errorsOf(null)).toContain('raiz deve ser um objeto')
  })

  it('rejeita quests/edges que não são listas', () => {
    const errors = errorsOf({ quests: {}, edges: 'x' })
    expect(errors).toContain('"quests" deve ser uma lista')
    expect(errors).toContain('"edges" deve ser uma lista')
  })

  it('rejeita campo de quest com tipo errado', () => {
    expect(errorsOf(data({ quests: [quest('a', { premium: 'yes' }), quest('b')] }))).toContain(
      'quest[0]: "premium" deve ser boolean',
    )
    expect(errorsOf(data({ quests: [quest('a', { title: '' }), quest('b')] }))).toContain(
      'quest[0]: "title" deve ser texto não vazio',
    )
  })

  it('rejeita level que não é inteiro positivo', () => {
    expect(errorsOf(data({ quests: [quest('a', { level: 0 }), quest('b')] }))).toContain('"level"')
    expect(errorsOf(data({ quests: [quest('a', { level: 1.5 }), quest('b')] }))).toContain('"level"')
    expect(errorsOf(data({ quests: [quest('a', { level: '50' }), quest('b')] }))).toContain('"level"')
  })

  it('rejeita id fora do kebab-case', () => {
    expect(errorsOf({ quests: [quest('Soul War')], edges: [] })).toContain('kebab-case')
    expect(errorsOf({ quests: [quest('soul_war')], edges: [] })).toContain('kebab-case')
  })

  it('rejeita id duplicado', () => {
    expect(errorsOf({ quests: [quest('a'), quest('a')], edges: [] })).toContain('id duplicado: "a"')
  })

  it('rejeita wiki e source fora da TibiaWiki', () => {
    expect(errorsOf({ quests: [quest('a', { wiki: 'https://example.com/a' })], edges: [] })).toContain(
      '"wiki" não é página da TibiaWiki',
    )
    expect(errorsOf(data({ edges: [edge('a', 'b', { source: 'http://tibia.fandom.com/wiki/b' })] }))).toContain(
      '"source" não é página da TibiaWiki',
    )
  })

  it('rejeita aresta apontando para id inexistente', () => {
    expect(errorsOf(data({ edges: [edge('a', 'zzz')] }))).toContain('"to" aponta para id inexistente "zzz"')
    expect(errorsOf(data({ edges: [edge('zzz', 'b')] }))).toContain('"from" aponta para id inexistente "zzz"')
  })

  it('rejeita auto-referência', () => {
    expect(errorsOf(data({ edges: [edge('a', 'a')] }))).toContain('não pode depender de si mesma')
  })

  it('rejeita aresta duplicada', () => {
    expect(errorsOf(data({ edges: [edge('a', 'b'), edge('a', 'b', { kind: 'access' })] }))).toContain(
      'aresta duplicada: a→b',
    )
  })

  it('rejeita kind desconhecido', () => {
    expect(errorsOf(data({ edges: [edge('a', 'b', { kind: 'optional' })] }))).toContain('kind inválido "optional"')
  })

  it('rejeita evidence vazia ou placeholder (regra de ouro)', () => {
    expect(errorsOf(data({ edges: [edge('a', 'b', { evidence: '   ' })] }))).toContain('regra de ouro')
    expect(
      errorsOf(data({ edges: [edge('a', 'b', { evidence: '<trecho literal copiado da página da wiki>' })] })),
    ).toContain('regra de ouro')
  })

  it('rejeita campo desconhecido', () => {
    expect(errorsOf(data({ edges: [edge('a', 'b', { evidance: 'typo' })] }))).toContain(
      'campo desconhecido "evidance"',
    )
    expect(errorsOf(data({ quests: [quest('a', { lvl: 1 }), quest('b')] }))).toContain('campo desconhecido "lvl"')
  })

  it('rejeita ciclo com o caminho', () => {
    expect(errorsOf(data({ edges: [edge('a', 'b'), edge('b', 'a')] }))).toContain('ciclo: a → b → a')
  })

  it('acumula vários erros em vez de parar no primeiro', () => {
    const result = parseQuestData({
      quests: [quest('a', { premium: 'x' }), quest('a')],
      edges: [edge('a', 'zzz', { kind: 'nope' })],
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.length).toBeGreaterThanOrEqual(4)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/domain/parse.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/domain/parse.ts"`.

- [ ] **Step 3: Implementar `src/domain/parse.ts`**

```ts
import {
  EDGE_KINDS,
  buildQuestGraph,
  questId,
  type Edge,
  type EdgeKind,
  type Quest,
  type QuestGraph,
} from './quest.ts'
import { findCycle } from './traversal.ts'

export type ParseResult =
  | { readonly ok: true; readonly graph: QuestGraph }
  | { readonly ok: false; readonly errors: readonly string[] }

export const WIKI_PREFIX = 'https://tibia.fandom.com/wiki/'
export const EVIDENCE_PLACEHOLDER = '<trecho literal copiado da página da wiki>'

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
const QUEST_FIELDS: ReadonlySet<string> = new Set(['id', 'title', 'level', 'premium', 'wiki', 'unlocks'])
const EDGE_FIELDS: ReadonlySet<string> = new Set(['from', 'to', 'kind', 'evidence', 'source'])

type Raw = Record<string, unknown>

// Acumula todos os erros em vez de parar no primeiro: quem edita o YAML à
// mão quer a lista inteira de uma vez.
export function parseQuestData(raw: unknown): ParseResult {
  if (!isRecord(raw)) return { ok: false, errors: ['raiz deve ser um objeto com "quests" e "edges"'] }

  const errors: string[] = []
  const rawQuests = raw['quests']
  const rawEdges = raw['edges']
  if (!isList(rawQuests)) errors.push('"quests" deve ser uma lista')
  if (!isList(rawEdges)) errors.push('"edges" deve ser uma lista')
  if (!isList(rawQuests) || !isList(rawEdges)) return { ok: false, errors }

  const quests = parseQuests(rawQuests, errors)
  const knownIds: ReadonlySet<string> = new Set(quests.map((quest) => quest.id))
  const edges = parseEdges(rawEdges, knownIds, errors)
  if (errors.length > 0) return { ok: false, errors }

  const graph = buildQuestGraph(quests, edges)
  const cycle = findCycle(graph)
  if (cycle) return { ok: false, errors: [`ciclo: ${cycle.join(' → ')}`] }

  return { ok: true, graph }
}

function parseQuests(items: readonly unknown[], errors: string[]): Quest[] {
  const quests: Quest[] = []
  const seen = new Set<string>()
  items.forEach((item, index) => {
    const where = `quest[${index}]`
    if (!isRecord(item)) {
      errors.push(`${where}: deve ser um objeto`)
      return
    }
    const quest = parseQuest(item, where, errors)
    if (!quest) return
    if (seen.has(quest.id)) errors.push(`id duplicado: "${quest.id}"`)
    seen.add(quest.id)
    quests.push(quest)
  })
  return quests
}

function parseQuest(item: Raw, where: string, errors: string[]): Quest | null {
  const before = errors.length
  rejectUnknownFields(item, QUEST_FIELDS, where, errors)
  const id = expectString(item, 'id', where, errors)
  const title = expectString(item, 'title', where, errors)
  const premium = expectBoolean(item, 'premium', where, errors)
  const wiki = expectWikiUrl(item, 'wiki', where, errors)
  const unlocks = expectString(item, 'unlocks', where, errors)
  const level = expectOptionalLevel(item, where, errors)
  if (id !== null && !ID_PATTERN.test(id)) errors.push(`${where}: id "${id}" deve ser kebab-case`)

  if (errors.length > before) return null
  if (id === null || title === null || premium === null || wiki === null || unlocks === null) return null

  const quest: Quest = { id: questId(id), title, premium, wiki, unlocks }
  return level === undefined ? quest : { ...quest, level }
}

function parseEdges(items: readonly unknown[], knownIds: ReadonlySet<string>, errors: string[]): Edge[] {
  const edges: Edge[] = []
  const seenPairs = new Set<string>()
  items.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push(`edge[${index}]: deve ser um objeto`)
      return
    }
    const edge = parseEdge(item, index, knownIds, errors)
    if (!edge) return
    const pair = `${edge.from}→${edge.to}`
    if (seenPairs.has(pair)) errors.push(`aresta duplicada: ${pair}`)
    seenPairs.add(pair)
    edges.push(edge)
  })
  return edges
}

function parseEdge(item: Raw, index: number, knownIds: ReadonlySet<string>, errors: string[]): Edge | null {
  const before = errors.length
  const rawFrom = item['from']
  const rawTo = item['to']
  const where =
    typeof rawFrom === 'string' && typeof rawTo === 'string' ? `edge ${rawFrom}→${rawTo}` : `edge[${index}]`

  rejectUnknownFields(item, EDGE_FIELDS, where, errors)
  const from = expectString(item, 'from', where, errors)
  const to = expectString(item, 'to', where, errors)
  const kind = expectEdgeKind(item, where, errors)
  const evidence = expectEvidence(item, where, errors)
  const source = expectWikiUrl(item, 'source', where, errors)
  if (from !== null && !knownIds.has(from)) errors.push(`${where}: "from" aponta para id inexistente "${from}"`)
  if (to !== null && !knownIds.has(to)) errors.push(`${where}: "to" aponta para id inexistente "${to}"`)
  if (from !== null && to !== null && from === to) errors.push(`${where}: uma quest não pode depender de si mesma`)

  if (errors.length > before) return null
  if (from === null || to === null || kind === null || evidence === null || source === null) return null

  return { from: questId(from), to: questId(to), kind, evidence, source }
}

function isRecord(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Array.isArray devolve any[]; este guard mantém unknown[] e o zero-any.
function isList(value: unknown): value is readonly unknown[] {
  return Array.isArray(value)
}

function rejectUnknownFields(item: Raw, allowed: ReadonlySet<string>, where: string, errors: string[]): void {
  for (const key of Object.keys(item)) {
    if (!allowed.has(key)) errors.push(`${where}: campo desconhecido "${key}"`)
  }
}

function expectString(item: Raw, field: string, where: string, errors: string[]): string | null {
  const value = item[field]
  if (typeof value === 'string' && value.trim() !== '') return value
  errors.push(`${where}: "${field}" deve ser texto não vazio`)
  return null
}

function expectBoolean(item: Raw, field: string, where: string, errors: string[]): boolean | null {
  const value = item[field]
  if (typeof value === 'boolean') return value
  errors.push(`${where}: "${field}" deve ser boolean`)
  return null
}

function expectWikiUrl(item: Raw, field: string, where: string, errors: string[]): string | null {
  const value = expectString(item, field, where, errors)
  if (value === null) return null
  if (value.startsWith(WIKI_PREFIX)) return value
  errors.push(`${where}: "${field}" não é página da TibiaWiki (esperado prefixo ${WIKI_PREFIX})`)
  return null
}

function expectOptionalLevel(item: Raw, where: string, errors: string[]): number | undefined {
  const value = item['level']
  if (value === undefined) return undefined
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value
  errors.push(`${where}: "level" deve ser inteiro maior que zero`)
  return undefined
}

function expectEdgeKind(item: Raw, where: string, errors: string[]): EdgeKind | null {
  const value = item['kind']
  const kind = EDGE_KINDS.find((candidate) => candidate === value)
  if (kind) return kind
  errors.push(`${where}: kind inválido ${JSON.stringify(value)} (use ${EDGE_KINDS.join(' | ')})`)
  return null
}

function expectEvidence(item: Raw, where: string, errors: string[]): string | null {
  const value = item['evidence']
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed !== '' && trimmed !== EVIDENCE_PLACEHOLDER) return value
  }
  errors.push(`${where}: evidence obrigatória, copiada literalmente da wiki (regra de ouro)`)
  return null
}
```

- [ ] **Step 4: Criar `src/domain/index.ts`**

```ts
export {
  EDGE_KINDS,
  buildQuestGraph,
  questId,
  type Edge,
  type EdgeKind,
  type Quest,
  type QuestGraph,
  type QuestId,
} from './quest.ts'
export { findAllPrerequisites, findAllUnlocked, findCycle } from './traversal.ts'
export { EVIDENCE_PLACEHOLDER, WIKI_PREFIX, parseQuestData, type ParseResult } from './parse.ts'
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run && npx tsc --noEmit`
Expected: todos os testes passam (5 + 12 + 17 = 34), tsc sem saída.

- [ ] **Step 6: Commit**

```bash
git add src/domain/parse.ts src/domain/index.ts tests/domain/parse.test.ts
git commit -m "feat: parseQuestData valida schema, evidence e ausência de ciclo"
```

---

### Task 4: Leitor de arquivo, `npm run validate` e `data/quests.yaml`

**Files:**
- Create: `src/quest-file.ts`, `scripts/validate.ts`, `data/quests.yaml`, `tests/quest-file.test.ts`

**Interfaces:**
- Consumes: `parseQuestData`, `ParseResult` de `src/domain/parse.ts`
- Produces: `readQuestFile(file: string): ParseResult`

- [ ] **Step 1: Escrever o teste que falha — `tests/quest-file.test.ts`**

```ts
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readQuestFile } from '../src/quest-file.ts'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'quest-file-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function write(name: string, content: string): string {
  const file = join(dir, name)
  writeFileSync(file, content, 'utf8')
  return file
}

describe('readQuestFile', () => {
  it('lê YAML válido e devolve o grafo', () => {
    const file = write(
      'ok.yaml',
      [
        'quests:',
        '  - id: a',
        '    title: A Quest',
        '    premium: false',
        '    wiki: https://tibia.fandom.com/wiki/A_Quest',
        '    unlocks: nada',
        'edges: []',
      ].join('\n'),
    )
    const result = readQuestFile(file)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.graph.quests.size).toBe(1)
  })

  it('devolve erro legível quando o YAML nem parseia', () => {
    const file = write('broken.yaml', 'quests: [\nedges: }')
    const result = readQuestFile(file)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors[0]).toContain('YAML inválido')
  })

  it('repassa erros de validação', () => {
    const file = write('invalid.yaml', 'quests: []\nedges: [{from: a, to: b}]')
    const result = readQuestFile(file)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.join('\n')).toContain('id inexistente')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/quest-file.test.ts`
Expected: FAIL — `Failed to resolve import "../src/quest-file.ts"`.

- [ ] **Step 3: Implementar `src/quest-file.ts`**

```ts
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { parseQuestData, type ParseResult } from './domain/parse.ts'

// Único ponto de contato com o disco: script de validação e plugin Vite
// passam por aqui para nunca divergirem sobre o que é um YAML válido.
export function readQuestFile(file: string): ParseResult {
  let raw: unknown
  try {
    raw = parse(readFileSync(file, 'utf8'))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, errors: [`YAML inválido: ${message}`] }
  }
  return parseQuestData(raw)
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/quest-file.test.ts && npx tsc --noEmit`
Expected: `Tests 3 passed`, tsc sem saída.

- [ ] **Step 5: Criar `data/quests.yaml`**

```yaml
# Fonte única da verdade do grafo. Ver CLAUDE.md, seção 4.
#
# Regra de ouro: nenhuma aresta entra sem `evidence` copiada literalmente da
# página da TibiaWiki, e `source` é a URL de onde o trecho foi copiado.
# `npm run validate` recusa placeholder, id inexistente, ciclo e campo desconhecido.

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

edges: []
```

- [ ] **Step 6: Criar `scripts/validate.ts`**

```ts
import { readQuestFile } from '../src/quest-file.ts'

const FILE = 'data/quests.yaml'
const result = readQuestFile(FILE)

if (result.ok) {
  console.log(`${FILE}: ${result.graph.quests.size} quests, ${result.graph.edges.length} arestas. OK.`)
} else {
  console.error(`${FILE}: ${result.errors.length} erro(s)`)
  for (const error of result.errors) console.error(`  - ${error}`)
  process.exit(1)
}
```

- [ ] **Step 7: Rodar o validate nos dois cenários**

Run: `npm run validate`
Expected: `data/quests.yaml: 2 quests, 0 arestas. OK.`, exit 0.

Run (cenário de falha, sem commitar): acrescentar temporariamente ao YAML
```yaml
edges:
  - from: the-new-frontier
    to: children-of-the-revolution
    kind: required
    evidence: "<trecho literal copiado da página da wiki>"
    source: https://tibia.fandom.com/wiki/Children_of_the_Revolution_Quest
```
e rodar `npm run validate`.
Expected: `1 erro(s)` + `evidence obrigatória ... (regra de ouro)`, exit 1. Depois restaurar `edges: []`.

- [ ] **Step 8: Commit**

```bash
git add src/quest-file.ts scripts/validate.ts data/quests.yaml tests/quest-file.test.ts
git commit -m "feat: readQuestFile, npm run validate e fixture do quests.yaml"
```

---

### Task 5: Plugin Vite `virtual:quests` + entrada mínima

**Files:**
- Create: `src/vite-plugin-quests.ts`, `src/virtual-quests.d.ts`, `vite.config.ts`, `index.html`, `src/main.ts`, `tests/vite-plugin-quests.test.ts`

**Interfaces:**
- Consumes: `readQuestFile` de `src/quest-file.ts`; `buildQuestGraph`, `Quest`, `Edge` de `src/domain/`
- Produces: `questsPlugin({ file }): Plugin`, `questsModuleSource(file): string`, módulo `virtual:quests` com `default: { quests: readonly Quest[]; edges: readonly Edge[] }`

- [ ] **Step 1: Escrever o teste que falha — `tests/vite-plugin-quests.test.ts`**

```ts
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { questsModuleSource, questsPlugin } from '../src/vite-plugin-quests.ts'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'quests-plugin-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function write(name: string, content: string): string {
  const file = join(dir, name)
  writeFileSync(file, content, 'utf8')
  return file
}

const VALID = [
  'quests:',
  '  - id: a',
  '    title: A Quest',
  '    premium: false',
  '    wiki: https://tibia.fandom.com/wiki/A_Quest',
  '    unlocks: nada',
  '  - id: b',
  '    title: B Quest',
  '    level: 20',
  '    premium: true',
  '    wiki: https://tibia.fandom.com/wiki/B_Quest',
  '    unlocks: nada',
  'edges:',
  '  - from: a',
  '    to: b',
  '    kind: required',
  '    evidence: "You must have completed A Quest."',
  '    source: https://tibia.fandom.com/wiki/B_Quest',
].join('\n')

describe('questsModuleSource', () => {
  it('emite export default com quests e arestas validadas', () => {
    const source = questsModuleSource(write('ok.yaml', VALID))
    expect(source.startsWith('export default ')).toBe(true)
    const data: unknown = JSON.parse(source.slice('export default '.length))
    expect(data).toEqual({
      quests: [
        { id: 'a', title: 'A Quest', premium: false, wiki: 'https://tibia.fandom.com/wiki/A_Quest', unlocks: 'nada' },
        { id: 'b', title: 'B Quest', premium: true, wiki: 'https://tibia.fandom.com/wiki/B_Quest', unlocks: 'nada', level: 20 },
      ],
      edges: [
        {
          from: 'a',
          to: 'b',
          kind: 'required',
          evidence: 'You must have completed A Quest.',
          source: 'https://tibia.fandom.com/wiki/B_Quest',
        },
      ],
    })
  })

  it('lança com a lista de erros quando o YAML é inválido', () => {
    const file = write('bad.yaml', 'quests: []\nedges: [{from: a, to: b}]')
    expect(() => questsModuleSource(file)).toThrow(/id inexistente/)
  })
})

describe('questsPlugin', () => {
  it('tem nome e recebe o caminho do arquivo', () => {
    const plugin = questsPlugin({ file: 'data/quests.yaml' })
    expect(plugin.name).toBe('tibia-quest-graph:quests')
    expect(typeof plugin.resolveId).toBe('function')
    expect(typeof plugin.load).toBe('function')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/vite-plugin-quests.test.ts`
Expected: FAIL — `Failed to resolve import "../src/vite-plugin-quests.ts"`.

- [ ] **Step 3: Implementar `src/vite-plugin-quests.ts`**

```ts
import type { Plugin } from 'vite'
import { readQuestFile } from './quest-file.ts'

const MODULE_ID = 'virtual:quests'
// Prefixo \0 é a convenção do Rollup/Vite para módulos virtuais: impede que
// outros plugins tentem tratar o id como caminho de arquivo.
const RESOLVED_ID = '\0virtual:quests'

export interface QuestsPluginOptions {
  readonly file: string
}

export function questsPlugin({ file }: QuestsPluginOptions): Plugin {
  return {
    name: 'tibia-quest-graph:quests',
    resolveId(id) {
      return id === MODULE_ID ? RESOLVED_ID : null
    },
    load(id) {
      if (id !== RESOLVED_ID) return null
      this.addWatchFile(file)
      return questsModuleSource(file)
    },
  }
}

// Serializa o grafo validado como arrays: Map não sobrevive a JSON, e o
// main.ts remonta o grafo com buildQuestGraph.
export function questsModuleSource(file: string): string {
  const result = readQuestFile(file)
  if (!result.ok) {
    throw new Error(`${file} inválido:\n${result.errors.map((error) => `  - ${error}`).join('\n')}`)
  }
  const data = { quests: [...result.graph.quests.values()], edges: result.graph.edges }
  return `export default ${JSON.stringify(data)}`
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/vite-plugin-quests.test.ts && npx tsc --noEmit`
Expected: `Tests 3 passed`, tsc sem saída. Se `tsc` reclamar da assinatura de `resolveId`/`load` (Vite 8 usa Rolldown), ajustar os parâmetros para o tipo que a mensagem indicar, mantendo o comportamento.

- [ ] **Step 5: Criar `src/virtual-quests.d.ts`**

```ts
declare module 'virtual:quests' {
  import type { Edge, Quest } from './domain/quest.ts'

  const data: {
    readonly quests: readonly Quest[]
    readonly edges: readonly Edge[]
  }
  export default data
}
```

- [ ] **Step 6: Criar `vite.config.ts`**

```ts
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { questsPlugin } from './src/vite-plugin-quests.ts'

export default defineConfig({
  plugins: [questsPlugin({ file: fileURLToPath(new URL('./data/quests.yaml', import.meta.url)) })],
})
```

- [ ] **Step 7: Criar `index.html` e `src/main.ts`**

`index.html`:
```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Tibia Quest Graph</title>
  </head>
  <body>
    <main id="app"></main>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`src/main.ts`:
```ts
import data from 'virtual:quests'
import { buildQuestGraph } from './domain/index.ts'

// Entrada mínima da fundação. A sessão de interface substitui isto pelo
// Cytoscape; o que importa aqui é provar que virtual:quests chega tipado.
const graph = buildQuestGraph(data.quests, data.edges)

const app = document.querySelector('#app')
if (app) {
  app.textContent = `${graph.quests.size} quests, ${graph.edges.length} arestas carregadas de data/quests.yaml.`
}
```

- [ ] **Step 8: Build completo**

Run: `npm run build`
Expected: `validate` imprime OK, `tsc` silencioso, Vite gera `dist/` com `index.html` e um JS contendo `"the-new-frontier"`. Conferir: `grep -c "the-new-frontier" dist/assets/*.js` → `1`.

- [ ] **Step 9: Verificar dev server e recarga**

Run: `npx vite --port 5173` em background; `curl -s http://localhost:5173/` deve conter `/src/main.ts`; `curl -s "http://localhost:5173/@id/__x00__virtual:quests"` deve conter `the-new-frontier`. Encerrar o servidor.

- [ ] **Step 10: Commit**

```bash
git add src/vite-plugin-quests.ts src/virtual-quests.d.ts vite.config.ts index.html src/main.ts tests/vite-plugin-quests.test.ts
git commit -m "feat: plugin Vite virtual:quests e entrada mínima"
```

---

### Task 6: Verificação final e revisão

- [ ] **Step 1: Rodar a sequência dos critérios de pronto**

Run: `rm -rf node_modules dist && npm ci && npm test && npm run typecheck && npm run validate && npm run build`
Expected: tudo verde. Contar: `Test Files 5 passed`, `Tests 40 passed`.

- [ ] **Step 2: Auditar as restrições globais**

Run:
```bash
grep -rn "any\b\|@ts-ignore\|as unknown as" src scripts tests --include=*.ts | grep -v "\.d\.ts" ; echo "---"
grep -rln "node:\|from 'vite'\|from 'yaml'\|fetch(\|Date.now" src/domain ; echo "---"
```
Expected: só ocorrências de `any` dentro de palavras (`company`) ou nenhuma; segunda lista vazia.

- [ ] **Step 3: Marcar `git status` limpo e pedir code review**

Run: `git status --short` → vazio. Depois invocar `superpowers:requesting-code-review` sobre `git diff 076bf26..HEAD`.

- [ ] **Step 4: Aplicar correções da revisão (se houver) e commitar**

```bash
git add -A
git commit -m "refactor: ajustes da revisão de código"
```
