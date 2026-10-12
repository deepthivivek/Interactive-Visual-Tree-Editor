/**
 * Reusable Tree Builder Fixtures and Helpers for Benchmark and Layout Testing.
 *
 * Implements deterministic graph generation adhering strictly to
 * project relationship grammar and typing rules.
 */

import type { TreeNode, TreeEdge, NodeType } from '../../types/tree';
import { getRelationshipType } from '../../lib/relationshipRules';

/**
 * Generates a valid, deterministic parent-child compliance hierarchy tree of size n.
 *
 * Adheres strictly to relationship rules:
 * - Exactly one apex Root node (node-0)
 * - Level 1: Rule nodes (children of Root)
 * - Level 2: Condition nodes (children of Rules)
 * - Level 3: Action nodes (children of Conditions)
 *
 * Deterministic: identical calls with the same n produce identical nodes, edges, IDs, and positions.
 */
export function buildLargeTree(n: number): { nodes: TreeNode[]; edges: TreeEdge[] } {
  if (n <= 0) {
    return { nodes: [], edges: [] };
  }

  const nodes: TreeNode[] = [];
  const edges: TreeEdge[] = [];

  // 1. Apex Root
  nodes.push({
    id: 'node-0',
    type: 'root',
    position: { x: 500, y: 0 },
    data: {
      label: 'Root Governance Framework',
      ruleId: 'ROOT-000',
      description: 'Apex root of large deterministic benchmark tree',
      severity: 'info',
      status: 'active',
      collapsed: false,
    },
  });

  if (n === 1) {
    return { nodes, edges };
  }

  // Calculate tier distributions
  // Roughly: ~5% rules, ~20% conditions, ~75% actions
  const remaining = n - 1;
  const ruleCount = Math.max(1, Math.min(remaining, Math.ceil(remaining * 0.08)));
  const remainingAfterRules = remaining - ruleCount;
  const conditionCount = Math.min(
    remainingAfterRules,
    Math.max(1, Math.ceil(remainingAfterRules * 0.25))
  );
  const actionCount = remainingAfterRules - conditionCount;

  const ruleIds: string[] = [];
  const conditionIds: string[] = [];

  let currentIndex = 1;

  // 2. Level 1: Rules (children of Root)
  for (let r = 0; r < ruleCount && currentIndex < n; r++) {
    const id = `node-${currentIndex}`;
    ruleIds.push(id);
    nodes.push({
      id,
      type: 'rule',
      position: { x: r * 260, y: 150 },
      data: {
        label: `Rule Standard ${r + 1}`,
        ruleId: `RULE-${String(r + 1).padStart(3, '0')}`,
        description: `Compliance governance rule standard ${r + 1}`,
        severity: 'high',
        status: 'active',
        collapsed: false,
      },
    });

    const rel = getRelationshipType('root', 'rule');
    edges.push({
      id: `e-node-0-${id}`,
      source: 'node-0',
      target: id,
      type: 'smoothstep',
      data: { relationshipType: rel ?? undefined },
    });

    currentIndex++;
  }

  // 3. Level 2: Conditions (children of Rules)
  for (let c = 0; c < conditionCount && currentIndex < n; c++) {
    const id = `node-${currentIndex}`;
    conditionIds.push(id);
    const parentRuleId = ruleIds[c % ruleIds.length];

    nodes.push({
      id,
      type: 'condition',
      position: { x: c * 260, y: 300 },
      data: {
        label: `Condition Criterion ${c + 1}`,
        ruleId: `COND-${String(c + 1).padStart(3, '0')}`,
        description: `Logical prerequisite condition evaluation ${c + 1}`,
        severity: 'medium',
        status: 'active',
        collapsed: false,
      },
    });

    const rel = getRelationshipType('rule', 'condition');
    edges.push({
      id: `e-${parentRuleId}-${id}`,
      source: parentRuleId,
      target: id,
      type: 'smoothstep',
      data: { relationshipType: rel ?? undefined },
    });

    currentIndex++;
  }

  // 4. Level 3: Actions (children of Conditions)
  const parentsForActions = conditionIds.length > 0 ? conditionIds : ruleIds;
  for (let a = 0; a < actionCount && currentIndex < n; a++) {
    const id = `node-${currentIndex}`;
    const parentId = parentsForActions[a % parentsForActions.length];
    const parentNode = nodes.find((node) => node.id === parentId);
    const parentType = (parentNode?.type ?? 'condition') as NodeType;

    nodes.push({
      id,
      type: 'action',
      position: { x: a * 260, y: 450 },
      data: {
        label: `Action Enforcement ${a + 1}`,
        ruleId: `ACT-${String(a + 1).padStart(3, '0')}`,
        description: `Automated remediation action execution ${a + 1}`,
        severity: 'critical',
        status: 'active',
        collapsed: false,
      },
    });

    const rel = getRelationshipType(parentType, 'action');
    edges.push({
      id: `e-${parentId}-${id}`,
      source: parentId,
      target: id,
      type: 'smoothstep',
      data: { relationshipType: rel ?? undefined },
    });

    currentIndex++;
  }

  return { nodes, edges };
}
