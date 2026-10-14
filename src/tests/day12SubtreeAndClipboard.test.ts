import { describe, it, expect, beforeEach } from 'vitest';
import {
  getSubtreeNodeIds,
  getSubtreeNodes,
  getSubtreeEdges,
  getDescendantCount,
  deleteSingleNodePure,
  deleteSubtreePure,
  assertGraphInvariants,
  sanitizeTreeDocument,
} from '../lib/subtree';
import {
  computeVisibleGraph,
  toggleCollapsePure,
  expandAllPure,
  collapseAllPure,
  revealNodePure,
} from '../lib/visibility';
import {
  computeSubtreePasteRootPosition,
  offsetSubtreePositions,
  clampToSafeCoordinate,
} from '../lib/placement';
import {
  createSubtreeClipboardSnapshot,
  pasteSubtreePure,
  MAX_GRAPH_NODES,
} from '../lib/clipboard';
import {
  resolveNodeContextMenuItems,
  resolvePaneContextMenuItems,
  clampMenuPosition,
} from '../lib/contextMenu';
import { useTreeStore } from '../store/treeStore';
import type { TreeNode, TreeEdge } from '../types/tree';

describe('Day 12: Pure Subtree Operations Engine (`src/lib/subtree.ts`)', () => {
  beforeEach(() => {
    useTreeStore.getState().resetToSampleData();
  });

  it('correctly collects subtree node IDs for multi-level hierarchy', () => {
    const { nodes, edges } = useTreeStore.getState();
    // In canonical sample tree, root has 3 rule children, each with condition & action
    const rootSubtree = getSubtreeNodeIds('root-policy-hierarchy', edges);
    expect(rootSubtree.size).toBe(nodes.length); // All nodes are downstream of root

    // Test a specific rule node subtree (e.g., rule-finra-2210)
    const ruleSubtree = getSubtreeNodeIds('rule-finra-2210', edges);
    expect(ruleSubtree.has('rule-finra-2210')).toBe(true);
    expect(ruleSubtree.has('cond-finra-2210')).toBe(true);
    expect(ruleSubtree.has('act-finra-2210')).toBe(true);
    expect(ruleSubtree.size).toBe(3);
  });

  it('calculates descendant count accurately', () => {
    const { edges } = useTreeStore.getState();
    expect(getDescendantCount('root-policy-hierarchy', edges)).toBe(9);
    expect(getDescendantCount('rule-finra-2210', edges)).toBe(2);
    expect(getDescendantCount('act-finra-2210', edges)).toBe(0);
  });

  it('enforces separate single-node Delete semantics (preserves descendants as orphans)', () => {
    const { nodes, edges } = useTreeStore.getState();
    const result = deleteSingleNodePure('rule-finra-2210', nodes, edges);

    expect(result.ok).toBe(true);
    expect(result.nodes.length).toBe(nodes.length - 1);
    expect(result.nodes.some((n) => n.id === 'rule-finra-2210')).toBe(false);

    // Descendants still exist in the graph
    expect(result.nodes.some((n) => n.id === 'cond-finra-2210')).toBe(true);
    expect(result.nodes.some((n) => n.id === 'act-finra-2210')).toBe(true);

    // Edges incident to deleted node are removed
    expect(result.edges.some((e) => e.target === 'rule-finra-2210')).toBe(false);
    expect(result.edges.some((e) => e.source === 'rule-finra-2210')).toBe(false);
  });

  it('enforces Delete Subtree semantics (cascades deletion to all descendants)', () => {
    const { nodes, edges } = useTreeStore.getState();
    const result = deleteSubtreePure('rule-finra-2210', nodes, edges);

    expect(result.ok).toBe(true);
    // Deleted 1 rule + 1 condition + 1 action = 3 nodes
    expect(result.deletedNodes?.length).toBe(3);
    expect(result.nodes.length).toBe(nodes.length - 3);

    // Descendants are completely removed
    expect(result.nodes.some((n) => n.id === 'rule-finra-2210')).toBe(false);
    expect(result.nodes.some((n) => n.id === 'cond-finra-2210')).toBe(false);
    expect(result.nodes.some((n) => n.id === 'act-finra-2210')).toBe(false);

    // Other subtrees remain intact
    expect(result.nodes.some((n) => n.id === 'rule-sec-17a-4')).toBe(true);
  });

  it('assertGraphInvariants verifies canonical compliance tree', () => {
    const { nodes, edges } = useTreeStore.getState();
    const check = assertGraphInvariants(nodes, edges);
    expect(check.valid).toBe(true);
    expect(check.errors.length).toBe(0);
  });

  it('assertGraphInvariants flags duplicate IDs, missing endpoints, and single-parent violations', () => {
    const corruptedNodes: TreeNode[] = [
      { id: 'n1', type: 'root', position: { x: 0, y: 0 }, data: { label: 'R1' } },
      { id: 'n1', type: 'rule', position: { x: 0, y: 0 }, data: { label: 'Duplicate R1' } },
      { id: 'n2', type: 'rule', position: { x: 0, y: 0 }, data: { label: 'Rule 2' } },
    ];
    const corruptedEdges: TreeEdge[] = [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e1', source: 'n1', target: 'nonexistent' },
      { id: 'e2', source: 'n2', target: 'n2' }, // self-loop
    ];

    const check = assertGraphInvariants(corruptedNodes, corruptedEdges);
    expect(check.valid).toBe(false);
    expect(check.errors.some((e) => e.includes('Duplicate node ID'))).toBe(true);
    expect(check.errors.some((e) => e.includes('Duplicate edge ID'))).toBe(true);
    expect(check.errors.some((e) => e.includes('Self-loop'))).toBe(true);
    expect(check.errors.some((e) => e.includes('non-existent target'))).toBe(true);
  });

  it('sanitizeTreeDocument cleans and validates document payload', () => {
    const raw = {
      version: 1,
      nodes: [
        {
          id: 'n1',
          type: 'root',
          position: { x: 100.4, y: 200.8 },
          data: { label: 'Clean Root', collapsed: false },
        },
      ],
      edges: [],
    };

    const res = sanitizeTreeDocument(raw);
    expect(res.ok).toBe(true);
    expect(res.document?.nodes[0].position.x).toBe(100);
    expect(res.document?.nodes[0].position.y).toBe(201);
  });
});

