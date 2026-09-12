# Tibia Quest Graph

Mapa navegável de dependências entre quests do Tibia. Clique numa quest e veja
o que precisa ser feito antes, o que ela libera depois, e a frase da TibiaWiki
que comprova cada ligação.

**Site:** https://gabrielimmich.github.io/tibia-quest-graph/

## Rodar localmente

```bash
npm ci
npm run dev        # http://localhost:5173/tibia-quest-graph/
npm test
npm run validate   # confere data/quests.yaml
npm run build
```

## Dados

`data/quests.yaml` é a única fonte. Cada aresta carrega `evidence`, copiada
literalmente da TibiaWiki, e `source`, a página de onde veio. Ver `CLAUDE.md`.

## Licença e atribuição

Fansite não oficial. Tibia é marca registrada da CipSoft GmbH. Dados e citações
da [TibiaWiki](https://tibia.fandom.com/), sob
[CC-BY-SA](https://creativecommons.org/licenses/by-sa/3.0/).
