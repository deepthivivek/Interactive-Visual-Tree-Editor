import { describe, it, expect, beforeEach } from 'vitest';
import {
  isPolicyNodeType,
  createDefaultNode,
  createDefaultNodeData,
  generateUniqueNodeId,
} from '../lib/nodeFactory';
import {
  useTreeStore,
  INITIAL_SAMPLE_NODES,
  INITIAL_SAMPLE_EDGES,
  getCanonicalSampleNodes,
  getCanonicalSampleEdges,
} from '../store/treeStore';
import type { NodeType, TreeNode } from '../types/tree';

describe('Node Factory & Runtime Type Guard (Day 4)', () => {
  describe('isPolicyNodeType runtime type guard', () => {
    it('accepts valid supported node types', () => {
      expect(isPolicyNodeType('root')).toBe(true);
      expect(isPolicyNodeType('rule')).toBe(true);
      expect(isPolicyNodeType('condition')).toBe(true);
      expect(isPolicyNodeType('action')).toBe(true);
    });

    it('accepts valid types with irregular casing or whitespace', () => {
      expect(isPolicyNodeType(' ROOT ')).toBe(true);
      expect(isPolicyNodeType('Rule')).toBe(true);
      expect(isPolicyNodeType(' CONDITION')).toBe(true);
      expect(isPolicyNodeType('action ')).toBe(true);
    });

    it('rejects empty strings, null, undefined, and non-strings safely without casting', () => {
      expect(isPolicyNodeType('')).toBe(false);
      expect(isPolicyNodeType('   ')).toBe(false);
      expect(isPolicyNodeType(null)).toBe(false);
      expect(isPolicyNodeType(undefined)).toBe(false);
      expect(isPolicyNodeType(123)).toBe(false);
      expect(isPolicyNodeType({})).toBe(false);
      expect(isPolicyNodeType(['rule'])).toBe(false);
    });

    it('rejects unsupported or arbitrary strings', () => {
      expect(isPolicyNodeType('policy')).toBe(false);
      expect(isPolicyNodeType('unknown')).toBe(false);
      expect(isPolicyNodeType('subrule')).toBe(false);
      expect(isPolicyNodeType('custom')).toBe(false);
    });
  });

  describe('createDefaultNode pure factory', () => {
    it('creates a complete, typed Root node with generic non-regulatory data', () => {
      const node = createDefaultNode('root', { x: 120, y: 80 });
      expect(node.type).toBe('root');
      expect(node.id).toMatch(/^node_root_/);
      expect(node.position).toEqual({ x: 120, y: 80 });
      expect(node.data.label).toBe('New Root');
      expect(node.data.status).toBe('active');
      expect(node.data.severity).toBe('info');
      expect(node.data.ruleId).toBeUndefined(); // No mock regulatory IDs assigned
    });

    it('creates a complete, typed Rule node with generic non-regulatory data', () => {
      const node = createDefaultNode('rule', { x: 250, y: 150 });
      expect(node.type).toBe('rule');
      expect(node.id).toMatch(/^node_rule_/);
      expect(node.position).toEqual({ x: 250, y: 150 });
      expect(node.data.label).toBe('New Rule');
      expect(node.data.status).toBe('draft');
      expect(node.data.severity).toBe('medium');
    });

    it('creates a complete, typed Condition node with generic non-regulatory data', () => {
      const node = createDefaultNode('condition', { x: 300, y: 220 });
      expect(node.type).toBe('condition');
      expect(node.id).toMatch(/^node_condition_/);
      expect(node.position).toEqual({ x: 300, y: 220 });
      expect(node.data.label).toBe('New Condition');
      expect(node.data.status).toBe('draft');
    });

    it('creates a complete, typed Action node with generic non-regulatory data', () => {
      const node = createDefaultNode('action', { x: 400, y: 310 });
      expect(node.type).toBe('action');
      expect(node.id).toMatch(/^node_action_/);
      expect(node.position).toEqual({ x: 400, y: 310 });
      expect(node.data.label).toBe('New Action');
      expect(node.data.status).toBe('draft');
    });

    it('generates unique collision-resistant IDs', () => {
      const existing = ['node_rule_existing_1', 'node_rule_existing_2'];
      const nodeA = createDefaultNode('rule', { x: 0, y: 0 }, existing);
      const nodeB = createDefaultNode('rule', { x: 0, y: 0 }, [...existing, nodeA.id]);
      expect(nodeA.id).not.toBe(nodeB.id);
      expect(existing).not.toContain(nodeA.id);
      expect(existing).not.toContain(nodeB.id);
    });

    it('handles non-finite position coordinates safely without crashing', () => {
      const node = createDefaultNode('action', { x: NaN, y: Infinity });
      expect(node.position.x).toBe(0);
      expect(node.position.y).toBe(0);
    });
  });
});

