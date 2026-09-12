// Reduz wikitext ao texto que a página renderiza. É o que garante que a
// `evidence` seja o que o leitor vê na TibiaWiki, não a marcação.

export function stripMarkup(source: string): string {
  let text = source
  // Templates: os poucos que viram texto visível recebem tratamento próprio;
  // o resto (infobox, ícones, coordenadas sem texto) some.
  text = text.replace(/\{\{KW\|([^}|]*)\}\}/gi, '$1')
  text = text.replace(/\{\{Spoiler Section\|([^}|]*)\|([^}|]*)\}\}/gi, '$1 - $2')
  text = text.replace(/\{\{[^{}]*\|text=([^}|]*)[^{}]*\}\}/gi, '$1')
  text = text.replace(/\{\{[^{}]*\}\}/g, '')
  // Link externo [url texto] → texto (páginas antigas linkam a wikia assim).
  text = text.replace(/\[(?:https?:)?\/\/[^\s\]]+\s+([^\]]*)\]/g, '$1')
  // Arquivos/imagens não têm texto; [[a|b]] → b; [[a]] → a.
  text = text.replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, '')
  text = text.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
  text = text.replace(/'{2,}/g, '')
  text = text.replace(/<[^>]+>/g, ' ')
  text = text.replace(/^[*#:;]+\s*/, '')
  return text.replace(/\s+/g, ' ').trim()
}

// Um campo por linha. `[ \t]*` (não `\s*`) depois do `=`: `\s` engoliria a
// quebra de linha e o campo vazio capturaria a linha seguinte.
export function infoboxFields(wikitext: string): ReadonlyMap<string, string> {
  const fields = new Map<string, string>()
  for (const match of wikitext.matchAll(/^\|[ \t]*(\w+)[ \t]*=[ \t]*(.*)$/gm)) {
    const [, name, value] = match
    if (name !== undefined && value !== undefined) fields.set(name, value.trim())
  }
  return fields
}

// Corpo da primeira seção cujo título esteja em `names`, até o próximo
// cabeçalho de qualquer nível (a wiki mistura =, ==, === e ====).
export function sectionBody(wikitext: string, names: readonly string[]): string {
  const lines = wikitext.split('\n')
  const wanted = new Set(names.map((name) => name.toLowerCase()))
  const heading = /^(={1,4})\s*(.+?)\s*\1\s*$/
  let inside = false
  const body: string[] = []
  for (const line of lines) {
    const match = heading.exec(line)
    if (match) {
      if (inside) break
      inside = wanted.has((match[2] ?? '').toLowerCase())
      continue
    }
    if (inside) body.push(line)
  }
  return body.join('\n').trim()
}

// Itens de lista (*, #, :) e linhas soltas, já sem marcação.
export function listItems(body: string): string[] {
  return body
    .split('\n')
    .map((line) => stripMarkup(line))
    .filter((line) => line !== '')
}

export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z(])/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence !== '')
}
