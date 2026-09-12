# Fase 2b: dados completos

Data: 2026-09-12
Fase 2: 2a início e árvore (feito) → **2b dados completos** → 2c blocos por região.
Contexto e números em `2026-09-12-phase2-context.md`.

## Objetivo

Todas as quests reais da TibiaWiki em `data/quests.yaml`, com level, premium,
recompensa literal, lugar e região, e todas as arestas que a wiki comprova com
frase literal. Coleta reproduzível por um script do repositório; curadoria
humana preservada entre execuções.

## Decisões

| Decisão | Escolha | Por quê |
|---|---|---|
| Fonte única continua `data/quests.yaml` | O script **acrescenta** o que falta e nunca altera nem remove o que já existe | Curadoria feita à mão sobrevive a novas coletas; o app não muda |
| Rejeições | `data/rejected-edges.yaml` (`from`, `to`, `reason`) | Aresta removida à mão não volta na próxima coleta |
| Arestas automáticas | `reviewed: false`; ausência do campo = revisada | As 14 do MVP continuam como estão; a UI marca "não revisada" |
| Ambíguas | Entram com `reviewed: false` e vão para `docs/superpowers/review/2026-09-12-edge-queue.md` | Gabriel pediu para ir até o fim sem interrupções; a frase literal está lá, só falta o OK |
| `unlocks` | Opcional; `reward` literal da wiki (inglês) é o padrão | Texto em português à mão não escala |
| Região | `data/regions.yaml` (região → lista de lugares), resolvida na coleta e gravada em `region` | App não precisa conhecer o mapa; curadoria é editar o YAML |
| Cache | `.cache/wiki/` (gitignored) | Re-execução sem bater na API; `--refresh` força |
| Escopo de quests | Páginas com `Infobox Quest` e `name` preenchido, exceto `type` ∈ {mwc, event, change, exchange} e páginas listadas em `excluded` de `regions.yaml`… | Mini world changes e eventos não são quests |

## Schema v2

```yaml
quests:
  - id: soul-war
    title: Soul War Quest
    level: 250              # opcional
    premium: true
    wiki: https://tibia.fandom.com/wiki/Soul_War_Quest
    unlocks: "…"            # opcional, português, à mão
    reward: "One random item from the Soul Set, …"   # opcional, literal (infobox reward)
    location: "Zarganash"   # opcional, literal (primeiro lugar do infobox location)
    region: "Zarganash"     # opcional, de regions.yaml; "Outros" se não mapeado
edges:
  - from: feaster-of-souls
    to: soul-war
    kind: required
    evidence: "Completed the Feaster of Souls Quest"
    source: https://tibia.fandom.com/wiki/Soul_War_Quest/Spoiler
    reviewed: false         # opcional; ausente = revisada
```

`premium` continua obrigatório: infobox `partial`/`?` vira `true` (exige premium
em alguma parte), com a decisão anotada no comentário da quest.

`region`: qualquer texto não vazio. `reward`/`location`: texto não vazio.
Campos desconhecidos continuam erro.

## Regras de extração (puras, em `src/wiki/`)

**Quests.** `title` = título da página. `id` = kebab-case do título sem o
sufixo " Quest", com apóstrofos e acentos removidos (`ferumbras-ascension`).
`level` = inteiro inicial de `lvl` se > 0. `premium` = `yes|partial|?` → true,
`no` → false, vazio → true com aviso. `reward` = `reward` sem marcação, até
300 caracteres, cortado em ponto/vírgula. `location` = primeiro item de
`location` (separado por `,`, `;`, `(`, ` and `).

**Arestas.** Só sentenças que citam outra quest do conjunto pelo título (link
`[[X Quest]]` ou texto exato) em um destes lugares:

1. Seção `Requirements` / `Required Equipment` / `Prerequisites` do `/Spoiler`:
   toda linha que cita a quest.
2. Fora dela: frases com padrão forte de exigência: `must have (completed|
   finished|done)`, `need(s)? to have (completed|finished)`, `required to
   (have )?complete`, `you need to (complete|finish)`, `succeed(ed)? the`,
   `having (completed|finished)`.

`kind`, pela frase:

