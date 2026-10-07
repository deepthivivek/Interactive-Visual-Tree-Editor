import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateConnection,
  type ConnectionCandidate,
} from '../lib/connectionValidation';
import {
  isValidParentChildRelationship,
  getAllowedChildTypes,
  getAllowedParentTypes,
  canHaveParent,
  canAcceptChild,
} from '../lib/relationshipRules';
import { wouldCreateCycle, hasAnyCycle } from '../lib/cycleDetection';
import {
  useTreeStore,
  getCanonicalSampleNodes,
  getCanonicalSampleEdges,
} from '../store/treeStore';
import type { TreeNode, TreeEdge } from '../types/tree';

describe('Day 5 — Relationship Rules & Grammar (relationshipRules.ts)', () => {
  it('validates allowed parent-child relationships correctly', () => {
    expect(isValidParentChildRelationship('root', 'rule')).toBe(true);
    expect(isValidParentChildRelationship('rule', 'condition')).toBe(true);
    expect(isValidParentChildRelationship('rule', 'action')).toBe(true);
    expect(isValidParentChildRelationship('condition', 'action')).toBe(true);
  });

  it('rejects disallowed parent-child pairings', () => {
    expect(isValidParentChildRelationship('root', 'condition')).toBe(false);
    expect(isValidParentChildRelationship('root', 'action')).toBe(false);
    expect(isValidParentChildRelationship('condition', 'rule')).toBe(false);
    expect(isValidParentChildRelationship('condition', 'root')).toBe(false);
    expect(isValidParentChildRelationship('action', 'rule')).toBe(false);
    expect(isValidParentChildRelationship('action', 'condition')).toBe(false);
    expect(isValidParentChildRelationship('action', 'action')).toBe(false);
    expect(isValidParentChildRelationship('rule', 'root')).toBe(false);
  });

  it('enforces canHaveParent constraints (Root cannot have parent)', () => {
    expect(canHaveParent('root')).toBe(false);
    expect(canHaveParent('rule')).toBe(true);
    expect(canHaveParent('condition')).toBe(true);
    expect(canHaveParent('action')).toBe(true);
  });

  it('enforces canAcceptChild constraints (Action cannot have children)', () => {
    expect(canAcceptChild('root')).toBe(true);
    expect(canAcceptChild('rule')).toBe(true);
    expect(canAcceptChild('condition')).toBe(true);
    expect(canAcceptChild('action')).toBe(false);
  });

  it('returns expected allowed child and parent lists', () => {
    expect(getAllowedChildTypes('root')).toEqual(['rule']);
    expect(getAllowedChildTypes('rule')).toEqual(['condition', 'action']);
    expect(getAllowedChildTypes('condition')).toEqual(['action']);
    expect(getAllowedChildTypes('action')).toEqual([]);

    expect(getAllowedParentTypes('root')).toEqual([]);
    expect(getAllowedParentTypes('rule')).toEqual(['root']);
    expect(getAllowedParentTypes('condition')).toEqual(['rule']);
    expect(getAllowedParentTypes('action')).toEqual(['rule', 'condition']);
  });
});

describe('Day 5 — Cycle Detection (cycleDetection.ts)', () => {
  it('detects immediate self-cycle (A -> A)', () => {
    expect(wouldCreateCycle('node-A', 'node-A', [])).toBe(true);
  });

  it('detects two-node cycle (A -> B, proposing B -> A)', () => {
    const edges = [{ id: 'e1', source: 'node-A', target: 'node-B' }];
    expect(wouldCreateCycle('node-B', 'node-A', edges)).toBe(true);
  });

  it('detects multi-hop cycle (A -> B -> C -> D, proposing D -> A)', () => {
    const edges = [
      { id: 'e1', source: 'node-A', target: 'node-B' },
      { id: 'e2', source: 'node-B', target: 'node-C' },
      { id: 'e3', source: 'node-C', target: 'node-D' },
    ];
    expect(wouldCreateCycle('node-D', 'node-A', edges)).toBe(true);
    expect(wouldCreateCycle('node-C', 'node-A', edges)).toBe(true);
  });

  it('permits valid acyclic connections', () => {
    const edges = [
      { id: 'e1', source: 'node-A', target: 'node-B' },
      { id: 'e2', source: 'node-A', target: 'node-C' },
    ];
    // Adding B -> D does not create cycle
    expect(wouldCreateCycle('node-B', 'node-D', edges)).toBe(false);
  });

  it('respects ignoreEdgeId during edge reconnection', () => {
    const edges = [
      { id: 'e1', source: 'node-A', target: 'node-B' },
      { id: 'e2', source: 'node-B', target: 'node-A' },
    ];
    // With e2 ignored, proposing B -> A would be based on A -> B alone (still cycle B->A)
    // But if we ignore e1, A -> B does not exist, so B -> A has no cycle
    expect(wouldCreateCycle('node-B', 'node-A', edges, 'e1')).toBe(false);
  });

  it('detects existing cycles in graph via hasAnyCycle', () => {
    const acyclicEdges = [
      { id: 'e1', source: 'A', target: 'B' },
      { id: 'e2', source: 'B', target: 'C' },
    ];
    expect(hasAnyCycle(acyclicEdges)).toBe(false);

    const cyclicEdges = [
      { id: 'e1', source: 'A', target: 'B' },
      { id: 'e2', source: 'B', target: 'C' },
      { id: 'e3', source: 'C', target: 'A' },
    ];
    expect(hasAnyCycle(cyclicEdges)).toBe(true);
  });
});

