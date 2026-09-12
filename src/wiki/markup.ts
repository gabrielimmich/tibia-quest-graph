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
  // Imagem removida antes de vírgula deixava "addons , access".
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim()
}

// Um campo começa em `| nome = valor`; linhas seguintes que não começam
// campo nem fecham o template continuam o valor (reward costuma ser uma
// lista de várias linhas). `[ \t]*` (não `\s*`) depois do `=`: `\s` engoliria
// a quebra de linha e o campo vazio capturaria a linha seguinte.
export function infoboxFields(wikitext: string): ReadonlyMap<string, string> {
  const fields = new Map<string, string>()
  let current: string | null = null
  for (const line of wikitext.split('\n')) {
    const start = /^\|[ \t]*(\w+)[ \t]*=[ \t]*(.*)$/.exec(line)
    if (start) {
      current = start[1] ?? null
      if (current !== null) fields.set(current, (start[2] ?? '').trim())
      continue
    }
    if (current === null || line.startsWith('|') || line.startsWith('}}') || line.trim() === '') {
      if (line.startsWith('}}')) current = null
      continue
    }
    // Item de lista na continuação vira "; item": lê-se como frase, não como marcação.
    const item = /^[*#:;]+\s*/.test(line) ? `; ${line.replace(/^[*#:;]+\s*/, '')}` : ` ${line.trim()}`
    fields.set(current, `${fields.get(current) ?? ''}${item}`.replace(/^; /, '').replace(/:;\s*/g, ': ').trim())
  }
  return fields
}

export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z(])/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence !== '')
}