describe('Zustand createNode Action & Graph Immutability (Day 4)', () => {
  beforeEach(() => {
    useTreeStore.getState().loadSampleTree();
  });

  it('adds exactly one node to the graph and preserves existing nodes and edges', () => {
    const initialNodes = useTreeStore.getState().nodes;
    const initialEdges = useTreeStore.getState().edges;

    const createdNode = useTreeStore.getState().createNode('rule', { x: 350, y: 400 });
    expect(createdNode).not.toBeNull();

    const state = useTreeStore.getState();
    expect(state.nodes).toHaveLength(initialNodes.length + 1);
    expect(state.edges).toHaveLength(initialEdges.length);
    expect(state.nodes.some((n) => n.id === createdNode!.id)).toBe(true);
  });

  it('automatically selects the newly created node', () => {
    expect(useTreeStore.getState().selectedNodeId).toBeNull();

    const createdNode = useTreeStore.getState().createNode('condition', { x: 100, y: 100 });
    expect(useTreeStore.getState().selectedNodeId).toBe(createdNode!.id);
  });

  it('permits creating multiple temporary Root nodes on Day 4 (creation decoupled from validation)', () => {
    // Current sample has 1 root
    const rootCountInitial = useTreeStore.getState().nodes.filter((n) => n.type === 'root').length;
    expect(rootCountInitial).toBe(1);

    // Day 4 explicitly permits temporary invalid structures (e.g. multiple roots, disconnected nodes)
    const secondRoot = useTreeStore.getState().createNode('root', { x: 600, y: 100 });
    expect(secondRoot).not.toBeNull();

    const updatedRoots = useTreeStore.getState().nodes.filter((n) => n.type === 'root');
    expect(updatedRoots).toHaveLength(2);
  });

  it('guarantees immutable graph updates without mutating existing object references', () => {
    const stateBefore = useTreeStore.getState();
    const originalFirstNode = stateBefore.nodes[0];
    const originalFirstEdge = stateBefore.edges[0];

    // Snapshot properties
    const originalLabel = originalFirstNode.data.label;
    const originalPos = { ...originalFirstNode.position };

    // Create a new node
    useTreeStore.getState().createNode('action', { x: 500, y: 600 });
    const stateAfter = useTreeStore.getState();

    // Verify existing nodes and edges retain their original data
    expect(stateAfter.nodes[0].id).toBe(originalFirstNode.id);
    expect(stateAfter.nodes[0].data.label).toBe(originalLabel);
    expect(stateAfter.nodes[0].position).toEqual(originalPos);
    expect(stateAfter.edges[0].id).toBe(originalFirstEdge.id);
  });

  it('rejects invalid node types safely and modifies no graph or selection state', () => {
    const nodesBefore = useTreeStore.getState().nodes;
    const edgesBefore = useTreeStore.getState().edges;
    const selectedBefore = useTreeStore.getState().selectedNodeId;

    // @ts-expect-error Testing invalid runtime input
    const result = useTreeStore.getState().createNode('invalid_type', { x: 100, y: 100 });
    expect(result).toBeNull();

    const stateAfter = useTreeStore.getState();
    expect(stateAfter.nodes).toEqual(nodesBefore);
    expect(stateAfter.edges).toEqual(edgesBefore);
    expect(stateAfter.selectedNodeId).toBe(selectedBefore);
  });

  it('rejects invalid or non-finite coordinates safely without modifying graph state', () => {
    const nodesBefore = useTreeStore.getState().nodes;

    const resultNaN = useTreeStore.getState().createNode('rule', { x: NaN, y: 100 });
    const resultInf = useTreeStore.getState().createNode('rule', { x: 100, y: Infinity });

    expect(resultNaN).toBeNull();
    expect(resultInf).toBeNull();
    expect(useTreeStore.getState().nodes).toEqual(nodesBefore);
  });
});

describe('Canonical Sample Tree Immutability & Restoration (Day 4)', () => {
  beforeEach(() => {
    useTreeStore.getState().loadSampleTree();
  });

  it('loadSampleTree replaces active graph with canonical sample without duplicate accumulation', () => {
    // Add two extra nodes
    useTreeStore.getState().createNode('rule', { x: 10, y: 10 });
    useTreeStore.getState().createNode('action', { x: 20, y: 20 });
    expect(useTreeStore.getState().nodes).toHaveLength(INITIAL_SAMPLE_NODES.length + 2);

    // Call loadSampleTree
    useTreeStore.getState().loadSampleTree();
    const state = useTreeStore.getState();

    expect(state.nodes).toHaveLength(INITIAL_SAMPLE_NODES.length);
    expect(state.edges).toHaveLength(INITIAL_SAMPLE_EDGES.length);
    expect(state.selectedNodeId).toBeNull();

    // Call it repeatedly - graph does not duplicate
    useTreeStore.getState().loadSampleTree();
    expect(useTreeStore.getState().nodes).toHaveLength(INITIAL_SAMPLE_NODES.length);
  });

  it('preserves canonical sample constant immutability when active graph is modified', () => {
    // Mutate an active node in the store
    const currentNodes = useTreeStore.getState().nodes;
    currentNodes[0].data.label = 'MUTATED IN SESSION';

    // Verify canonical getters return unmodified original data
    const freshSample = getCanonicalSampleNodes();
    expect(freshSample[0].data.label).toBe('Policy Hierarchy');
    expect(freshSample[0].data.label).not.toBe('MUTATED IN SESSION');
  });

  it('restores stable canonical node IDs, edges, and positions upon loadSampleTree', () => {
    useTreeStore.getState().setNodes([]);
    useTreeStore.getState().setEdges([]);

    useTreeStore.getState().loadSampleTree();
    const restored = useTreeStore.getState();

    expect(restored.nodes[0].id).toBe('root-policy-hierarchy');
    expect(restored.nodes[0].position).toEqual({ x: 450, y: 40 });
    expect(restored.edges[0].id).toBe('e-root-finra');
  });
});