describe('Day 5 — Shared Connection Validator (connectionValidation.ts)', () => {
  const mockNodes: TreeNode[] = [
    { id: 'root-1', type: 'root', position: { x: 0, y: 0 }, data: { label: 'Root 1' } },
    { id: 'root-2', type: 'root', position: { x: 100, y: 0 }, data: { label: 'Root 2' } },
    { id: 'rule-1', type: 'rule', position: { x: 0, y: 100 }, data: { label: 'Rule 1' } },
    { id: 'rule-2', type: 'rule', position: { x: 100, y: 100 }, data: { label: 'Rule 2' } },
    { id: 'cond-1', type: 'condition', position: { x: 0, y: 200 }, data: { label: 'Condition 1' } },
    { id: 'act-1', type: 'action', position: { x: 0, y: 300 }, data: { label: 'Action 1' } },
    { id: 'act-2', type: 'action', position: { x: 100, y: 300 }, data: { label: 'Action 2' } },
  ];

  const mockEdges: TreeEdge[] = [
    { id: 'e-root-rule1', source: 'root-1', target: 'rule-1', data: { relationshipType: 'root-rule' } },
    { id: 'e-rule1-cond1', source: 'rule-1', target: 'cond-1', data: { relationshipType: 'rule-condition' } },
  ];

  describe('Valid Relationships', () => {
    it('approves Root -> Rule', () => {
      const result = validateConnection({ source: 'root-1', target: 'rule-2' }, mockNodes, mockEdges);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.relationshipType).toBe('root-rule');
      }
    });

    it('approves Rule -> Condition', () => {
      const freeCond: TreeNode = { id: 'cond-free', type: 'condition', position: { x: 0, y: 0 }, data: { label: 'Cond' } };
      const result = validateConnection(
        { source: 'rule-1', target: 'cond-free' },
        [...mockNodes, freeCond],
        mockEdges
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.relationshipType).toBe('rule-condition');
      }
    });

    it('approves Rule -> Action', () => {
      const result = validateConnection({ source: 'rule-1', target: 'act-1' }, mockNodes, mockEdges);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.relationshipType).toBe('rule-action');
      }
    });

    it('approves Condition -> Action', () => {
      const result = validateConnection({ source: 'cond-1', target: 'act-2' }, mockNodes, mockEdges);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.relationshipType).toBe('condition-action');
      }
    });
  });

  describe('Invalid Relationship Pairings', () => {
    it('rejects Root -> Condition', () => {
      const result = validateConnection({ source: 'root-1', target: 'cond-1' }, mockNodes, mockEdges);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('invalid-relationship');
      }
    });

    it('rejects Root -> Action', () => {
      const result = validateConnection({ source: 'root-1', target: 'act-1' }, mockNodes, mockEdges);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('invalid-relationship');
      }
    });

    it('rejects anything -> Root (Root cannot have parent)', () => {
      const result = validateConnection({ source: 'rule-1', target: 'root-2' }, mockNodes, mockEdges);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('invalid-relationship');
        expect(result.message).toContain('Root');
      }
    });

    it('rejects Action -> anything (Action cannot have children)', () => {
      const result = validateConnection({ source: 'act-1', target: 'rule-2' }, mockNodes, mockEdges);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('invalid-relationship');
        expect(result.message).toContain('Action');
      }
    });

    it('rejects Condition -> Rule', () => {
      const result = validateConnection({ source: 'cond-1', target: 'rule-2' }, mockNodes, mockEdges);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('invalid-relationship');
      }
    });
  });

  describe('Graph Hierarchy Constraints', () => {
    it('rejects self-links (source === target)', () => {
      const result = validateConnection({ source: 'rule-1', target: 'rule-1' }, mockNodes, mockEdges);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('self-link');
      }
    });

    it('rejects duplicate edges (exact source and target already connected)', () => {
      const result = validateConnection({ source: 'root-1', target: 'rule-1' }, mockNodes, mockEdges);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('duplicate-edge');
      }
    });

    it('rejects second parent (child node already has an incoming parent edge)', () => {
      // rule-1 already has parent root-1. Attempting root-2 -> rule-1 should fail
      const result = validateConnection({ source: 'root-2', target: 'rule-1' }, mockNodes, mockEdges);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('has-parent');
        expect(result.message).toContain('parent');
      }
    });

    it('rejects cycle creation', () => {
      // Create scenario where rule-1 -> cond-1 exists, and we propose cond-1 -> rule-1
      // Although condition -> rule also fails relationship, cycle check will trigger if checked
      const edgesWithLoop: TreeEdge[] = [
        { id: 'e1', source: 'rule-1', target: 'rule-2', data: { relationshipType: 'rule-action' } },
      ];
      // propose rule-2 -> rule-1
      const result = wouldCreateCycle('rule-2', 'rule-1', edgesWithLoop);
      expect(result).toBe(true);
    });
  });

  describe('Input & Malformed Connection Safety', () => {
    it('rejects null or missing connection input safely', () => {
      expect(validateConnection(null, mockNodes, mockEdges).ok).toBe(false);
      expect(validateConnection(undefined, mockNodes, mockEdges).ok).toBe(false);
      expect(validateConnection({ source: null, target: 'rule-1' }, mockNodes, mockEdges).ok).toBe(false);
      expect(validateConnection({ source: 'rule-1', target: '' }, mockNodes, mockEdges).ok).toBe(false);
    });

    it('rejects connections referencing non-existent nodes in graph', () => {
      const result = validateConnection({ source: 'ghost-node', target: 'rule-1' }, mockNodes, mockEdges);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('missing-node');
      }
    });
  });
});

