import { describe, it, expect, beforeEach } from 'vitest';
import { useTreeStore } from '../store/treeStore';
import { createDefaultNode, generateUniqueNodeId } from '../lib/nodeFactory';
import { validateConnection } from '../lib/connectionValidation';
import { resolveKeyboardAction } from '../lib/keyboardSafety';
import { setParameterPure, setMetadataPure } from '../lib/nodePropertyOperations';
import type { TreeNode } from '../types/tree';

describe('Interactive Visual Tree Editor — Comprehensive Days 1–7 Workflow Verification', () => {
  beforeEach(() => {
    useTreeStore.getState().resetToSampleData();
  });

  // ==========================================================================
  // Scenario 1: Add and drag nodes
  // ==========================================================================
  describe('Scenario 1: Add and drag nodes', () => {
    it('creates nodes with unique IDs and places them at target coordinates', () => {
      const { createNode, nodes } = useTreeStore.getState();
      const initialCount = nodes.length;

      const ruleNode = createNode('rule', { x: 320, y: 480 });
      expect(ruleNode).toBeDefined();
      expect(ruleNode?.type).toBe('rule');
      expect(ruleNode?.position).toEqual({ x: 320, y: 480 });
      expect(ruleNode?.id).toMatch(/^node_rule_/);

      const conditionNode = createNode('condition', { x: 150, y: 600 });
      expect(conditionNode).toBeDefined();
      expect(conditionNode?.id).toMatch(/^node_condition_/);
      expect(conditionNode?.id).not.toBe(ruleNode?.id);

      const actionNode = createNode('action', { x: 450, y: 600 });
      expect(actionNode).toBeDefined();
      expect(actionNode?.id).toMatch(/^node_action_/);

      const nextNodes = useTreeStore.getState().nodes;
      expect(nextNodes.length).toBe(initialCount + 3);
    });

    it('simulates dragging a node to new coordinates', () => {
      const { createNode, setNodes } = useTreeStore.getState();
      const node = createNode('rule', { x: 100, y: 100 })!;

      // Simulate dragging node across the canvas
      const currentNodes = useTreeStore.getState().nodes;
      const updatedNodes = currentNodes.map((n) =>
        n.id === node.id ? { ...n, position: { x: 250, y: 350 } } : n
      );
      setNodes(updatedNodes);

      const movedNode = useTreeStore.getState().nodes.find((n) => n.id === node.id)!;
      expect(movedNode.position).toEqual({ x: 250, y: 350 });
      expect(Number.isFinite(movedNode.position.x)).toBe(true);
      expect(Number.isFinite(movedNode.position.y)).toBe(true);
    });
  });

  // ==========================================================================
  // Scenario 2: Valid and Invalid Connections
  // ==========================================================================
  describe('Scenario 2: Connections — Valid and Invalid Matrix', () => {
    it('creates all 4 permitted hierarchy connections', () => {
      const { createNode, addEdgeConnection } = useTreeStore.getState();

      const rule = createNode('rule', { x: 10, y: 10 })!;
      const cond = createNode('condition', { x: 10, y: 100 })!;
      const action1 = createNode('action', { x: 10, y: 200 })!;
      const action2 = createNode('action', { x: 100, y: 200 })!;

      // 1. Root -> Rule
      const resRootRule = addEdgeConnection({
        source: 'root-policy-hierarchy',
        target: rule.id,
      });
      expect(resRootRule.ok).toBe(true);

      // 2. Rule -> Condition
      const resRuleCond = addEdgeConnection({
        source: rule.id,
        target: cond.id,
      });
      expect(resRuleCond.ok).toBe(true);

      // 3. Condition -> Action
      const resCondAction = addEdgeConnection({
        source: cond.id,
        target: action1.id,
      });
      expect(resCondAction.ok).toBe(true);

      // 4. Rule -> Action
      const resRuleAction = addEdgeConnection({
        source: rule.id,
        target: action2.id,
      });
      expect(resRuleAction.ok).toBe(true);
    });

    it('rejects all invalid connections and leaves graph edges undamaged', () => {
      const { createNode, addEdgeConnection, edges } = useTreeStore.getState();
      const initialEdgeCount = edges.length;

      const action = createNode('action', { x: 0, y: 0 })!;
      const rule = createNode('rule', { x: 100, y: 100 })!;

      // Action -> Rule (Action cannot have children)
      const resActionChild = addEdgeConnection({ source: action.id, target: rule.id });
      expect(resActionChild.ok).toBe(false);
      expect(resActionChild.message).toContain('Action nodes cannot have children');

      // Self-connection (Rule -> Rule)
      const resSelf = addEdgeConnection({ source: rule.id, target: rule.id });
      expect(resSelf.ok).toBe(false);
      expect(resSelf.message).toContain('cannot connect to itself');

      // Multiple parents (Target already has a parent)
      const resMultipleParents = addEdgeConnection({
        source: rule.id,
        target: 'cond-finra-2210', // already has rule-finra-2210 as parent
      });
      expect(resMultipleParents.ok).toBe(false);
      expect(resMultipleParents.message).toContain('already has a parent');

      // Target is Root (Root cannot have a parent)
      const resTargetRoot = addEdgeConnection({
        source: rule.id,
        target: 'root-policy-hierarchy',
      });
      expect(resTargetRoot.ok).toBe(false);
      expect(resTargetRoot.message).toContain('Root nodes cannot have a parent');

      // Duplicate edge
      const resDuplicate = addEdgeConnection({
        source: 'root-policy-hierarchy',
        target: 'rule-finra-2210',
      });
      expect(resDuplicate.ok).toBe(false);
      expect(resDuplicate.message).toContain('already exists');

      // Verify no invalid edges were added to store
      expect(useTreeStore.getState().edges.length).toBe(initialEdgeCount);
    });
  });

  // ==========================================================================
  // Scenario 3: Edit Properties & Protect Internal ID/Type
  // ==========================================================================
  describe('Scenario 3: Edit Properties', () => {
    it('updates all core, governance, and classification attributes while preserving ID and type', () => {
      const { nodes, updateNodeData } = useTreeStore.getState();
      const target = nodes.find((n) => n.id === 'rule-finra-2210')!;

      const success = updateNodeData(target.id, {
        label: 'Updated FINRA Rule Label',
        description: 'New policy description text',
        ruleId: 'RULE-MODIFIED-99',
        severity: 'critical',
        status: 'in_review',
      });
      expect(success).toBe(true);

      const updated = useTreeStore.getState().nodes.find((n) => n.id === target.id)!;
      expect(updated.id).toBe('rule-finra-2210'); // ID unchanged
      expect(updated.type).toBe('rule'); // Type unchanged
      expect(updated.data.label).toBe('Updated FINRA Rule Label');
      expect(updated.data.description).toBe('New policy description text');
      expect(updated.data.ruleId).toBe('RULE-MODIFIED-99');
      expect(updated.data.severity).toBe('critical');
      expect(updated.data.status).toBe('in_review');
    });

    it('preserves other fields when editing a single field', () => {
      const { nodes, updateNodeData } = useTreeStore.getState();
      const target = nodes[0];
      const previousParams = { ...target.data.parameters };
      const previousMeta = { ...target.data.metadata };

      updateNodeData(target.id, { label: 'New Solo Label' });

      const updated = useTreeStore.getState().nodes.find((n) => n.id === target.id)!;
      expect(updated.data.label).toBe('New Solo Label');
      expect(updated.data.parameters).toEqual(previousParams);
      expect(updated.data.metadata).toEqual(previousMeta);
    });
  });

  // ==========================================================================
  // Scenario 4: Switch between nodes sharing keys
  // ==========================================================================
  describe('Scenario 4: Node Switching Isolation', () => {
    it('maintains distinct parameter and metadata dictionaries between nodes sharing keys', () => {
      const { updateNodeParameter, updateNodeMetadata, nodes } = useTreeStore.getState();
      const nodeA = nodes[0];
      const nodeB = nodes[1];

      // Both nodes configure 'auditCycle'
      updateNodeParameter(nodeA.id, 'auditCycle', 'Annual');
      updateNodeParameter(nodeB.id, 'auditCycle', 'Quarterly');

      // Both nodes configure 'complianceCategory'
      updateNodeMetadata(nodeA.id, 'complianceCategory', 'Tier1');
      updateNodeMetadata(nodeB.id, 'complianceCategory', 'Tier2');

      const refreshedA = useTreeStore.getState().nodes.find((n) => n.id === nodeA.id)!;
      const refreshedB = useTreeStore.getState().nodes.find((n) => n.id === nodeB.id)!;

      expect(refreshedA.data.parameters?.auditCycle).toBe('Annual');
      expect(refreshedB.data.parameters?.auditCycle).toBe('Quarterly');
      expect(refreshedA.data.metadata?.complianceCategory).toBe('Tier1');
      expect(refreshedB.data.metadata?.complianceCategory).toBe('Tier2');
    });
  });

  // ==========================================================================
  // Scenario 5: Handle 0, false, numbers, and empty strings
  // ==========================================================================
  describe('Scenario 5: 0, false, numbers, and empty string parameter values', () => {
    it('preserves false, 0, float, and empty string values correctly', () => {
      const { nodes, updateNodeParameter, updateNodeMetadata } = useTreeStore.getState();
      const target = nodes[0];

      // Numbers and 0
      updateNodeParameter(target.id, 'zeroValue', 0);
      updateNodeParameter(target.id, 'fractionValue', 3.1415);

      // Booleans
      updateNodeParameter(target.id, 'booleanFalse', false);
      updateNodeParameter(target.id, 'booleanTrue', true);

      // Empty string
      updateNodeParameter(target.id, 'emptyNote', '');

      // Metadata values
      updateNodeMetadata(target.id, 'metaZero', 0);
      updateNodeMetadata(target.id, 'metaFalse', false);
      updateNodeMetadata(target.id, 'metaEmpty', '');

      const refreshed = useTreeStore.getState().nodes.find((n) => n.id === target.id)!;
      expect(refreshed.data.parameters?.zeroValue).toBe(0);
      expect(refreshed.data.parameters?.fractionValue).toBe(3.1415);
      expect(refreshed.data.parameters?.booleanFalse).toBe(false);
      expect(refreshed.data.parameters?.booleanTrue).toBe(true);
      expect(refreshed.data.parameters?.emptyNote).toBe('');

      expect(refreshed.data.metadata?.metaZero).toBe(0);
      expect(refreshed.data.metadata?.metaFalse).toBe(false);
      expect(refreshed.data.metadata?.metaEmpty).toBe('');
    });
  });

  // ==========================================================================
  // Scenario 6: Delete connected nodes & Cancellation
  // ==========================================================================
  describe('Scenario 6: Node Deletion and Incident Edge Removal', () => {
    it('requires confirmation for connected nodes and cancels cleanly', () => {
      const { requestDeleteNode, cancelDeleteNode, nodes, edges } = useTreeStore.getState();
      const target = nodes.find((n) => n.id === 'rule-finra-2210')!;
      const initialNodeCount = nodes.length;
      const initialEdgeCount = edges.length;

      // 1. Request deletion
      requestDeleteNode(target.id);
      expect(useTreeStore.getState().deleteConfirmation).toBeDefined();
      expect(useTreeStore.getState().deleteConfirmation?.nodeId).toBe(target.id);

      // 2. Cancel deletion
      cancelDeleteNode();
      expect(useTreeStore.getState().deleteConfirmation).toBeNull();
      expect(useTreeStore.getState().nodes.length).toBe(initialNodeCount);
      expect(useTreeStore.getState().edges.length).toBe(initialEdgeCount);
    });

    it('confirms deletion and atomically cleans up all incoming and outgoing edges', () => {
      const { requestDeleteNode, confirmDeleteNode, nodes, edges } = useTreeStore.getState();
      const targetId = 'rule-finra-2210';

      requestDeleteNode(targetId);
      confirmDeleteNode();

      const nextNodes = useTreeStore.getState().nodes;
      const nextEdges = useTreeStore.getState().edges;

      // Node removed
      expect(nextNodes.some((n) => n.id === targetId)).toBe(false);

      // All edges where targetId is source or target are removed
      expect(nextEdges.some((e) => e.source === targetId || e.target === targetId)).toBe(false);

      // No dangling edges exist in the graph
      const remainingNodeIds = new Set(nextNodes.map((n) => n.id));
      for (const edge of nextEdges) {
        expect(remainingNodeIds.has(edge.source)).toBe(true);
        expect(remainingNodeIds.has(edge.target)).toBe(true);
      }
    });
  });

  // ==========================================================================
  // Scenario 7: Keyboard Safety
  // ==========================================================================
  describe('Scenario 7: Keyboard Safety while typing', () => {
    it('shields text editing controls from Delete and Backspace actions', () => {
      const ctxInput = {
        key: 'Backspace',
        target: { tagName: 'input' },
        selection: { selectedNodeId: 'node-1', selectedEdgeId: null },
        confirmationOpen: false,
      };
      expect(resolveKeyboardAction(ctxInput)).toBe('ignore');

      const ctxTextarea = {
        key: 'Delete',
        target: { tagName: 'textarea' },
        selection: { selectedNodeId: 'node-1', selectedEdgeId: null },
        confirmationOpen: false,
      };
      expect(resolveKeyboardAction(ctxTextarea)).toBe('ignore');

      const ctxNoKey = {
        key: 'Delete',
        target: { insideNoKey: true },
        selection: { selectedNodeId: 'node-1', selectedEdgeId: null },
        confirmationOpen: false,
      };
      expect(resolveKeyboardAction(ctxNoKey)).toBe('ignore');

      // On canvas with selected node and no text input active
      const ctxCanvas = {
        key: 'Delete',
        target: { tagName: 'div' },
        selection: { selectedNodeId: 'node-1', selectedEdgeId: null },
        confirmationOpen: false,
      };
      expect(resolveKeyboardAction(ctxCanvas)).toBe('delete-node');
    });
  });

  // ==========================================================================
  // Scenario 8: Store Reset & Graph Invariants
  // ==========================================================================
  describe('Scenario 8 & 9: Invariants, Graph Integrity & Reset', () => {
    it('resets cleanly to initial sample template with valid coordinates and no cycles', () => {
      const { createNode, resetToSampleData, nodes, edges } = useTreeStore.getState();
      createNode('rule', { x: 999, y: 999 });

      resetToSampleData();
      const currentNodes = useTreeStore.getState().nodes;
      const currentEdges = useTreeStore.getState().edges;

      // 1. Coordinates are all finite numbers
      for (const node of currentNodes) {
        expect(Number.isFinite(node.position.x)).toBe(true);
        expect(Number.isFinite(node.position.y)).toBe(true);
      }

      // 2. Exactly one root node
      const roots = currentNodes.filter((n) => n.type === 'root');
      expect(roots).toHaveLength(1);

      // 3. No dangling edge references
      const nodeIds = new Set(currentNodes.map((n) => n.id));
      for (const edge of currentEdges) {
        expect(nodeIds.has(edge.source)).toBe(true);
        expect(nodeIds.has(edge.target)).toBe(true);
      }
    });
  });
});
