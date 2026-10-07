import { describe, it, expect, beforeEach } from 'vitest';
import {
  useTreeStore,
  getCanonicalSampleNodes,
  getCanonicalSampleEdges,
} from '../store/treeStore';
import { validateConnection } from '../lib/connectionValidation';
import { wouldCreateCycle } from '../lib/cycleDetection';
import { isKeyboardEventTargetProtected, type ElementLike } from '../lib/keyboardSafety';
import type { TreeNode, TreeEdge } from '../types/tree';

describe('Day 5 Part 2 — Reconnection Safety & ignoreEdgeId', () => {
  beforeEach(() => {
    useTreeStore.getState().loadSampleTree();
  });

  describe('ignoreEdgeId in Shared Connection Validation', () => {
    it('prevents old edge from falsely counting as a duplicate when reconnected to the same endpoints', () => {
      const { nodes, edges } = useTreeStore.getState();
      const existingEdge = edges.find((e) => e.id === 'e-root-finra')!;
      expect(existingEdge).toBeDefined();

      // Without ignoreEdgeId, reconnecting e-root-finra to same endpoints is seen as duplicate
      const withoutIgnore = validateConnection(
        { source: existingEdge.source, target: existingEdge.target },
        nodes,
        edges
      );
      expect(withoutIgnore.ok).toBe(false);
      expect(withoutIgnore.reason).toBe('duplicate-edge');

      // With ignoreEdgeId, old edge is ignored and connection is recognized as valid
      const withIgnore = validateConnection(
        { source: existingEdge.source, target: existingEdge.target },
        nodes,
        edges,
        { ignoreEdgeId: existingEdge.id }
      );
      expect(withIgnore.ok).toBe(true);
    });

    it('prevents old edge from falsely counting as an existing parent when re-parenting a child', () => {
      const { nodes, edges } = useTreeStore.getState();
      // 'cond-finra-2210' currently has parent 'rule-finra-2210' via edge 'e-finra-cond'
      const existingEdge = edges.find((e) => e.id === 'e-finra-cond')!;
      expect(existingEdge).toBeDefined();

      // Propose reconnecting 'e-finra-cond' so that 'rule-sec-17a-4' becomes the parent of 'cond-finra-2210'
      // Without ignoreEdgeId: cond-finra-2210 already has a parent (e-finra-cond itself)
      const withoutIgnore = validateConnection(
        { source: 'rule-sec-17a-4', target: 'cond-finra-2210' },
        nodes,
        edges
      );
      expect(withoutIgnore.ok).toBe(false);
      expect(withoutIgnore.reason).toBe('has-parent');

      // With ignoreEdgeId = 'e-finra-cond': target node's old parent edge is ignored
      const withIgnore = validateConnection(
        { source: 'rule-sec-17a-4', target: 'cond-finra-2210' },
        nodes,
        edges,
        { ignoreEdgeId: existingEdge.id }
      );
      expect(withIgnore.ok).toBe(true);
      if (withIgnore.ok) {
        expect(withIgnore.relationshipType).toBe('rule-condition');
      }
    });

    it('prevents old edge from falsely triggering cycle detection during reconnection', () => {
      // Setup simple chain: A -> B -> C
      const mockEdges: TreeEdge[] = [
        { id: 'e-ab', source: 'node-a', target: 'node-b' },
        { id: 'e-bc', source: 'node-b', target: 'node-c' },
      ];

      // If we are replacing e-bc to point B -> D, ignoring e-bc ensures no false cycle paths
      expect(wouldCreateCycle('node-b', 'node-d', mockEdges, 'e-bc')).toBe(false);

      // In a circular loop A -> B, B -> A: ignoring e-ab breaks the cycle
      const cycleEdges: TreeEdge[] = [
        { id: 'e1', source: 'node-a', target: 'node-b' },
        { id: 'e2', source: 'node-b', target: 'node-a' },
      ];
      expect(wouldCreateCycle('node-b', 'node-a', cycleEdges, 'e1')).toBe(false);
      // But without ignoring e1, cycle is detected
      expect(wouldCreateCycle('node-b', 'node-a', cycleEdges)).toBe(true);
    });
  });

  describe('reconnectEdgeConnection Store Action', () => {
    it('executes atomic edge replacement when reconnection is valid', () => {
      const initialEdges = useTreeStore.getState().edges;
      const initialNodes = useTreeStore.getState().nodes;

      // Existing edge: e-finra-cond (rule-finra-2210 -> cond-finra-2210)
      const targetEdge = initialEdges.find((e) => e.id === 'e-finra-cond')!;
      expect(targetEdge).toBeDefined();

      // Reconnect source from rule-finra-2210 to rule-sec-17a-4
      const result = useTreeStore.getState().reconnectEdgeConnection(targetEdge, {
        source: 'rule-sec-17a-4',
        target: 'cond-finra-2210',
      });

      expect(result.ok).toBe(true);
      expect(result.edge).toBeDefined();
      expect(result.edge?.id).toBe(targetEdge.id); // Preserves edge ID
      expect(result.edge?.source).toBe('rule-sec-17a-4');
      expect(result.edge?.target).toBe('cond-finra-2210');
      expect(result.edge?.data?.relationshipType).toBe('rule-condition');

      const updatedEdges = useTreeStore.getState().edges;
      // Total edge count must remain strictly identical (atomic replacement)
      expect(updatedEdges).toHaveLength(initialEdges.length);

      // Edge in state must have new source
      const edgeInState = updatedEdges.find((e) => e.id === targetEdge.id)!;
      expect(edgeInState.source).toBe('rule-sec-17a-4');
      expect(edgeInState.target).toBe('cond-finra-2210');

      // Unrelated nodes must be completely preserved
      expect(useTreeStore.getState().nodes).toEqual(initialNodes);

      // Unrelated edges must be completely preserved
      const unrelatedEdges = updatedEdges.filter((e) => e.id !== targetEdge.id);
      const originalUnrelated = initialEdges.filter((e) => e.id !== targetEdge.id);
      expect(unrelatedEdges).toEqual(originalUnrelated);
    });

    it('preserves existing edge and causes ZERO graph mutation on invalid reconnection', () => {
      const stateBefore = {
        nodes: [...useTreeStore.getState().nodes],
        edges: [...useTreeStore.getState().edges],
      };

      const targetEdge = stateBefore.edges.find((e) => e.id === 'e-finra-cond')!;
      expect(targetEdge).toBeDefined();

      // Attempt invalid reconnection: Root -> Condition (disallowed relationship)
      const result = useTreeStore.getState().reconnectEdgeConnection(targetEdge, {
        source: 'root-policy-hierarchy',
        target: 'cond-finra-2210',
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('invalid-relationship');

      // ZERO graph mutation verification
      const stateAfter = useTreeStore.getState();
      expect(stateAfter.nodes).toEqual(stateBefore.nodes);
      expect(stateAfter.edges).toEqual(stateBefore.edges);

      // Original edge remains 100% intact
      const edgeAfter = stateAfter.edges.find((e) => e.id === targetEdge.id)!;
      expect(edgeAfter.source).toBe('rule-finra-2210');
      expect(edgeAfter.target).toBe('cond-finra-2210');
    });

    it('rejects reconnection when target node already has an unrelated parent', () => {
      const stateBefore = {
        edges: [...useTreeStore.getState().edges],
      };

      // 'act-finra-2210' already has parent 'rule-finra-2210' via 'e-finra-act'
      // Try to reconnect 'e-root-disc' (which is root -> rule-disc-09) to point to act-finra-2210
      const targetEdge = stateBefore.edges.find((e) => e.id === 'e-root-disc')!;

      const result = useTreeStore.getState().reconnectEdgeConnection(targetEdge, {
        source: 'rule-disc-09',
        target: 'act-finra-2210',
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('has-parent');

      // State remains completely untouched
      expect(useTreeStore.getState().edges).toEqual(stateBefore.edges);
    });

    it('preserves edge metadata and configuration on successful reconnection', () => {
      // Add custom metadata to an edge
      const initialEdges = useTreeStore.getState().edges;
      const customEdge: TreeEdge = {
        ...initialEdges[0],
        data: {
          ...initialEdges[0].data,
          customAuditTag: 'audit-2026',
          label: 'Special Pipeline',
        },
      };
      useTreeStore.setState({
        edges: [customEdge, ...initialEdges.slice(1)],
      });

      // Create a new free rule node
      const newRule = useTreeStore.getState().createNode('rule', { x: 50, y: 500 })!;

      // Reconnect customEdge to point root-policy-hierarchy -> newRule
      const result = useTreeStore.getState().reconnectEdgeConnection(customEdge, {
        source: 'root-policy-hierarchy',
        target: newRule.id,
      });

      expect(result.ok).toBe(true);
      expect(result.edge?.data?.customAuditTag).toBe('audit-2026');
      expect(result.edge?.data?.label).toBe('Special Pipeline');
      expect(result.edge?.data?.relationshipType).toBe('root-rule');
    });
  });
});

describe('Day 5 Part 2 — Edge Selection & Deletion Safety', () => {
  beforeEach(() => {
    useTreeStore.getState().loadSampleTree();
  });

  it('updates selectedEdgeId without mutating graph document', () => {
    expect(useTreeStore.getState().selectedEdgeId).toBeNull();

    useTreeStore.getState().setSelectedEdgeId('e-root-finra');
    expect(useTreeStore.getState().selectedEdgeId).toBe('e-root-finra');

    useTreeStore.getState().setSelectedEdgeId(null);
    expect(useTreeStore.getState().selectedEdgeId).toBeNull();
  });

  it('deletes only the specified edge and preserves all nodes and unrelated edges', () => {
    const initialNodes = useTreeStore.getState().nodes;
    const initialEdges = useTreeStore.getState().edges;
    const edgeToDelete = 'e-finra-cond';

    const deleted = useTreeStore.getState().deleteEdge(edgeToDelete);
    expect(deleted).toBe(true);

    const updatedEdges = useTreeStore.getState().edges;
    expect(updatedEdges).toHaveLength(initialEdges.length - 1);
    expect(updatedEdges.some((e) => e.id === edgeToDelete)).toBe(false);

    // Nodes must remain completely untouched
    expect(useTreeStore.getState().nodes).toEqual(initialNodes);

    // Both source and target nodes must still exist in the graph
    expect(useTreeStore.getState().nodes.some((n) => n.id === 'rule-finra-2210')).toBe(true);
    expect(useTreeStore.getState().nodes.some((n) => n.id === 'cond-finra-2210')).toBe(true);
  });

  it('clears selectedEdgeId when the selected edge is deleted', () => {
    useTreeStore.getState().setSelectedEdgeId('e-root-sec');
    expect(useTreeStore.getState().selectedEdgeId).toBe('e-root-sec');

    useTreeStore.getState().deleteEdge('e-root-sec');

    expect(useTreeStore.getState().selectedEdgeId).toBeNull();
  });

  it('preserves selectedNodeId when an edge is deleted', () => {
    useTreeStore.getState().setSelectedNodeId('rule-finra-2210');
    useTreeStore.getState().setSelectedEdgeId('e-root-sec');

    useTreeStore.getState().deleteEdge('e-root-sec');

    // Edge selection is cleared, but node selection is strictly preserved
    expect(useTreeStore.getState().selectedEdgeId).toBeNull();
    expect(useTreeStore.getState().selectedNodeId).toBe('rule-finra-2210');
  });

  it('cleans up stale selectedEdgeId when setEdges is called', () => {
    useTreeStore.getState().setSelectedEdgeId('e-root-finra');

    // setEdges without e-root-finra
    const filteredEdges = useTreeStore
      .getState()
      .edges.filter((e) => e.id !== 'e-root-finra');
    useTreeStore.getState().setEdges(filteredEdges);

    expect(useTreeStore.getState().selectedEdgeId).toBeNull();
  });

  it('returns false when attempting to delete non-existent edge', () => {
    const edgesBefore = useTreeStore.getState().edges;
    const result = useTreeStore.getState().deleteEdge('non-existent-edge-id');

    expect(result).toBe(false);
    expect(useTreeStore.getState().edges).toEqual(edgesBefore);
  });
});

describe('Day 5 Part 2 — Safe Malformed Input Handling', () => {
  beforeEach(() => {
    useTreeStore.getState().loadSampleTree();
  });

  it('handles null, undefined, or missing oldEdge in reconnectEdgeConnection safely', () => {
    const edgesBefore = useTreeStore.getState().edges;

    const res1 = useTreeStore.getState().reconnectEdgeConnection(null, {
      source: 'root-policy-hierarchy',
      target: 'rule-finra-2210',
    });
    expect(res1.ok).toBe(false);
    expect(res1.reason).toBe('malformed');

    const res2 = useTreeStore.getState().reconnectEdgeConnection({ id: '' } as TreeEdge, {
      source: 'root-policy-hierarchy',
      target: 'rule-finra-2210',
    });
    expect(res2.ok).toBe(false);
    expect(res2.reason).toBe('malformed');

    expect(useTreeStore.getState().edges).toEqual(edgesBefore);
  });

  it('handles missing or empty proposed connection endpoints safely', () => {
    const edgesBefore = useTreeStore.getState().edges;
    const targetEdge = edgesBefore[0];

    const res1 = useTreeStore.getState().reconnectEdgeConnection(targetEdge, null);
    expect(res1.ok).toBe(false);
    expect(res1.reason).toBe('malformed');

    const res2 = useTreeStore.getState().reconnectEdgeConnection(targetEdge, {
      source: null,
      target: 'rule-finra-2210',
    });
    expect(res2.ok).toBe(false);
    expect(res2.reason).toBe('malformed');

    expect(useTreeStore.getState().edges).toEqual(edgesBefore);
  });

  it('handles stale edge reference not present in graph', () => {
    const res = useTreeStore.getState().reconnectEdgeConnection(
      { id: 'stale-edge-999' } as TreeEdge,
      {
        source: 'root-policy-hierarchy',
        target: 'rule-finra-2210',
      }
    );
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('missing-node');
  });

  it('handles non-existent source or target node IDs in reconnection', () => {
    const targetEdge = useTreeStore.getState().edges[0];
    const res = useTreeStore.getState().reconnectEdgeConnection(targetEdge, {
      source: 'phantom-source-id',
      target: 'phantom-target-id',
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('missing-node');
  });

  it('handles empty or non-string edge deletion inputs safely', () => {
    expect(useTreeStore.getState().deleteEdge('')).toBe(false);
    // @ts-expect-error testing runtime robustness
    expect(useTreeStore.getState().deleteEdge(null)).toBe(false);
    // @ts-expect-error testing runtime robustness
    expect(useTreeStore.getState().deleteEdge(undefined)).toBe(false);
  });
});

describe('Day 5 Part 2 — Input Keyboard Safety Guard', () => {
  it('identifies standard input elements as protected', () => {
    const input: ElementLike = { tagName: 'INPUT' };
    const textarea: ElementLike = { tagName: 'TEXTAREA' };
    const select: ElementLike = { tagName: 'SELECT' };

    expect(isKeyboardEventTargetProtected(input)).toBe(true);
    expect(isKeyboardEventTargetProtected(textarea)).toBe(true);
    expect(isKeyboardEventTargetProtected(select)).toBe(true);
  });

  it('identifies contenteditable elements as protected', () => {
    const editableDiv: ElementLike = {
      tagName: 'DIV',
      isContentEditable: true,
    };
    expect(isKeyboardEventTargetProtected(editableDiv)).toBe(true);

    const editableSpan: ElementLike = {
      tagName: 'SPAN',
      getAttribute: (attr: string) => (attr === 'contenteditable' ? 'true' : null),
    };
    expect(isKeyboardEventTargetProtected(editableSpan)).toBe(true);
  });

  it('identifies elements inside a .nokey container as protected', () => {
    const childInsideNoKey: ElementLike = {
      tagName: 'BUTTON',
      closest: (selector: string) => (selector === '.nokey' ? {} : null),
    };
    expect(isKeyboardEventTargetProtected(childInsideNoKey)).toBe(true);

    const childWithoutNoKey: ElementLike = {
      tagName: 'BUTTON',
      closest: () => null,
    };
    expect(isKeyboardEventTargetProtected(childWithoutNoKey)).toBe(false);
  });

  it('identifies regular canvas elements as NOT protected', () => {
    const canvasPane: ElementLike = {
      tagName: 'DIV',
      closest: () => null,
    };
    const regularSvg: ElementLike = {
      tagName: 'SVG',
      closest: () => null,
    };

    expect(isKeyboardEventTargetProtected(canvasPane)).toBe(false);
    expect(isKeyboardEventTargetProtected(regularSvg)).toBe(false);
    expect(isKeyboardEventTargetProtected(null)).toBe(false);
    expect(isKeyboardEventTargetProtected(undefined)).toBe(false);
  });
});
