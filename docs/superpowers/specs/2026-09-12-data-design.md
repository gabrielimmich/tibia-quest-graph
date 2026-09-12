# Dados: as 15 quests em `data/quests.yaml`

Data: 2026-09-12
Sessão 2 de 3 do MVP (fundação → **dados** → interface). Fundação em
`2026-09-12-foundation-design.md`.

## Objetivo

`data/quests.yaml` com as 15 quests do `CLAUDE.md` §3 e todas as arestas entre
elas que a TibiaWiki comprova, cada uma com `evidence` literal e `source`.
`npm run validate` verde. Nada de scraper no repo: a coleta é um script
descartável no scratchpad, e o YAML é o único artefato.

## Decisões

| Decisão | Escolha | Por quê |
|---|---|---|
| `unlocks` em quest-folha | Obrigatório; descreve recompensa/acesso em português, a partir de `reward`/`legend` da wiki | Painel sempre mostra algo útil; schema não muda |
| Aprovação | Uma tabela com todas as candidatas; Gabriel aprova/rejeita por número | Uma interrupção só |
| Fonte | API MediaWiki: `https://tibia.fandom.com/api.php?action=parse&page=<Título>&prop=wikitext` | Texto literal, sem HTML de anúncios |
| Arestas fora do conjunto | Não entram; ficam anotadas em comentário no YAML | Fase 2 (as outras 349 quests) |

## Fonte por campo

| Campo | Página | Origem |
|---|---|---|
| `title` | — | `CLAUDE.md` §3 |
| `id` | — | título em kebab-case, sem "Quest" (`soul-war`) |
| `wiki` | — | `https://tibia.fandom.com/wiki/<Título_Com_Underscores>` |
| `level` | `<Quest>` | infobox `lvl`; omitido se vazio ou não numérico |
| `premium` | `<Quest>` | infobox `premium` (`yes`/`no`) |
| `unlocks` | `<Quest>` | rascunho a partir de `reward` e `legend`, revisado por Gabriel |
| arestas | `<Quest>/Spoiler` | seção `== Requirements ==` e menções a outras das 15 no corpo |

## Regra de `kind`

Aplicada ao texto literal, nunca a conhecimento prévio:

- `required`: "Completed X", "must have completed X", "finished X".
- `access`: X é necessária para chegar ao lugar (acesso a continente, cidade,
  área), sem exigir X completa.
- `recommended`: "recommended", "advisable", "it is a good idea".

Direção: `from` é a quest exigida, `to` é a quest que exige. Aresta só entra se
o texto citar a quest `from` pelo nome (ou nome alternativo listado no infobox
`aka`).

## Formato de `evidence` e `source`

- `evidence`: a frase inteira onde a exigência aparece, com marcação de wiki
  removida (`[[Feaster of Souls Quest]]` → `Feaster of Souls Quest`,
  `{{KW|task}}` → `task`). Sem tradução, sem resumo.
- `source`: URL da página onde a frase está, geralmente
  `https://tibia.fandom.com/wiki/<Título>/Spoiler`.

## Fluxo

1. Script no scratchpad busca as 30 páginas e extrai infobox + Requirements +
   linhas do corpo que mencionam qualquer uma das 15.
2. Tabela de candidatas: nº, from → to, kind proposto, citação, link.
3. Gabriel aprova, rejeita ou corrige o kind por número.
4. Escrever `data/quests.yaml`; `npm run validate`; `npm test`; commit.

## Critérios de pronto

- 15 quests no YAML, todas com `wiki` correto e `premium`; `level` onde a wiki dá.
- Toda aresta aprovada por Gabriel, com `evidence` literal e `source`.
- `npm run validate` e `npm run build` verdes.
- Nenhum script de coleta no repositório.
