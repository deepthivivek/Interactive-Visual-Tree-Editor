/**
 * Pure Practice Tree Fixture (Day 14).
 * Provides controlled practice graphs with deliberate validation issues or clean states
 * for training, validation inspection, and testing.
 */

import type { TreeNode, TreeEdge } from '../types/tree';

export interface PracticeTreeFixture {
  name: string;
  description: string;
  nodes: TreeNode[];
  edges: TreeEdge[];
}

export function createPracticeTreeFixture(type: 'clean' | 'orphans' | 'cycle' | 'missing-root'): PracticeTreeFixture {
  switch (type) {
    case 'clean':
      return {
        name: 'Clean Practice Tree',
        description: 'A valid minimal tree with a root and rule node.',
        nodes: [
          {
            id: 'practice-root',
            type: 'root',
            position: { x: 400, y: 50 },
            data: { label: 'Practice Root', status: 'active' },
          },
          {
            id: 'practice-rule',
            type: 'rule',
            position: { x: 400, y: 200 },
            data: { label: 'Practice Rule', status: 'active' },
          },
        ],
        edges: [
          {
            id: 'practice-edge-1',
            source: 'practice-root',
            target: 'practice-rule',
            data: { relationshipType: 'root-rule' },
          },
        ],
      };

    case 'orphans':
      return {
        name: 'Practice Tree with Orphans',
        description: 'Contains disconnected orphan nodes requiring attachment or deletion.',
        nodes: [
          {
            id: 'practice-root',
            type: 'root',
            position: { x: 400, y: 50 },
            data: { label: 'Practice Root', status: 'active' },
          },
          {
            id: 'practice-orphan',
            type: 'rule',
            position: { x: 600, y: 200 },
            data: { label: 'Orphan Rule', status: 'draft' },
          },
        ],
        edges: [],
      };

    case 'cycle':
      return {
        name: 'Practice Tree with Cycle',
        description: 'Contains a circular reference between two nodes.',
        nodes: [
          {
            id: 'node-a',
            type: 'rule',
            position: { x: 300, y: 200 },
            data: { label: 'Node A' },
          },
          {
            id: 'node-b',
            type: 'rule',
            position: { x: 500, y: 200 },
            data: { label: 'Node B' },
          },
        ],
        edges: [
          { id: 'e1', source: 'node-a', target: 'node-b', data: { relationshipType: 'rule-condition' } },
          { id: 'e2', source: 'node-b', target: 'node-a', data: { relationshipType: 'rule-condition' } },
        ],
      };

    case 'missing-root':
    default:
      return {
        name: 'Practice Tree Lacking Root',
        description: 'Graph has rule nodes but no Root node.',
        nodes: [
          {
            id: 'rule-only',
            type: 'rule',
            position: { x: 400, y: 200 },
            data: { label: 'Rule Without Root' },
          },
        ],
        edges: [],
      };
  }
}
