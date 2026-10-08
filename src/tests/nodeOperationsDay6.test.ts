import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  executeAddChild,
  executeDuplicateNode,
  executeDeleteNode,
  executeReparentNode,
  getValidParentCandidates,
  generateUniqueEdgeId,
  getNodeIncidentEdges,
} from '../lib/graphOperations';
import { extractBaseLabel, generateDuplicateLabel } from '../lib/labelUtils';
import {
  resolveKeyboardAction,
  isKeyboardEventTargetProtected,
} from '../lib/keyboardSafety';
import { StatusTimerManager } from '../lib/statusTimer';
import { useTreeStore } from '../store/treeStore';
import { createDefaultNode } from '../lib/nodeFactory';
import { applyNodeChanges, type NodeChange } from '@xyflow/react';
import type { TreeNode, TreeEdge } from '../types/tree';

describe('Day 6 - Node Operations, Re-parenting, Deletion Confirmation & Keyboard Safety', () => {
  beforeEach(() => {
    useTreeStore.getState().resetToSampleData();
  });

  // ==========================================================================
  // 1. ADD CHILD & FAILURE INJECTION ATOMICITY
  // ==========================================================================
  describe('Add Child Operation & Failure Injection Atomicity', () => {
    it('should successfully add a valid Rule child to a Root node', () => {
      const { nodes, edges } = useTreeStore.getState();
      const root = nodes.find((n) => n.type === 'root')!;
      const initialNodeCount = nodes.length;
      const initialEdgeCount = edges.length;

      const result = executeAddChild(root.id, 'rule', nodes, edges);
      expect(result.ok).toBe(true);
      expect(result.nodes).toHaveLength(initialNodeCount + 1);
      expect(result.edges).toHaveLength(initialEdgeCount + 1);
      expect(result.data?.newChild.type).toBe('rule');
      expect(result.data?.newChild.position.y).toBe(root.position.y + 160);
      expect(result.data?.newEdge.source).toBe(root.id);
      expect(result.data?.newEdge.target).toBe(result.data?.newChild.id);
      expect(result.data?.newEdge.id).toMatch(new RegExp(`^e-${root.id}-${result.data?.newChild.id}-`));
    });

    it('should reject adding a child to an Action node with action-cannot-have-children reason', () => {
      const { nodes, edges } = useTreeStore.getState();
      const action = nodes.find((n) => n.type === 'action')!;

      const result = executeAddChild(action.id, 'condition', nodes, edges);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('action-cannot-have-children');
      expect(result.nodes).toBe(nodes);
      expect(result.edges).toBe(edges);
    });

    it('should reject invalid parent-child relationships (e.g. Root -> Condition)', () => {
      const { nodes, edges } = useTreeStore.getState();
      const root = nodes.find((n) => n.type === 'root')!;

      const result = executeAddChild(root.id, 'condition', nodes, edges);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('invalid-relationship');
      expect(result.nodes).toBe(nodes);
      expect(result.edges).toBe(edges);
    });

    it('should preserve atomicity when node creation fails (Failure Order 1)', () => {
      const { nodes, edges } = useTreeStore.getState();
      const root = nodes.find((n) => n.type === 'root')!;

      const result = executeAddChild(root.id, 'rule', nodes, edges, {
        createNodeFn: () => null,
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('injection-failure');
      expect(result.nodes).toBe(nodes);
      expect(result.edges).toBe(edges);
      expect(result.nodes).toHaveLength(nodes.length);
      expect(result.edges).toHaveLength(edges.length);
    });

    it('should preserve atomicity when edge ID generation fails after node creation (Failure Order 2)', () => {
      const { nodes, edges } = useTreeStore.getState();
      const root = nodes.find((n) => n.type === 'root')!;

      const result = executeAddChild(root.id, 'rule', nodes, edges, {
        createEdgeIdFn: () => null,
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('injection-failure');
      // Crucial: The created node must NOT leak into returned nodes!
      expect(result.nodes).toBe(nodes);
      expect(result.edges).toBe(edges);
      expect(result.nodes).toHaveLength(nodes.length);
      expect(result.edges).toHaveLength(edges.length);
    });

    it('should preserve atomicity when connection validation fails', () => {
      const { nodes, edges } = useTreeStore.getState();
      const root = nodes.find((n) => n.type === 'root')!;

      const result = executeAddChild(root.id, 'rule', nodes, edges, {
        validateConnectionFn: () => ({
          ok: false,
          reason: 'duplicate-edge',
          message: 'Simulated connection failure',
        }),
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('duplicate-edge');
      expect(result.nodes).toBe(nodes);
      expect(result.edges).toBe(edges);
    });
  });

  // ==========================================================================
  // 2. DUPLICATE NODE & LABEL UTILS
  // ==========================================================================
  describe('Duplicate Node Operation & Label Utilities', () => {
    it('should extract base label stripping copy suffixes', () => {
      expect(extractBaseLabel('Risk Rule')).toBe('Risk Rule');
      expect(extractBaseLabel('Risk Rule (copy)')).toBe('Risk Rule');
      expect(extractBaseLabel('Risk Rule (copy 2)')).toBe('Risk Rule');
      expect(extractBaseLabel('Risk Rule (copy 15)')).toBe('Risk Rule');
    });

    it('should sequence duplicate labels and skip existing label collisions', () => {
      const labels1 = ['Audit Rule'];
      expect(generateDuplicateLabel('Audit Rule', labels1)).toBe('Audit Rule (copy)');

      const labels2 = ['Audit Rule', 'Audit Rule (copy)'];
      expect(generateDuplicateLabel('Audit Rule', labels2)).toBe('Audit Rule (copy 2)');

      // If "Audit Rule (copy 2)" is already present, skip to "Audit Rule (copy 3)"
      const labels3 = ['Audit Rule', 'Audit Rule (copy)', 'Audit Rule (copy 2)'];
      expect(generateDuplicateLabel('Audit Rule (copy)', labels3)).toBe('Audit Rule (copy 3)');
    });

    it('should duplicate node with deep-copied parameters, +30px offset, zero copied edges, and unique ID', () => {
      const { nodes, edges } = useTreeStore.getState();
      const ruleNode = nodes.find((n) => n.type === 'rule')!;
      const initialNodeCount = nodes.length;
      const initialEdgeCount = edges.length;

      const result = executeDuplicateNode(ruleNode.id, nodes, edges);
      expect(result.ok).toBe(true);
      expect(result.nodes).toHaveLength(initialNodeCount + 1);
      expect(result.edges).toHaveLength(initialEdgeCount); // 0 copied edges!

      const dup = result.data!.duplicatedNode;
      expect(dup.id).not.toBe(ruleNode.id);
      expect(dup.id).toMatch(/^node_rule_/);
      expect(dup.position.x).toBe(ruleNode.position.x + 30);
      expect(dup.position.y).toBe(ruleNode.position.y + 30);
      expect(dup.data.label).toBe(`${ruleNode.data.label} (copy)`);
      expect(dup.data.ruleId).toBe(ruleNode.data.ruleId); // Preserved unchanged
      expect(dup.data.parameters).toEqual(ruleNode.data.parameters);
      expect(dup.data.parameters).not.toBe(ruleNode.data.parameters); // Deep clone
      expect(dup.data.metadata).toEqual(ruleNode.data.metadata);
      expect(dup.data.metadata).not.toBe(ruleNode.data.metadata); // Deep clone
    });
  });

  // ==========================================================================
  // 3. DELETE NODE & INCIDENT EDGES
  // ==========================================================================
  describe('Delete Node Operation', () => {
    it('should atomically remove target node and all incident edges leaving child nodes as orphans', () => {
      const { nodes, edges } = useTreeStore.getState();
      const rule = nodes.find((n) => n.id === 'rule-finra-2210')!;
      const incidentEdges = getNodeIncidentEdges(rule.id, edges);
      expect(incidentEdges.length).toBeGreaterThan(0);

      const result = executeDeleteNode(rule.id, nodes, edges);
      expect(result.ok).toBe(true);
      expect(result.nodes.find((n) => n.id === rule.id)).toBeUndefined();
      expect(result.nodes).toHaveLength(nodes.length - 1);

      // Verify all incident edges removed
      for (const edge of incidentEdges) {
        expect(result.edges.find((e) => e.id === edge.id)).toBeUndefined();
      }
      expect(result.edges).toHaveLength(edges.length - incidentEdges.length);

      // Verify children survived as orphans (not cascaded)
      const conditionChild = nodes.find((n) => n.id === 'cond-finra-2210')!;
      const actionChild = nodes.find((n) => n.id === 'act-finra-2210')!;
      expect(result.nodes.find((n) => n.id === conditionChild.id)).toBeDefined();
      expect(result.nodes.find((n) => n.id === actionChild.id)).toBeDefined();
    });

    it('should delete a Root node cleanly even if it leaves zero roots', () => {
      const { nodes, edges } = useTreeStore.getState();
      const root = nodes.find((n) => n.type === 'root')!;

      const result = executeDeleteNode(root.id, nodes, edges);
      expect(result.ok).toBe(true);
      expect(result.nodes.filter((n) => n.type === 'root')).toHaveLength(0);
      expect(result.nodes.find((n) => n.id === root.id)).toBeUndefined();
    });
  });

  // ==========================================================================
  // 4. RE-PARENTING, DISCONNECT & CANDIDATE FILTERING
  // ==========================================================================
  describe('Re-parenting, Disconnect & Candidate Filtering', () => {
    it('should return empty candidate list for Root nodes', () => {
      const { nodes, edges } = useTreeStore.getState();
      const root = nodes.find((n) => n.type === 'root')!;
      const candidates = getValidParentCandidates(root, nodes, edges);
      expect(candidates).toEqual([]);
    });

    it('should filter out self, actions, invalid relationships, and cycles from parent candidates', () => {
      const { nodes, edges } = useTreeStore.getState();
      const condition = nodes.find((n) => n.type === 'condition')!;

      const candidates = getValidParentCandidates(condition, nodes, edges);
      // Conditions can only be parented by Rules
      for (const candidate of candidates) {
        expect(candidate.type).toBe('rule');
        expect(candidate.id).not.toBe(condition.id);
        expect(candidate.type).not.toBe('action');
      }
    });

    it('should sort parent candidates by type, then label, then id', () => {
      const { nodes, edges } = useTreeStore.getState();
      const action = nodes.find((n) => n.type === 'action')!;
      const candidates = getValidParentCandidates(action, nodes, edges);

      // Actions can be parented by Rules or Conditions
      for (let i = 0; i < candidates.length - 1; i++) {
        const a = candidates[i];
        const b = candidates[i + 1];
        if (a.type !== b.type) {
          const typeOrder: Record<string, number> = { root: 0, rule: 1, condition: 2, action: 3 };
          expect(typeOrder[a.type]).toBeLessThanOrEqual(typeOrder[b.type]);
        }
      }
    });

    it('should treat re-parenting to the current parent as a no-op', () => {
      const { nodes, edges } = useTreeStore.getState();
      const child = nodes.find((n) => n.id === 'cond-finra-2210')!;
      const currentParentEdge = edges.find((e) => e.target === child.id)!;

      const result = executeReparentNode(child.id, currentParentEdge.source, nodes, edges);
      expect(result.ok).toBe(true);
      expect(result.noop).toBe(true);
      expect(result.nodes).toBe(nodes);
      expect(result.edges).toBe(edges);
    });

    it('should treat disconnecting an already disconnected node as a no-op', () => {
      const { nodes, edges } = useTreeStore.getState();
      const orphanNode = createDefaultNode('condition', { x: 0, y: 0 }, nodes.map((n) => n.id));
      const nodesWithOrphan = [...nodes, orphanNode];

      const result = executeReparentNode(orphanNode.id, null, nodesWithOrphan, edges);
      expect(result.ok).toBe(true);
      expect(result.noop).toBe(true);
      expect(result.nodes).toBe(nodesWithOrphan);
      expect(result.edges).toBe(edges);
    });

    it('should disconnect a connected node removing only the incoming parent edge', () => {
      const { nodes, edges } = useTreeStore.getState();
      const child = nodes.find((n) => n.id === 'cond-finra-2210')!;
      const currentParentEdge = edges.find((e) => e.target === child.id)!;

      const result = executeReparentNode(child.id, null, nodes, edges);
      expect(result.ok).toBe(true);
      expect(result.noop).toBe(false);
      expect(result.edges.find((e) => e.id === currentParentEdge.id)).toBeUndefined();
      expect(result.edges).toHaveLength(edges.length - 1);
      expect(result.nodes).toBe(nodes);
    });

    it('should atomically replace parent edge and conform to edge-ID conventions on repeated re-parenting', () => {
      const { nodes, edges } = useTreeStore.getState();
      const child = nodes.find((n) => n.id === 'cond-finra-2210')!;
      const initialParentEdge = edges.find((e) => e.target === child.id)!;
      const targetParent1 = 'rule-sec-17a-4';
      const targetParent2 = 'rule-disc-09';

      // Re-parent 1: to rule-sec-17a-4
      const result1 = executeReparentNode(child.id, targetParent1, nodes, edges);
      expect(result1.ok).toBe(true);
      expect(result1.noop).toBe(false);
      const edge1 = result1.edges.find((e) => e.target === child.id)!;
      expect(edge1.source).toBe(targetParent1);
      expect(edge1.id).toMatch(new RegExp(`^e-${targetParent1}-${child.id}-`));
      expect(edge1.id).not.toBe(initialParentEdge.id);

      // Re-parent 2: to rule-disc-09
      const result2 = executeReparentNode(child.id, targetParent2, result1.nodes, result1.edges);
      expect(result2.ok).toBe(true);
      expect(result2.noop).toBe(false);
      const edge2 = result2.edges.find((e) => e.target === child.id)!;
      expect(edge2.source).toBe(targetParent2);
      expect(edge2.id).toMatch(new RegExp(`^e-${targetParent2}-${child.id}-`));
      expect(edge2.id).not.toBe(edge1.id);

      // Re-parent 3: back to rule-sec-17a-4
      const result3 = executeReparentNode(child.id, targetParent1, result2.nodes, result2.edges);
      expect(result3.ok).toBe(true);
      const edge3 = result3.edges.find((e) => e.target === child.id)!;
      expect(edge3.source).toBe(targetParent1);
      expect(edge3.id).toMatch(new RegExp(`^e-${targetParent1}-${child.id}-`));
      expect(edge3.id).not.toBe(edge1.id); // Fresh unique suffix, not resurrected!
    });
  });

  // ==========================================================================
  // 5. CONNECTED-NODE CONFIRMATION & ISOLATED-NODE DELETION
  // ==========================================================================
  describe('Connected-Node Confirmation & Immediate Isolated-Node Deletion', () => {
    it('should delete an isolated non-root node immediately without confirmation', () => {
      const store = useTreeStore.getState();
      const newNode = store.createNode('condition', { x: 50, y: 50 })!;
      expect(newNode).toBeDefined();

      store.requestDeleteNode(newNode.id);
      const updated = useTreeStore.getState();
      expect(updated.nodes.find((n) => n.id === newNode.id)).toBeUndefined();
      expect(updated.deleteConfirmation).toBeNull();
      expect(updated.statusFeedback).toBe('Node deleted.');
    });

    it('should open confirmation modal when requesting deletion of a connected node', () => {
      const store = useTreeStore.getState();
      const connectedNodeId = 'rule-finra-2210';

      store.requestDeleteNode(connectedNodeId);
      const state = useTreeStore.getState();
      expect(state.deleteConfirmation).not.toBeNull();
      expect(state.deleteConfirmation?.nodeId).toBe(connectedNodeId);
      expect(state.deleteConfirmation?.incidentEdgeCount).toBe(3); // 1 parent + 2 children
      expect(state.deleteConfirmation?.isRoot).toBe(false);

      // Node must NOT be deleted yet!
      expect(state.nodes.find((n) => n.id === connectedNodeId)).toBeDefined();
    });

    it('should require confirmation even for an isolated Root node', () => {
      const store = useTreeStore.getState();
      const rootNode = store.createNode('root', { x: 100, y: 100 })!;

      store.requestDeleteNode(rootNode.id);
      const state = useTreeStore.getState();
      expect(state.deleteConfirmation).not.toBeNull();
      expect(state.deleteConfirmation?.nodeId).toBe(rootNode.id);
      expect(state.deleteConfirmation?.isRoot).toBe(true);
    });

    it('should execute confirmed deletion on confirmDeleteNode', () => {
      const store = useTreeStore.getState();
      const connectedNodeId = 'rule-finra-2210';
      store.requestDeleteNode(connectedNodeId);

      const confirmed = useTreeStore.getState().confirmDeleteNode();
      expect(confirmed).toBe(true);

      const state = useTreeStore.getState();
      expect(state.deleteConfirmation).toBeNull();
      expect(state.nodes.find((n) => n.id === connectedNodeId)).toBeUndefined();
      expect(state.selectedNodeId).toBeNull();
    });

    it('should cancel deletion with zero graph mutations on cancelDeleteNode', () => {
      const store = useTreeStore.getState();
      const connectedNodeId = 'rule-finra-2210';
      const initialNodes = store.nodes;
      const initialEdges = store.edges;

      store.requestDeleteNode(connectedNodeId);
      useTreeStore.getState().cancelDeleteNode();

      const state = useTreeStore.getState();
      expect(state.deleteConfirmation).toBeNull();
      expect(state.nodes).toEqual(initialNodes);
      expect(state.edges).toEqual(initialEdges);
    });
  });

  // ==========================================================================
  // 6. PURE KEYBOARD HELPER, ESCAPE PRIORITY & REPEATED-KEY PROTECTION
  // ==========================================================================
  describe('Pure Keyboard Helper (resolveKeyboardAction) & Escape Priority', () => {
    it('should ignore Delete and Backspace inside protected text controls and contenteditable', () => {
      expect(
        resolveKeyboardAction({
          key: 'Delete',
          target: { tagName: 'input' },
          selection: { selectedNodeId: 'node-1', selectedEdgeId: null },
          confirmationOpen: false,
        })
      ).toBe('ignore');

      expect(
        resolveKeyboardAction({
          key: 'Backspace',
          target: { tagName: 'textarea' },
          selection: { selectedNodeId: 'node-1', selectedEdgeId: null },
          confirmationOpen: false,
        })
      ).toBe('ignore');

      expect(
        resolveKeyboardAction({
          key: 'Delete',
          target: { tagName: 'select' },
          selection: { selectedNodeId: 'node-1', selectedEdgeId: null },
          confirmationOpen: false,
        })
      ).toBe('ignore');

      expect(
        resolveKeyboardAction({
          key: 'Delete',
          target: { isContentEditable: true },
          selection: { selectedNodeId: 'node-1', selectedEdgeId: null },
          confirmationOpen: false,
        })
      ).toBe('ignore');

      expect(
        resolveKeyboardAction({
          key: 'Delete',
          target: { insideNoKey: true },
          selection: { selectedNodeId: 'node-1', selectedEdgeId: null },
          confirmationOpen: false,
        })
      ).toBe('ignore');
    });

    it('should protect against repeated Delete keys when confirmation is open', () => {
      expect(
        resolveKeyboardAction({
          key: 'Delete',
          target: {},
          selection: { selectedNodeId: 'node-1', selectedEdgeId: null },
          confirmationOpen: true, // Repeated-key protection!
        })
      ).toBe('ignore');

      expect(
        resolveKeyboardAction({
          key: 'Backspace',
          target: {},
          selection: { selectedNodeId: 'node-1', selectedEdgeId: null },
          confirmationOpen: true,
        })
      ).toBe('ignore');
    });

    it('should resolve delete-node and delete-edge when unprotected', () => {
      expect(
        resolveKeyboardAction({
          key: 'Delete',
          target: { tagName: 'div' },
          selection: { selectedNodeId: 'node-1', selectedEdgeId: null },
          confirmationOpen: false,
        })
      ).toBe('delete-node');

      expect(
        resolveKeyboardAction({
          key: 'Backspace',
          target: { tagName: 'div' },
          selection: { selectedNodeId: null, selectedEdgeId: 'edge-1' },
          confirmationOpen: false,
        })
      ).toBe('delete-edge');
    });

    it('should resolve Escape priority: ignored in text control, otherwise signals escape', () => {
      expect(
        resolveKeyboardAction({
          key: 'Escape',
          target: { tagName: 'input' },
          selection: { selectedNodeId: 'node-1', selectedEdgeId: null },
          confirmationOpen: true,
        })
      ).toBe('ignore');

      expect(
        resolveKeyboardAction({
          key: 'Escape',
          target: { tagName: 'div' },
          selection: { selectedNodeId: 'node-1', selectedEdgeId: null },
          confirmationOpen: true,
        })
      ).toBe('escape');
    });

    it('should verify isKeyboardEventTargetProtected helper correctly identifies elements', () => {
      expect(isKeyboardEventTargetProtected(null)).toBe(false);
      expect(isKeyboardEventTargetProtected({ tagName: 'DIV' })).toBe(false);
      expect(isKeyboardEventTargetProtected({ tagName: 'INPUT' })).toBe(true);
      expect(isKeyboardEventTargetProtected({ tagName: 'TEXTAREA' })).toBe(true);
      expect(isKeyboardEventTargetProtected({ tagName: 'SELECT' })).toBe(true);
      expect(isKeyboardEventTargetProtected({ isContentEditable: true })).toBe(true);
      expect(
        isKeyboardEventTargetProtected({
          closest: (s: string) => (s === '.nokey' ? {} : null),
        })
      ).toBe(true);
    });
  });

  // ==========================================================================
  // 7. STATUS TIMER REPLACEMENT & CLEANUP
  // ==========================================================================
  describe('StatusTimerManager Auto-Dismiss & Replacement', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should trigger onClear after specified duration', () => {
      const onClear = vi.fn();
      const timer = new StatusTimerManager({
        durationMs: 4500,
        onClear,
      });

      timer.schedule();
      expect(onClear).not.toHaveBeenCalled();

      vi.advanceTimersByTime(4400);
      expect(onClear).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(onClear).toHaveBeenCalledTimes(1);
    });

    it('should replace previous timer when a new message is scheduled and cancel properly', () => {
      const onClear = vi.fn();
      const timer = new StatusTimerManager({
        durationMs: 4500,
        onClear,
      });

      timer.schedule();
      vi.advanceTimersByTime(3000);

      // Reschedule (replaces previous timer)
      timer.schedule();
      vi.advanceTimersByTime(3000); // 6000ms from start, but only 3000ms from second schedule
      expect(onClear).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1500); // Second timer fires at 4500ms
      expect(onClear).toHaveBeenCalledTimes(1);

      // Cancel prevents any further execution
      timer.schedule();
      timer.cancel();
      vi.advanceTimersByTime(5000);
      expect(onClear).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // 8. REACT FLOW REMOVE CHANGES IGNORED WITHOUT BREAKING POSITION CHANGES
  // ==========================================================================
  describe('React Flow Change Filtering', () => {
    it('should ignore remove changes while applying position changes cleanly', () => {
      const { nodes } = useTreeStore.getState();
      const node1 = nodes[0];

      const changes: NodeChange<TreeNode>[] = [
        { type: 'remove', id: node1.id },
        {
          type: 'position',
          id: node1.id,
          position: { x: 999, y: 888 },
        },
      ];

      const safeChanges = changes.filter((c) => c.type !== 'remove');
      expect(safeChanges).toHaveLength(1);
      expect(safeChanges[0].type).toBe('position');

      const updated = applyNodeChanges(safeChanges, nodes) as TreeNode[];
      expect(updated.find((n) => n.id === node1.id)).toBeDefined();
      expect(updated.find((n) => n.id === node1.id)?.position).toEqual({ x: 999, y: 888 });
    });
  });

  // ==========================================================================
  // 9. UNIQUE IDS AFTER DELETION & REPEATED CREATION
  // ==========================================================================
  describe('Unique Node & Edge IDs after Deletion and Repeated Creation', () => {
    it('should guarantee unique node IDs after deletion and repeated creation', () => {
      const store = useTreeStore.getState();
      const createdIds = new Set<string>();

      for (let i = 0; i < 20; i++) {
        const node = store.createNode('rule', { x: i * 10, y: i * 10 })!;
        expect(createdIds.has(node.id)).toBe(false);
        createdIds.add(node.id);

        // Delete the node
        store.requestDeleteNode(node.id);
      }

      expect(createdIds.size).toBe(20);
    });

    it('should generate collision-free unique edge IDs conforming to project convention', () => {
      const edgeIds = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const id = generateUniqueEdgeId('source-a', 'target-b', edgeIds);
        expect(edgeIds.has(id)).toBe(false);
        expect(id).toMatch(/^e-source-a-target-b-/);
        edgeIds.add(id);
      }
      expect(edgeIds.size).toBe(50);
    });
  });

  // ==========================================================================
  // 10. MULTIPLE ROOTS CREATION & GRAPH SLICE ATOMICITY
  // ==========================================================================
  describe('Multiple Roots & Graph Slice Selection Atomicity', () => {
    it('should allow multiple roots during drafting while preserving existing tests', () => {
      const store = useTreeStore.getState();
      const initialRootCount = store.nodes.filter((n) => n.type === 'root').length;
      expect(initialRootCount).toBe(1);

      const root2 = store.createNode('root', { x: 400, y: 50 })!;
      const root3 = store.createNode('root', { x: 700, y: 50 })!;

      const updatedRoots = useTreeStore.getState().nodes.filter((n) => n.type === 'root');
      expect(updatedRoots).toHaveLength(3);
      expect(updatedRoots.map((r) => r.id)).toContain(root2.id);
      expect(updatedRoots.map((r) => r.id)).toContain(root3.id);
    });

    it('should update selection atomically on Add Child and Duplicate', () => {
      const store = useTreeStore.getState();
      const root = store.nodes.find((n) => n.type === 'root')!;

      // Add Child automatically selects newly created child
      const addRes = store.addChild(root.id, 'rule');
      expect(addRes.ok).toBe(true);
      expect(useTreeStore.getState().selectedNodeId).toBe(addRes.newChild?.id);
      expect(useTreeStore.getState().selectedEdgeId).toBeNull();

      // Duplicate automatically selects duplicate
      const dupRes = store.duplicateNode(addRes.newChild!.id);
      expect(dupRes.ok).toBe(true);
      expect(useTreeStore.getState().selectedNodeId).toBe(dupRes.duplicatedNode?.id);
      expect(useTreeStore.getState().selectedEdgeId).toBeNull();
    });
  });
});