| Sinal | kind | reviewed |
|---|---|---|
| `completed|finished|succeed` sem sinal de parcialidade | `required` | false (auto) |
| `access to`, `permission to`, `to enter`, `to reach` | `access` | false |
| `recommended`, `advisable`, `optional`, `not needed`, `only necessary`, `bring a friend`, `or` entre quests | `recommended` | false |
| menção sem verbo de conclusão, ou `mission N`/`up to`/`first mission` (parcial) | `required` | false, **fila** |

Frase = linha da lista ou sentença (corte em `. `), com marcação removida da
mesma forma que a coleta do MVP: `[[a|b]]` → `b`, `{{KW|x}}` → `x`, outros
templates removidos, `''` e HTML removidos, espaços normalizados. `source` =
URL da página onde a frase está.

Descartes (listados no documento de revisão, não entram): menções fora das
regras acima, auto-referência, ciclos (a aresta que fecha ciclo é descartada,
com aviso), pares já em `rejected-edges.yaml`.

## Regiões

`data/regions.yaml`:

```yaml
regions:
  Zao: [Zao, Zao Steppe, Razachai, Muggy Plains, Dragonblaze Peaks, Farmine]
  Svargrond: [Svargrond, Nibelor, Formorgar Mines, Hrodmir, Tyrsung, Okolnir, Helheim]
  …
excluded: []   # títulos a ignorar mesmo com infobox
```

Rascunho inicial gerado pelo coletor a partir do campo `city` das páginas de
lugar da wiki (`prop=revisions` da página do `location`), agrupando por
cidade; lugares sem `city` vão para `Outros`. O YAML é curado à mão depois.
O coletor lê o mapa e grava `region` na quest; lugar não mapeado → `Outros`.

## Módulos

| Arquivo | Responsabilidade |
|---|---|
| `src/domain/quest.ts`, `parse.ts` | schema v2 (campos opcionais, `reviewed`) |
| `src/wiki/markup.ts` | `stripMarkup`, `infoboxFields`, `sectionBody`, `sentences` (puro) |
| `src/wiki/quest-page.ts` | `parseQuestPage(title, mainWikitext) → QuestDraft \| null` (puro) |
| `src/wiki/edges.ts` | `extractEdgeCandidates(title, spoilerWikitext, knownTitles) → Candidate[]` com `kind`, `reviewed`, `evidence`, `source`, `ambiguous` (puro) |
| `src/wiki/slug.ts` | `questSlug(title)` (puro) |
| `src/wiki/client.ts` | API MediaWiki com cache em disco e User-Agent (I/O) |
| `src/wiki/regions.ts` | resolve `location` → `region` (puro) |
| `scripts/collect.ts` | orquestra: lista quests, baixa, extrai, mescla em `quests.yaml` preservando comentários (`yaml` Document API), escreve o documento de revisão |
| `scripts/draft-regions.ts` | gera `data/regions.yaml` inicial a partir de `city` |
| `src/ui/panel.ts` | `reward` quando não há `unlocks`; linha "Região · Lugar"; badge "não revisada" |
| `src/ui/mode.ts` | modo `all` mostra só quests com alguma aresta (as isoladas ficam na busca) |

## Testes

- `tests/wiki/markup.test.ts`: strip, infobox com campos vazios (bug da
  regex do MVP), seções com 2 e 3 `=`, sentenças.
- `tests/wiki/quest-page.test.ts`: fixtures reduzidas de Soul War, Barbarian
  Test (`premium` e `lvl 0`), página de cidade sem `name` → null, `type: mwc` → null.
- `tests/wiki/edges.test.ts`: cada linha da tabela de `kind`; menção fora de
  regra descartada; auto-referência; fixture da Ice Islands ("Succeed the…" no
  corpo).
- `tests/wiki/slug.test.ts`, `tests/wiki/regions.test.ts`.
- `tests/domain/parse.test.ts`: campos novos aceitos, `unlocks` opcional,
  `reviewed` só boolean.
- `scripts/collect.ts` testado por execução real + `npm run validate`.

## Critérios de pronto

- `npm run collect` roda do zero (com cache) e deixa `npm run validate` verde.
- `data/quests.yaml` com todas as quests reais; as 15 do MVP e suas 14 arestas
  inalteradas.
- `docs/superpowers/review/2026-09-12-edge-queue.md` lista ambíguas e
  descartadas com frase e link.
- Painel mostra `reward`, região e "não revisada"; busca acha qualquer quest;
  publicado.