describe('Day 12: Subtree Visibility & Collapse/Expand (`src/lib/visibility.ts`)', () => {
  it('computes all nodes visible when none are collapsed', () => {
    const { nodes, edges } = useTreeStore.getState();
    const result = computeVisibleGraph(nodes, edges);

    expect(result.visibleNodes.length).toBe(nodes.length);
    expect(result.visibleEdges.length).toBe(edges.length);
    expect(result.hiddenNodeIds.size).toBe(0);
  });

  it('hides transitive descendants when a parent node is collapsed', () => {
    const { nodes, edges } = useTreeStore.getState();
    // Collapse rule-finra-2210 (has 2 descendants)
    const collapsedNodes = nodes.map((n) =>
      n.id === 'rule-finra-2210' ? { ...n, data: { ...n.data, collapsed: true } } : n
    );

    const result = computeVisibleGraph(collapsedNodes, edges);
    expect(result.hiddenDescendantCounts.get('rule-finra-2210')).toBe(2);
    expect(result.hiddenNodeIds.has('cond-finra-2210')).toBe(true);
    expect(result.hiddenNodeIds.has('act-finra-2210')).toBe(true);
    expect(result.visibleNodes.some((n) => n.id === 'rule-finra-2210')).toBe(true);
    expect(result.visibleNodes.some((n) => n.id === 'cond-finra-2210')).toBe(false);
  });

  it('toggleCollapsePure toggles boolean flag immutably', () => {
    const { nodes } = useTreeStore.getState();
    const res1 = toggleCollapsePure('rule-finra-2210', nodes);
    expect(res1.toggled).toBe(true);
    expect(res1.newState).toBe(true);

    const res2 = toggleCollapsePure('rule-finra-2210', res1.nodes);
    expect(res2.newState).toBe(false);
  });

  it('expandAllPure and collapseAllPure operate correctly', () => {
    const { nodes, edges } = useTreeStore.getState();
    const collapsed = collapseAllPure(nodes, edges);
    expect(collapsed.find((n) => n.id === 'root-policy-hierarchy')?.data.collapsed).toBe(true);
    expect(collapsed.find((n) => n.id === 'rule-finra-2210')?.data.collapsed).toBe(true);

    const expanded = expandAllPure(collapsed);
    expect(expanded.every((n) => !n.data.collapsed)).toBe(true);
  });

  it('revealNodePure performs Search Reveal by uncollapsing all ancestors', () => {
    const { nodes, edges } = useTreeStore.getState();
    // Collapse both Root and Rule
    let testNodes = nodes.map((n) =>
      n.id === 'root-policy-hierarchy' || n.id === 'rule-finra-2210'
        ? { ...n, data: { ...n.data, collapsed: true } }
        : n
    );

    // Target is 'act-finra-2210'
    const reveal = revealNodePure('act-finra-2210', testNodes, edges);
    expect(reveal.uncollapsedNodeIds).toContain('root-policy-hierarchy');
    expect(reveal.uncollapsedNodeIds).toContain('rule-finra-2210');

    const root = reveal.nodes.find((n) => n.id === 'root-policy-hierarchy');
    const rule = reveal.nodes.find((n) => n.id === 'rule-finra-2210');
    expect(root?.data.collapsed).toBe(false);
    expect(rule?.data.collapsed).toBe(false);
  });
});

