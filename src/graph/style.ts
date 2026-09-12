import type { StylesheetJson } from 'cytoscape'

export const colors = {
  node: '#3a3127',
  nodeBorder: '#8a6d3b',
  nodeText: '#f1e6c8',
  edge: '#6b5a42',
  focus: '#f5c542',
  focusText: '#1a1408',
  ancestor: '#5aa9e6',
  descendant: '#7ed37e',
} as const

export const stylesheet: StylesheetJson = [
  {
    selector: 'node',
    style: {
      shape: 'round-rectangle',
      width: 150,
      height: 44,
      'background-color': colors.node,
      'border-width': 2,
      'border-color': colors.nodeBorder,
      label: 'data(label)',
      color: colors.nodeText,
      'font-size': 12,
      'font-family': 'system-ui, sans-serif',
      'text-wrap': 'wrap',
      'text-max-width': '140px',
      'text-valign': 'center',
      'text-halign': 'center',
      'transition-property': 'opacity, border-color, background-color',
      'transition-duration': 150,
    },
  },
  {
    selector: 'edge',
    style: {
      width: 2,
      'line-color': colors.edge,
      'target-arrow-color': colors.edge,
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      'arrow-scale': 1.2,
      'transition-property': 'opacity, line-color, target-arrow-color',
      'transition-duration': 150,
    },
  },
  { selector: 'edge[kind = "access"]', style: { 'line-style': 'dashed', 'line-dash-pattern': [8, 4] } },
  { selector: 'edge[kind = "recommended"]', style: { 'line-style': 'dotted' } },
  {
    selector: 'node.focus',
    style: {
      'background-color': colors.focus,
      'border-color': colors.focus,
      color: colors.focusText,
      'font-weight': 'bold',
    },
  },
  { selector: 'node.ancestor', style: { 'border-color': colors.ancestor, 'border-width': 3 } },
  { selector: 'node.descendant', style: { 'border-color': colors.descendant, 'border-width': 3 } },
  { selector: 'edge.path', style: { width: 3, 'line-color': colors.focus, 'target-arrow-color': colors.focus } },
  { selector: '.dimmed', style: { opacity: 0.15 } },
]