describe('Day 5 — Zustand addEdgeConnection Action & Atomicity (treeStore.ts)', () => {
  beforeEach(() => {
    useTreeStore.getState().loadSampleTree();
  });

  it('permits creating a second Root node without error (decoupled creation)', () => {
    const initialRootCount = useTreeStore.getState().nodes.filter((n) => n.type === 'root').length;
    const secondRoot = useTreeStore.getState().createNode('root', { x: 700, y: 50 });
    expect(secondRoot).not.toBeNull();

    const newRootCount = useTreeStore.getState().nodes.filter((n) => n.type === 'root').length;
    expect(newRootCount).toBe(initialRootCount + 1);
  });

  it('adds exactly one edge on a valid connection attempt (atomic update)', () => {
    // Create an unconnected rule node
    const newRule = useTreeStore.getState().createNode('rule', { x: 100, y: 500 })!;
    const initialEdges = useTreeStore.getState().edges;

    // Connect root-policy-hierarchy -> newRule
    const result = useTreeStore.getState().addEdgeConnection({
      source: 'root-policy-hierarchy',
      target: newRule.id,
    });

    expect(result.ok).toBe(true);
    const updatedEdges = useTreeStore.getState().edges;
    expect(updatedEdges).toHaveLength(initialEdges.length + 1);
    expect(updatedEdges.some((e) => e.target === newRule.id)).toBe(true);
  });

  it('guarantees zero graph mutations on an invalid connection attempt (strict atomicity)', () => {
    const nodesBefore = useTreeStore.getState().nodes;
    const edgesBefore = useTreeStore.getState().edges;

    // Attempt invalid connection: Action -> Root
    const result = useTreeStore.getState().addEdgeConnection({
      source: 'act-finra-2210',
      target: 'root-policy-hierarchy',
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('invalid-relationship');

    // Graph state must remain 100% identical
    const stateAfter = useTreeStore.getState();
    expect(stateAfter.nodes).toEqual(nodesBefore);
    expect(stateAfter.edges).toEqual(edgesBefore);
  });

  it('rejects connecting a second parent to a node that already has a parent', () => {
    const edgesBefore = useTreeStore.getState().edges;

    // rule-finra-2210 already has parent root-policy-hierarchy
    // Create a second root
    const secondRoot = useTreeStore.getState().createNode('root', { x: 500, y: 50 })!;

    // Attempt secondRoot -> rule-finra-2210
    const result = useTreeStore.getState().addEdgeConnection({
      source: secondRoot.id,
      target: 'rule-finra-2210',
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('has-parent');
    expect(useTreeStore.getState().edges).toEqual(edgesBefore);
  });
});