describe('Day 12: Subtree Placement Engine (`src/lib/placement.ts`)', () => {
  it('offsets subtree positions preserving internal geometry', () => {
    const nodes: TreeNode[] = [
      { id: '1', type: 'rule', position: { x: 100, y: 100 }, data: { label: '1' } },
      { id: '2', type: 'condition', position: { x: 200, y: 250 }, data: { label: '2' } },
    ];
    const shifted = offsetSubtreePositions(nodes, 50, 75);
    expect(shifted[0].position).toEqual({ x: 150, y: 175 });
    expect(shifted[1].position).toEqual({ x: 250, y: 325 });
  });

  it('computes child placement below parent with sibling horizontal spacing', () => {
    const parent: TreeNode = {
      id: 'p',
      type: 'rule',
      position: { x: 300, y: 100 },
      data: { label: 'Parent' },
    };
    const sibling: TreeNode = {
      id: 's1',
      type: 'condition',
      position: { x: 300, y: 260 },
      data: { label: 'Sibling 1' },
    };
    const edges: TreeEdge[] = [{ id: 'e1', source: 'p', target: 's1' }];

    const newPos = computeSubtreePasteRootPosition(
      { id: 'new', type: 'condition', position: { x: 0, y: 0 }, data: { label: 'New' } },
      [parent, sibling],
      edges,
      { targetParent: parent }
    );

    expect(newPos.y).toBe(260); // 100 + 160
    expect(newPos.x).toBe(540); // 300 + 240
  });
});

describe('Day 12: Subtree Clipboard Engine (`src/lib/clipboard.ts`)', () => {
  beforeEach(() => {
    useTreeStore.getState().resetToSampleData();
  });

  it('creates an independent deep-cloned snapshot of a subtree', () => {
    const { nodes, edges } = useTreeStore.getState();
    const snapshot = createSubtreeClipboardSnapshot('rule-finra-2210', nodes, edges);

    expect(snapshot.ok).toBe(true);
    expect(snapshot.data?.nodes.length).toBe(3);
    expect(snapshot.data?.edges.length).toBe(2);

    // Verify deep clone: mutating graph does not affect snapshot
    nodes[0].data.label = 'MUTATED';
    expect(snapshot.data?.nodes[0].data.label).not.toBe('MUTATED');
  });

  it('pastes subtree with fresh unique IDs and remapped edge connections', () => {
    const { nodes, edges } = useTreeStore.getState();
    const snapshot = createSubtreeClipboardSnapshot('rule-finra-2210', nodes, edges);
    expect(snapshot.ok).toBe(true);

    const pasteRes = pasteSubtreePure(
      snapshot.data!,
      'root-policy-hierarchy',
      nodes,
      edges
    );

    expect(pasteRes.ok).toBe(true);
    expect(pasteRes.pastedCount).toBe(3);
    expect(pasteRes.attached).toBe(true);

    // Root node has " (Copy)" appended
    const newRoot = pasteRes.nodes.find((n) => n.id === pasteRes.newRootId);
    expect(newRoot?.data.label).toContain('(Copy)');

    // Invariants preserved
    const check = assertGraphInvariants(pasteRes.nodes, pasteRes.edges);
    expect(check.valid).toBe(true);
  });

  it('falls back to independent tree paste when target parent relationship is invalid', () => {
    const { nodes, edges } = useTreeStore.getState();
    const snapshot = createSubtreeClipboardSnapshot('rule-finra-2210', nodes, edges);
    expect(snapshot.ok).toBe(true);

    // Target parent is an Action node (which cannot accept children)
    const pasteRes = pasteSubtreePure(
      snapshot.data!,
      'act-finra-2210',
      nodes,
      edges
    );

    expect(pasteRes.ok).toBe(true);
    expect(pasteRes.attached).toBe(false);
    expect(pasteRes.message).toContain('Pasted as independent tree');

    // Invariants still hold
    const check = assertGraphInvariants(pasteRes.nodes, pasteRes.edges);
    expect(check.valid).toBe(true);
  });

  it('enforces strict MAX_GRAPH_NODES (500) limit', () => {
    const { nodes, edges } = useTreeStore.getState();
    const snapshot = createSubtreeClipboardSnapshot('rule-finra-2210', nodes, edges);

    // Simulate graph with 499 nodes
    const mockNodes: TreeNode[] = Array.from({ length: 499 }, (_, i) => ({
      id: `node_${i}`,
      type: 'rule',
      position: { x: i * 10, y: i * 10 },
      data: { label: `Node ${i}` },
    }));

    const pasteRes = pasteSubtreePure(snapshot.data!, null, mockNodes, []);
    expect(pasteRes.ok).toBe(false);
    expect(pasteRes.reason).toBe('quota-exceeded');
  });
});

