import { describe, it, expect, beforeEach } from 'vitest';
import { useTreeStore } from '../store/treeStore';
import {
  updateNodeDataPure,
  setParameterPure,
  deleteParameterPure,
  setMetadataPure,
  deleteMetadataPure,
  addTagPure,
  removeTagPure,
  VALID_SEVERITIES,
  VALID_STATUSES,
} from '../lib/nodePropertyOperations';
import type { TreeNode } from '../types/tree';

describe('Day 7 - Properties Inspector & Pure Property Operations', () => {
  beforeEach(() => {
    useTreeStore.getState().resetToSampleData();
  });

  // ==========================================================================
  // 1. PURE PROPERTY OPERATIONS
  // ==========================================================================
  describe('Pure Node Property Operations', () => {
    it('updateNodeDataPure immutably updates node data fields', () => {
      const node: TreeNode = {
        id: 'node-test-1',
        type: 'rule',
        position: { x: 0, y: 0 },
        data: {
          label: 'Original Rule',
          ruleId: 'RULE-01',
          description: 'Original description',
          severity: 'medium',
          status: 'draft',
        },
      };

      const updated = updateNodeDataPure(node, {
        label: 'Updated Rule Title',
        description: 'New detailed description',
        severity: 'critical',
        status: 'active',
      });

      // Does not mutate input
      expect(node.data.label).toBe('Original Rule');
      expect(node.data.severity).toBe('medium');

      // Returns fresh node with merged updates
      expect(updated.id).toBe('node-test-1');
      expect(updated.data.label).toBe('Updated Rule Title');
      expect(updated.data.description).toBe('New detailed description');
      expect(updated.data.severity).toBe('critical');
      expect(updated.data.status).toBe('active');
      expect(updated.data.ruleId).toBe('RULE-01'); // preserved
    });

    it('setParameterPure adds, updates, and renames parameters cleanly', () => {
      const initial = { timeout: 30, retries: 3 };

      // Add new parameter
      const added = setParameterPure(initial, 'enabled', true);
      expect(added).toEqual({ timeout: 30, retries: 3, enabled: true });
      expect(initial).toEqual({ timeout: 30, retries: 3 }); // immutable

      // Update existing parameter
      const updated = setParameterPure(added, 'timeout', 60);
      expect(updated.timeout).toBe(60);

      // Rename parameter (oldKey -> new key)
      const renamed = setParameterPure(updated, 'maxRetries', 5, 'retries');
      expect(renamed).toEqual({ timeout: 60, maxRetries: 5, enabled: true });
      expect(renamed.retries).toBeUndefined();

      // Ignores empty trimmed key
      const noop = setParameterPure(renamed, '   ', 'value');
      expect(noop).toEqual(renamed);
    });

    it('deleteParameterPure removes parameters immutably', () => {
      const params = { foo: 'bar', baz: 123 };
      const after = deleteParameterPure(params, 'foo');
      expect(after).toEqual({ baz: 123 });
      expect(params).toEqual({ foo: 'bar', baz: 123 });
    });

    it('setMetadataPure and deleteMetadataPure manage audit metadata tags', () => {
      const initialMeta = { auditId: 'AUDIT-99' };

      const withCategory = setMetadataPure(initialMeta, 'category', 'Finance');
      expect(withCategory).toEqual({ auditId: 'AUDIT-99', category: 'Finance' });

      // Rename metadata key
      const renamed = setMetadataPure(withCategory, 'auditRef', 'AUDIT-99', 'auditId');
      expect(renamed).toEqual({ auditRef: 'AUDIT-99', category: 'Finance' });
      expect(renamed.auditId).toBeUndefined();

      const deleted = deleteMetadataPure(renamed, 'category');
      expect(deleted).toEqual({ auditRef: 'AUDIT-99' });
    });

    it('addTagPure and removeTagPure manage string tags without duplicates', () => {
      const initialTags = ['compliance', 'pci-dss'];

      const added = addTagPure(initialTags, 'sox');
      expect(added).toEqual(['compliance', 'pci-dss', 'sox']);

      // Prevents duplicates
      const dupe = addTagPure(added, 'compliance');
      expect(dupe).toEqual(['compliance', 'pci-dss', 'sox']);

      // Trims whitespace
      const trimmed = addTagPure(added, '  hipaa  ');
      expect(trimmed).toEqual(['compliance', 'pci-dss', 'sox', 'hipaa']);

      // Ignores empty strings
      const empty = addTagPure(trimmed, '   ');
      expect(empty).toEqual(['compliance', 'pci-dss', 'sox', 'hipaa']);

      // Remove tag
      const removed = removeTagPure(trimmed, 'pci-dss');
      expect(removed).toEqual(['compliance', 'sox', 'hipaa']);
    });

    it('exports complete valid severity and status sets', () => {
      expect(VALID_SEVERITIES).toEqual(['info', 'low', 'medium', 'high', 'critical']);
      expect(VALID_STATUSES).toEqual(['active', 'draft', 'in_review', 'deprecated', 'archived']);
    });
  });

  // ==========================================================================
  // 2. ZUSTAND STORE SYNCHRONIZATION
  // ==========================================================================
  describe('Zustand Tree Store Day 7 Action Synchronization', () => {
    it('updateNodeData updates node fields in the store in real time', () => {
      const { nodes, updateNodeData } = useTreeStore.getState();
      const target = nodes[0];

      const success = updateNodeData(target.id, {
        label: 'Renamed Policy Hierarchy',
        ruleId: 'ROOT-UPDATED-001',
        description: 'Updated top-level root policy description.',
        severity: 'critical',
        status: 'in_review',
      });

      expect(success).toBe(true);

      const updatedNode = useTreeStore.getState().nodes.find((n) => n.id === target.id)!;
      expect(updatedNode.data.label).toBe('Renamed Policy Hierarchy');
      expect(updatedNode.data.ruleId).toBe('ROOT-UPDATED-001');
      expect(updatedNode.data.description).toBe('Updated top-level root policy description.');
      expect(updatedNode.data.severity).toBe('critical');
      expect(updatedNode.data.status).toBe('in_review');
    });

    it('updateNodeData returns false and does not mutate graph when node does not exist', () => {
      const { updateNodeData } = useTreeStore.getState();
      const success = updateNodeData('non-existent-id', { label: 'Should Fail' });
      expect(success).toBe(false);
    });

    it('updateNodeParameter and deleteNodeParameter synchronize store parameters', () => {
      const { nodes, updateNodeParameter, deleteNodeParameter } = useTreeStore.getState();
      const target = nodes.find((n) => n.id === 'rule-finra-2210')!;

      // Add a parameter
      updateNodeParameter(target.id, 'maxAudience', 500);
      let updatedNode = useTreeStore.getState().nodes.find((n) => n.id === target.id)!;
      expect(updatedNode.data.parameters?.maxAudience).toBe(500);

      // Update existing parameter
      updateNodeParameter(target.id, 'maxAudience', 1000);
      updatedNode = useTreeStore.getState().nodes.find((n) => n.id === target.id)!;
      expect(updatedNode.data.parameters?.maxAudience).toBe(1000);

      // Rename parameter
      updateNodeParameter(target.id, 'audienceCap', 1000, 'maxAudience');
      updatedNode = useTreeStore.getState().nodes.find((n) => n.id === target.id)!;
      expect(updatedNode.data.parameters?.audienceCap).toBe(1000);
      expect(updatedNode.data.parameters?.maxAudience).toBeUndefined();

      // Delete parameter
      deleteNodeParameter(target.id, 'audienceCap');
      updatedNode = useTreeStore.getState().nodes.find((n) => n.id === target.id)!;
      expect(updatedNode.data.parameters?.audienceCap).toBeUndefined();
    });

    it('addNodeTag and removeNodeTag synchronize tags in the store', () => {
      const { nodes, addNodeTag, removeNodeTag } = useTreeStore.getState();
      const target = nodes[0];

      addNodeTag(target.id, 'finance-v2');
      let updatedNode = useTreeStore.getState().nodes.find((n) => n.id === target.id)!;
      expect(updatedNode.data.tags).toContain('finance-v2');

      addNodeTag(target.id, 'sec-filing');
      updatedNode = useTreeStore.getState().nodes.find((n) => n.id === target.id)!;
      expect(updatedNode.data.tags).toEqual(['finance-v2', 'sec-filing']);

      removeNodeTag(target.id, 'finance-v2');
      updatedNode = useTreeStore.getState().nodes.find((n) => n.id === target.id)!;
      expect(updatedNode.data.tags).toEqual(['sec-filing']);
    });

    it('updateNodeMetadata and deleteNodeMetadata synchronize metadata in the store', () => {
      const { nodes, updateNodeMetadata, deleteNodeMetadata } = useTreeStore.getState();
      const target = nodes[0];

      updateNodeMetadata(target.id, 'reviewerGroup', 'Tier-1-Supervisors');
      let updatedNode = useTreeStore.getState().nodes.find((n) => n.id === target.id)!;
      expect(updatedNode.data.metadata?.reviewerGroup).toBe('Tier-1-Supervisors');

      deleteNodeMetadata(target.id, 'reviewerGroup');
      updatedNode = useTreeStore.getState().nodes.find((n) => n.id === target.id)!;
      expect(updatedNode.data.metadata?.reviewerGroup).toBeUndefined();
    });

    it('supports archived status seamlessly in store', () => {
      const { nodes, updateNodeData } = useTreeStore.getState();
      const target = nodes[1];

      updateNodeData(target.id, { status: 'archived' });
      const updatedNode = useTreeStore.getState().nodes.find((n) => n.id === target.id)!;
      expect(updatedNode.data.status).toBe('archived');
    });

    it('correctly handles 0, false, and empty string parameter values without data loss', () => {
      const { nodes, updateNodeParameter } = useTreeStore.getState();
      const target = nodes[0];

      // Test 0
      updateNodeParameter(target.id, 'threshold', 0);
      let updatedNode = useTreeStore.getState().nodes.find((n) => n.id === target.id)!;
      expect(updatedNode.data.parameters?.threshold).toBe(0);

      // Test false
      updateNodeParameter(target.id, 'enabled', false);
      updatedNode = useTreeStore.getState().nodes.find((n) => n.id === target.id)!;
      expect(updatedNode.data.parameters?.enabled).toBe(false);

      // Test empty string
      updateNodeParameter(target.id, 'notes', '');
      updatedNode = useTreeStore.getState().nodes.find((n) => n.id === target.id)!;
      expect(updatedNode.data.parameters?.notes).toBe('');
    });

    it('editing one field preserves all other unrelated properties and protects internal id/type', () => {
      const { nodes, updateNodeData } = useTreeStore.getState();
      const original = nodes[0];
      const originalId = original.id;
      const originalType = original.type;
      const originalParams = { ...original.data.parameters };

      // Update only label
      updateNodeData(original.id, { label: 'Completely New Label' });

      const updated = useTreeStore.getState().nodes.find((n) => n.id === originalId)!;
      expect(updated.id).toBe(originalId);
      expect(updated.type).toBe(originalType);
      expect(updated.data.label).toBe('Completely New Label');
      expect(updated.data.ruleId).toBe(original.data.ruleId);
      expect(updated.data.description).toBe(original.data.description);
      expect(updated.data.severity).toBe(original.data.severity);
      expect(updated.data.status).toBe(original.data.status);
      expect(updated.data.parameters).toEqual(originalParams);
    });
  });
});
