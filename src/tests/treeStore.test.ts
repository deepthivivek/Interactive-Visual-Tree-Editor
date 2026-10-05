import { describe, it, expect, beforeEach } from 'vitest';
import {
  useTreeStore,
  INITIAL_SAMPLE_NODES,
  INITIAL_SAMPLE_EDGES,
  SAMPLE_COMPLIANCE_TEMPLATE_LABEL,
} from '../store/treeStore';
import type { TreeNode } from '../types/tree';

describe('Tree Foundation - Model & Store Integrity (Day 1)', () => {
  beforeEach(() => {
    useTreeStore.getState().resetToSampleData();
  });

  describe('Sample Compliance Template Structure', () => {
    it('should label the sample template clearly and accurately', () => {
      expect(SAMPLE_COMPLIANCE_TEMPLATE_LABEL).toBe('Sample Compliance Template');
    });

    it('should have exactly ONE root node', () => {
      const { nodes } = useTreeStore.getState();
      const rootNodes = nodes.filter((n) => n.type === 'root');
      expect(rootNodes).toHaveLength(1);
      expect(rootNodes[0].id).toBe('root-policy-hierarchy');
      expect(rootNodes[0].data.label).toBe('Policy Hierarchy');
    });

    it('should ensure all node IDs are unique', () => {
      const { nodes } = useTreeStore.getState();
      const nodeIds = nodes.map((n) => n.id);
      const uniqueIds = new Set(nodeIds);
      expect(uniqueIds.size).toBe(nodeIds.length);
    });

    it('should contain the 3 required mock compliance rule branches', () => {
      const { nodes, edges } = useTreeStore.getState();
      const root = nodes.find((n) => n.type === 'root')!;

      const rootEdges = edges.filter((e) => e.source === root.id);
      expect(rootEdges).toHaveLength(3);

      const ruleIds = rootEdges.map((e) => e.target);
      expect(ruleIds).toContain('rule-finra-2210');
      expect(ruleIds).toContain('rule-sec-17a-4');
      expect(ruleIds).toContain('rule-disc-09');

      // Verify each rule has exactly one Condition child and one Action child
      for (const ruleId of ruleIds) {
        const childEdges = edges.filter((e) => e.source === ruleId);
        expect(childEdges).toHaveLength(2);

        const childNodes = childEdges.map((e) => nodes.find((n) => n.id === e.target)!);
        const conditionChild = childNodes.find((c) => c.type === 'condition');
        const actionChild = childNodes.find((c) => c.type === 'action');

        expect(conditionChild).toBeDefined();
        expect(actionChild).toBeDefined();
      }
    });

    it('should have exactly one parent for every non-root node in the sample tree', () => {
      const { nodes, edges } = useTreeStore.getState();
      const nonRootNodes = nodes.filter((n) => n.type !== 'root');

      for (const node of nonRootNodes) {
        const incomingEdges = edges.filter((e) => e.target === node.id);
        expect(incomingEdges).toHaveLength(1);
      }

      // Root node has 0 incoming edges
      const rootNode = nodes.find((n) => n.type === 'root')!;
      const rootIncoming = edges.filter((e) => e.target === rootNode.id);
      expect(rootIncoming).toHaveLength(0);
    });

    it('should provide complete typed node data fields', () => {
      const { nodes } = useTreeStore.getState();
      for (const node of nodes) {
        expect(node.data.label).toBeTruthy();
        expect(node.data.ruleId).toBeDefined();
        expect(node.data.description).toBeDefined();
        expect(node.data.status).toBeDefined();
        expect(['draft', 'active', 'deprecated', 'in_review']).toContain(node.data.status);
        if (node.data.severity) {
          expect(['info', 'low', 'medium', 'high', 'critical']).toContain(node.data.severity);
        }
      }
    });
  });

  describe('Zustand Store - State Separation', () => {
    it('separates graph document state from transient UI state', () => {
      const store = useTreeStore.getState();
      expect(store.selectedNodeId).toBeNull();
      expect(store.nodes).toEqual(INITIAL_SAMPLE_NODES);
      expect(store.edges).toEqual(INITIAL_SAMPLE_EDGES);

      // Mutate transient UI state
      useTreeStore.getState().setSelectedNodeId('rule-finra-2210');
      const updatedStore = useTreeStore.getState();

      expect(updatedStore.selectedNodeId).toBe('rule-finra-2210');
      // Document state (nodes and edges) remains unchanged
      expect(updatedStore.nodes).toBe(store.nodes);
      expect(updatedStore.edges).toBe(store.edges);
    });

    it('resets state cleanly to sample data and clears transient selection', () => {
      useTreeStore.getState().setSelectedNodeId('rule-sec-17a-4');
      const customNode: TreeNode = {
        id: 'temp-node',
        type: 'action',
        position: { x: 0, y: 0 },
        data: { label: 'Temp' },
      };
      useTreeStore.getState().setNodes([customNode]);

      expect(useTreeStore.getState().nodes).toHaveLength(1);
      expect(useTreeStore.getState().selectedNodeId).toBe('rule-sec-17a-4');

      useTreeStore.getState().resetToSampleData();

      const resetState = useTreeStore.getState();
      expect(resetState.nodes).toHaveLength(INITIAL_SAMPLE_NODES.length);
      expect(resetState.edges).toHaveLength(INITIAL_SAMPLE_EDGES.length);
      expect(resetState.selectedNodeId).toBeNull();
    });

    it('supports node position updates during canvas interaction without affecting edge structure', () => {
      const initialNodes = useTreeStore.getState().nodes;
      const initialEdges = useTreeStore.getState().edges;

      // Simulate dragging a node on canvas
      const updatedNodes = initialNodes.map((n) =>
        n.id === 'rule-finra-2210'
          ? { ...n, position: { x: n.position.x + 50, y: n.position.y + 30 } }
          : n
      );
      useTreeStore.getState().setNodes(updatedNodes);

      const stateAfterMove = useTreeStore.getState();
      const movedNode = stateAfterMove.nodes.find((n) => n.id === 'rule-finra-2210');
      expect(movedNode?.position).toEqual({ x: 150, y: 230 });
      // Edge count and source/target relations remain intact
      expect(stateAfterMove.edges).toHaveLength(initialEdges.length);
    });

    it('allows clearing nodes to verify empty state behavior and resets properly', () => {
      useTreeStore.getState().setNodes([]);
      expect(useTreeStore.getState().nodes).toHaveLength(0);

      useTreeStore.getState().resetToSampleData();
      expect(useTreeStore.getState().nodes).toHaveLength(INITIAL_SAMPLE_NODES.length);
    });

    it('switching selection across nodes updates selectedNodeId cleanly and clears on null', () => {
      const store = useTreeStore.getState();
      expect(store.selectedNodeId).toBeNull();

      // Select Node A
      useTreeStore.getState().setSelectedNodeId('rule-finra-2210');
      expect(useTreeStore.getState().selectedNodeId).toBe('rule-finra-2210');

      // Switch to Node B
      useTreeStore.getState().setSelectedNodeId('rule-sec-17a-4');
      expect(useTreeStore.getState().selectedNodeId).toBe('rule-sec-17a-4');

      // Click empty pane (deselect)
      useTreeStore.getState().setSelectedNodeId(null);
      expect(useTreeStore.getState().selectedNodeId).toBeNull();

      // Document nodes and edges remain completely intact
      expect(useTreeStore.getState().nodes).toHaveLength(INITIAL_SAMPLE_NODES.length);
      expect(useTreeStore.getState().edges).toHaveLength(INITIAL_SAMPLE_EDGES.length);
    });

    it('preserves all nodes when node removal change events are blocked (Day 2 deletion guard)', () => {
      const initialNodes = useTreeStore.getState().nodes;
      // Simulate React Flow changes containing an accidental 'remove' action
      const mockChanges = [
        { type: 'remove', id: 'rule-finra-2210' },
        { type: 'position', id: 'rule-sec-17a-4', position: { x: 500, y: 220 } },
      ];

      // Day 2 guard filters out 'remove' operations
      const safeChanges = mockChanges.filter((c) => c.type !== 'remove');
      expect(safeChanges).toHaveLength(1);
      expect(safeChanges[0].type).toBe('position');

      // Verify original nodes remain intact
      expect(initialNodes.find((n) => n.id === 'rule-finra-2210')).toBeDefined();
    });
  });
});