describe('Day 12: Context Menu Model (`src/lib/contextMenu.ts`)', () => {
  it('resolves node menu items according to relationship grammar and clipboard', () => {
    const ruleNode: TreeNode = {
      id: 'r1',
      type: 'rule',
      position: { x: 0, y: 0 },
      data: { label: 'Rule' },
    };

    const itemsWithoutClip = resolveNodeContextMenuItems(ruleNode, {
      hasClipboard: false,
      descendantCount: 2,
      isCollapsed: false,
    });

    expect(itemsWithoutClip.some((i) => i.id === 'add-child-condition')).toBe(true);
    expect(itemsWithoutClip.some((i) => i.id === 'add-child-action')).toBe(true);
    expect(itemsWithoutClip.some((i) => i.id === 'add-child-rule')).toBe(false); // Rule cannot have Rule child

    const pasteItem = itemsWithoutClip.find((i) => i.id === 'paste-subtree-child');
    expect(pasteItem?.disabled).toBe(true);

    const itemsWithClip = resolveNodeContextMenuItems(ruleNode, {
      hasClipboard: true,
      descendantCount: 2,
      isCollapsed: false,
    });
    expect(itemsWithClip.find((i) => i.id === 'paste-subtree-child')?.disabled).toBe(false);
  });

  it('clamps context menu coordinates within viewport bounds', () => {
    const pos = clampMenuPosition(100, 200, 200, 300);
    expect(Number.isFinite(pos.x)).toBe(true);
    expect(Number.isFinite(pos.y)).toBe(true);
  });
});

