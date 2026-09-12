import cytoscape from 'cytoscape'
import { describe, expect, it } from 'vitest'
import { buildOverview } from '../../src/domain/overview.ts'
import { buildQuestGraph } from '../../src/domain/quest.ts'
import { toBlockElements } from '../../src/graph/elements.ts'
import { edge, quest } from '../domain/fixtures.ts'

// A view real precisa de um container DOM; aqui só se confere a mecânica de
// eventos que ela usa: tap num filho chega com o filho como alvo (não com o
// pai composto), tap no pai chega com o pai, e o fundo tem o core como alvo.
describe('mecânica de tap com nós compostos (headless)', () => {
  const graph = buildQuestGraph(
    [{ ...quest('a'), region: 'Thais' }, { ...quest('b'), region: 'Thais' }],
    [edge('a', 'b')],
  )
  const cy = cytoscape({ headless: true, elements: toBlockElements(buildOverview(graph)) })
  const seen: string[] = []
  cy.on('tap', 'node', (event) => {
    const target: cytoscape.NodeSingular = event.target
    seen.push(target.hasClass('region') ? `region:${target.id()}` : `quest:${target.id()}`)
  })
  cy.on('tap', (event) => {
    if (event.target === cy) seen.push('background')
  })

  it('distingue quest, bloco e fundo, sem disparar duas vezes por tap', () => {
    cy.getElementById('a').emit('tap')
    cy.getElementById('region:Thais').emit('tap')
    cy.emit('tap')
    expect(seen).toEqual(['quest:a', 'region:region:Thais', 'background'])
  })
})