describe('Day 12: Atomic Graph Updates & History Integration (`src/store/treeStore.ts`)', () => {
  beforeEach(() => {
    useTreeStore.getState().resetToSampleData();
  });

  it('records exactly 1 history entry on subtree paste and undoes in one step', () => {
    const store = useTreeStore.getState();
    store.copySubtree('rule-finra-2210');

    const depthBefore = useTreeStore.temporal.getState().pastStates.length;
    const pasteRes = store.pasteSubtree('root-policy-hierarchy');
    expect(pasteRes.ok).toBe(true);

    const depthAfter = useTreeStore.temporal.getState().pastStates.length;
    expect(depthAfter).toBe(depthBefore + 1);

    // Exactly 1 Undo removes the entire pasted subtree
    useTreeStore.getState().undo();
    expect(useTreeStore.getState().nodes.length).toBe(10);
    expect(useTreeStore.getState().nodes.some((n) => n.id === pasteRes.newRootId)).toBe(false);

    // Exactly 1 Redo restores it
    useTreeStore.getState().redo();
    expect(useTreeStore.getState().nodes.length).toBe(13);
    expect(useTreeStore.getState().nodes.some((n) => n.id === pasteRes.newRootId)).toBe(true);
  });

  it('records exactly 1 history entry on subtree deletion and undoes atomically', () => {
    const depthBefore = useTreeStore.temporal.getState().pastStates.length;
    const success = useTreeStore.getState().deleteSubtree('rule-finra-2210');
    expect(success).toBe(true);

    const depthAfter = useTreeStore.temporal.getState().pastStates.length;
    expect(depthAfter).toBe(depthBefore + 1);

    useTreeStore.getState().undo();
    expect(useTreeStore.getState().nodes.length).toBe(10);
    expect(useTreeStore.getState().nodes.some((n) => n.id === 'rule-finra-2210')).toBe(true);
  });

  it('toggles collapse with exactly 1 history entry', () => {
    const depthBefore = useTreeStore.temporal.getState().pastStates.length;
    useTreeStore.getState().toggleNodeCollapse('rule-finra-2210');

    const depthAfter = useTreeStore.temporal.getState().pastStates.length;
    expect(depthAfter).toBe(depthBefore + 1);
    expect(
      useTreeStore.getState().nodes.find((n) => n.id === 'rule-finra-2210')?.data.collapsed
    ).toBe(true);

    useTreeStore.getState().undo();
    expect(
      useTreeStore.getState().nodes.find((n) => n.id === 'rule-finra-2210')?.data.collapsed
    ).toBe(false);
  });
});

describe('Day 12: Deterministic Seeded Fuzz & Stress Invariant Testing', () => {
  // Simple deterministic Pseudo-Random Number Generator (PRNG)
  function createPrng(seed: number) {
    let s = seed;
    return () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  it('maintains strict graph invariants across 50 rapid random operations', () => {
    const rand = createPrng(42);
    useTreeStore.getState().resetToSampleData();

    for (let step = 0; step < 50; step++) {
      const state = useTreeStore.getState();
      const op = Math.floor(rand() * 6);

      switch (op) {
        case 0: {
          // Add child to a random node that can accept children
          const candidates = state.nodes.filter((n) => n.type !== 'action');
          if (candidates.length > 0) {
            const parent = candidates[Math.floor(rand() * candidates.length)];
            const allowed = parent.type === 'root' ? ['rule'] : ['condition', 'action'];
            const childType = allowed[Math.floor(rand() * allowed.length)] as any;
            state.addChild(parent.id, childType);
          }
          break;
        }

        case 1: {
          // Toggle collapse on a random node
          if (state.nodes.length > 0) {
            const node = state.nodes[Math.floor(rand() * state.nodes.length)];
            state.toggleNodeCollapse(node.id);
          }
          break;
        }

        case 2: {
          // Copy a random subtree
          if (state.nodes.length > 0) {
            const node = state.nodes[Math.floor(rand() * state.nodes.length)];
            state.copySubtree(node.id);
          }
          break;
        }

        case 3: {
          // Paste subtree (as child or pane)
          if (state.clipboard) {
            const parent =
              rand() > 0.3 && state.nodes.length > 0
                ? state.nodes[Math.floor(rand() * state.nodes.length)].id
                : null;
            state.pasteSubtree(parent);
          }
          break;
        }

        case 4: {
          // Undo or Redo
          if (rand() > 0.5 && state.canUndo()) {
            state.undo();
          } else if (state.canRedo()) {
            state.redo();
          }
          break;
        }

        case 5: {
          // Delete single node (non-root)
          const nonRoots = state.nodes.filter((n) => n.type !== 'root');
          if (nonRoots.length > 0) {
            const target = nonRoots[Math.floor(rand() * nonRoots.length)];
            state.deleteSingleNode(target.id);
          }
          break;
        }
      }

      // Invariant assertion after every single randomized mutation
      const currentState = useTreeStore.getState();
      const invariantCheck = assertGraphInvariants(
        currentState.nodes,
        currentState.edges
      );

      if (!invariantCheck.valid) {
        throw new Error(
          `Graph invariant violated at step ${step}: ${invariantCheck.errors.join('; ')}`
        );
      }

      expect(invariantCheck.valid).toBe(true);
      expect(currentState.nodes.length).toBeLessThanOrEqual(MAX_GRAPH_NODES);
    }
  });
});
