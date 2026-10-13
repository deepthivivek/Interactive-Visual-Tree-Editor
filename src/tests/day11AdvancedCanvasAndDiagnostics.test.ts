import { describe, it, expect } from 'vitest';
import { runGraphDiagnostics } from '../lib/graphDiagnostics';
import {
  resolveCanvasKeyboardAction,
  computeNudgedPosition,
  getNextSelectedNodeId,
} from '../lib/keyboardSafety';
import type { TreeNode, TreeEdge } from '../types/tree';
import { useTreeStore } from '../store/treeStore';

describe('Day 11: Pure Graph Diagnostics Engine (`src/lib/graphDiagnostics.ts`)', () => {
  it('identifies an empty graph and returns info status', () => {
    const result = runGraphDiagnostics([], []);
    expect(result.status).toBe('healthy');
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
    expect(result.infoCount).toBe(1);
    expect(result.issues[0].id).toBe('empty-graph');
    expect(result.metrics.nodeCount).toBe(0);
    expect(result.metrics.edgeCount).toBe(0);
  });

  it('verifies canonical sample compliance tree has valid hierarchy and zero errors', () => {
    useTreeStore.getState().loadSampleTree();
    const { nodes, edges } = useTreeStore.getState();

    const result = runGraphDiagnostics(nodes, edges);
    expect(result.errorCount).toBe(0);
    expect(result.status).not.toBe('error');
    expect(result.metrics.rootCount).toBe(1);
    expect(result.metrics.maxDepth).toBeGreaterThanOrEqual(3);
    expect(result.metrics.leafCount).toBeGreaterThan(0);
    expect(result.metrics.orphanedCount).toBe(0);
  });

  it('detects missing root error when graph has non-root nodes but no Root', () => {
    const nodes: TreeNode[] = [
      {
        id: 'rule-1',
        type: 'rule',
        position: { x: 0, y: 0 },
        data: { label: 'Audit Rule', ruleId: 'RULE-1' },
      },
    ];
    const result = runGraphDiagnostics(nodes, []);
    expect(result.status).toBe('error');
    expect(result.errorCount).toBeGreaterThanOrEqual(1);
    const missingRootIssue = result.issues.find((i) => i.id === 'missing-root');
    expect(missingRootIssue).toBeDefined();
    expect(missingRootIssue?.severity).toBe('error');
  });

  it('flags multiple roots as warning for single-hierarchy compliance trees', () => {
    const nodes: TreeNode[] = [
      {
        id: 'root-1',
        type: 'root',
        position: { x: 0, y: 0 },
        data: { label: 'Policy Root 1' },
      },
      {
        id: 'root-2',
        type: 'root',
        position: { x: 200, y: 0 },
        data: { label: 'Policy Root 2' },
      },
    ];
    const result = runGraphDiagnostics(nodes, []);
    expect(result.status).toBe('warning');
    const multiRootIssue = result.issues.find((i) => i.id === 'multiple-roots');
    expect(multiRootIssue).toBeDefined();
    expect(multiRootIssue?.severity).toBe('warning');
  });

  it('detects orphaned nodes when non-root nodes are disconnected', () => {
    const nodes: TreeNode[] = [
      {
        id: 'root-1',
        type: 'root',
        position: { x: 0, y: 0 },
        data: { label: 'Root' },
      },
      {
        id: 'action-orphan',
        type: 'action',
        position: { x: 100, y: 200 },
        data: { label: 'Orphan Action' },
      },
    ];
    const result = runGraphDiagnostics(nodes, []);
    expect(result.status).toBe('warning');
    const orphanIssue = result.issues.find((i) => i.id === 'orphan-action-orphan');
    expect(orphanIssue).toBeDefined();
    expect(orphanIssue?.severity).toBe('warning');
    expect(result.metrics.orphanedCount).toBe(1);
  });

  it('flags invalid parent-child relationship connections according to policy grammar', () => {
    const nodes: TreeNode[] = [
      {
        id: 'root-1',
        type: 'root',
        position: { x: 0, y: 0 },
        data: { label: 'Root' },
      },
      {
        id: 'action-1',
        type: 'action',
        position: { x: 0, y: 150 },
        data: { label: 'Direct Action' },
      },
    ];
    // Invalid: Root cannot connect directly to Action (only Root -> Rule)
    const edges: TreeEdge[] = [
      {
        id: 'edge-invalid',
        source: 'root-1',
        target: 'action-1',
      },
    ];
    const result = runGraphDiagnostics(nodes, edges);
    expect(result.status).toBe('error');
    const relIssue = result.issues.find((i) => i.id === 'invalid-relationship-edge-invalid');
    expect(relIssue).toBeDefined();
    expect(relIssue?.severity).toBe('error');
    expect(relIssue?.description).toContain('Root');
  });

  it('flags multiple incoming parents as single-parent hierarchy violation', () => {
    const nodes: TreeNode[] = [
      {
        id: 'root-1',
        type: 'root',
        position: { x: 0, y: 0 },
        data: { label: 'Root' },
      },
      {
        id: 'rule-1',
        type: 'rule',
        position: { x: -100, y: 100 },
        data: { label: 'Rule 1', ruleId: 'R-1' },
      },
      {
        id: 'rule-2',
        type: 'rule',
        position: { x: 100, y: 100 },
        data: { label: 'Rule 2', ruleId: 'R-2' },
      },
      {
        id: 'cond-1',
        type: 'condition',
        position: { x: 0, y: 200 },
        data: { label: 'Shared Condition' },
      },
    ];
    const edges: TreeEdge[] = [
      { id: 'e1', source: 'root-1', target: 'rule-1' },
      { id: 'e2', source: 'root-1', target: 'rule-2' },
      { id: 'e3', source: 'rule-1', target: 'cond-1' },
      { id: 'e4', source: 'rule-2', target: 'cond-1' }, // second parent for cond-1
    ];

    const result = runGraphDiagnostics(nodes, edges);
    expect(result.status).toBe('error');
    const parentIssue = result.issues.find((i) => i.id === 'multiple-parents-cond-1');
    expect(parentIssue).toBeDefined();
    expect(parentIssue?.severity).toBe('error');
  });

  it('detects circular dependencies and flags cycle errors', () => {
    const nodes: TreeNode[] = [
      { id: 'n1', type: 'rule', position: { x: 0, y: 0 }, data: { label: 'Node 1', ruleId: 'R1' } },
      { id: 'n2', type: 'condition', position: { x: 0, y: 100 }, data: { label: 'Node 2' } },
    ];
    const edges: TreeEdge[] = [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n1' }, // cycle
    ];

    const result = runGraphDiagnostics(nodes, edges);
    expect(result.status).toBe('error');
    const cycleIssue = result.issues.find((i) => i.id === 'detected-cycle');
    expect(cycleIssue).toBeDefined();
  });

  it('detects self-loops on nodes', () => {
    const nodes: TreeNode[] = [
      { id: 'n1', type: 'rule', position: { x: 0, y: 0 }, data: { label: 'Self Node', ruleId: 'R1' } },
    ];
    const edges: TreeEdge[] = [{ id: 'e-loop', source: 'n1', target: 'n1' }];

    const result = runGraphDiagnostics(nodes, edges);
    expect(result.status).toBe('error');
    const loopIssue = result.issues.find((i) => i.id === 'self-loop-e-loop');
    expect(loopIssue).toBeDefined();
  });

  it('audits node completeness: empty label and missing ruleId', () => {
    const nodes: TreeNode[] = [
      { id: 'root-1', type: 'root', position: { x: 0, y: 0 }, data: { label: '' } },
      { id: 'rule-empty-id', type: 'rule', position: { x: 0, y: 100 }, data: { label: 'No Rule ID' } },
    ];
    const edges: TreeEdge[] = [{ id: 'e1', source: 'root-1', target: 'rule-empty-id' }];

    const result = runGraphDiagnostics(nodes, edges);
    const labelIssue = result.issues.find((i) => i.id === 'empty-label-root-1');
    expect(labelIssue).toBeDefined();
    expect(labelIssue?.severity).toBe('error');

    const ruleIdIssue = result.issues.find((i) => i.id === 'missing-rule-id-rule-empty-id');
    expect(ruleIdIssue).toBeDefined();
    expect(ruleIdIssue?.severity).toBe('warning');
  });

  it('identifies deprecated and draft status indicators', () => {
    const nodes: TreeNode[] = [
      {
        id: 'root-1',
        type: 'root',
        position: { x: 0, y: 0 },
        data: { label: 'Root', status: 'deprecated' },
      },
      {
        id: 'rule-1',
        type: 'rule',
        position: { x: 0, y: 100 },
        data: { label: 'Rule', ruleId: 'R1', status: 'draft' },
      },
    ];
    const edges: TreeEdge[] = [{ id: 'e1', source: 'root-1', target: 'rule-1' }];

    const result = runGraphDiagnostics(nodes, edges);
    const depIssue = result.issues.find((i) => i.id === 'deprecated-status-root-1');
    expect(depIssue?.severity).toBe('warning');

    const draftIssue = result.issues.find((i) => i.id === 'draft-status-rule-1');
    expect(draftIssue?.severity).toBe('info');
  });
});

describe('Day 11: Canvas Keyboard Shortcuts Engine (`src/lib/keyboardSafety.ts`)', () => {
  it('resolves shortcuts reference cheat sheet dialog trigger (? and Shift+/)', () => {
    expect(resolveCanvasKeyboardAction({ key: '?' })).toBe('open-shortcuts');
    expect(resolveCanvasKeyboardAction({ key: '/', shiftKey: true })).toBe('open-shortcuts');
  });

  it('resolves focus-search shortcut via Ctrl+K / Cmd+K', () => {
    expect(resolveCanvasKeyboardAction({ key: 'k', ctrlKey: true })).toBe('focus-search');
    expect(resolveCanvasKeyboardAction({ key: 'K', metaKey: true })).toBe('focus-search');
  });

  it('resolves auto-layout shortcut via Ctrl+Shift+L and Alt+L', () => {
    expect(resolveCanvasKeyboardAction({ key: 'l', ctrlKey: true, shiftKey: true })).toBe(
      'auto-layout'
    );
    expect(resolveCanvasKeyboardAction({ key: 'L', metaKey: true, shiftKey: true })).toBe(
      'auto-layout'
    );
    expect(resolveCanvasKeyboardAction({ key: 'l', altKey: true })).toBe('auto-layout');
  });

  it('resolves fit-view via Ctrl+0 / Alt+0 and reset-view via Ctrl+1 / Alt+1', () => {
    expect(resolveCanvasKeyboardAction({ key: '0', ctrlKey: true })).toBe('fit-view');
    expect(resolveCanvasKeyboardAction({ key: '0', altKey: true })).toBe('fit-view');
    expect(resolveCanvasKeyboardAction({ key: '1', metaKey: true })).toBe('reset-view');
    expect(resolveCanvasKeyboardAction({ key: '1', altKey: true })).toBe('reset-view');
  });

  it('resolves toggle-minimap via Ctrl+M / Alt+M and toggle-grid via Ctrl+G / Alt+G', () => {
    expect(resolveCanvasKeyboardAction({ key: 'm', ctrlKey: true })).toBe('toggle-minimap');
    expect(resolveCanvasKeyboardAction({ key: 'M', altKey: true })).toBe('toggle-minimap');
    expect(resolveCanvasKeyboardAction({ key: 'g', ctrlKey: true })).toBe('toggle-grid');
    expect(resolveCanvasKeyboardAction({ key: 'G', altKey: true })).toBe('toggle-grid');
  });

  it('resolves toggle-diagnostics via Ctrl+Shift+D and Alt+D', () => {
    expect(resolveCanvasKeyboardAction({ key: 'd', ctrlKey: true, shiftKey: true })).toBe(
      'toggle-diagnostics'
    );
    expect(resolveCanvasKeyboardAction({ key: 'd', altKey: true })).toBe('toggle-diagnostics');
  });

  it('resolves node cycling via Tab and Shift+Tab when canvas has nodes', () => {
    expect(resolveCanvasKeyboardAction({ key: 'Tab', hasNodes: true })).toBe('cycle-node-next');
    expect(resolveCanvasKeyboardAction({ key: 'Tab', shiftKey: true, hasNodes: true })).toBe(
      'cycle-node-prev'
    );
    expect(resolveCanvasKeyboardAction({ key: 'Tab', hasNodes: false })).toBe('ignore');
  });

  it('resolves arrow key nudging only when a node is selected without modifiers', () => {
    expect(resolveCanvasKeyboardAction({ key: 'ArrowUp', hasSelectedNode: true })).toBe(
      'nudge-node-up'
    );
    expect(resolveCanvasKeyboardAction({ key: 'ArrowDown', hasSelectedNode: true })).toBe(
      'nudge-node-down'
    );
    expect(resolveCanvasKeyboardAction({ key: 'ArrowLeft', hasSelectedNode: true })).toBe(
      'nudge-node-left'
    );
    expect(resolveCanvasKeyboardAction({ key: 'ArrowRight', hasSelectedNode: true })).toBe(
      'nudge-node-right'
    );

    // Ignored when no node is selected
    expect(resolveCanvasKeyboardAction({ key: 'ArrowUp', hasSelectedNode: false })).toBe('ignore');

    // Ignored when Ctrl modifier is held
    expect(
      resolveCanvasKeyboardAction({ key: 'ArrowUp', hasSelectedNode: true, ctrlKey: true })
    ).toBe('ignore');
  });

  it('strictly shields text controls and content-editable elements from keyboard actions', () => {
    const inputTarget = { tagName: 'INPUT' };
    const textareaTarget = { tagName: 'TEXTAREA' };
    const selectTarget = { tagName: 'SELECT' };
    const editableTarget = { isContentEditable: true };
    const noKeyTarget = { closest: (sel: string) => sel === '.nokey' };

    for (const target of [inputTarget, textareaTarget, selectTarget, editableTarget, noKeyTarget]) {
      expect(resolveCanvasKeyboardAction({ key: '?', target })).toBe('ignore');
      expect(resolveCanvasKeyboardAction({ key: 'k', ctrlKey: true, target })).toBe('ignore');
      expect(resolveCanvasKeyboardAction({ key: '0', ctrlKey: true, target })).toBe('ignore');
      expect(resolveCanvasKeyboardAction({ key: 'm', ctrlKey: true, target })).toBe('ignore');
      expect(resolveCanvasKeyboardAction({ key: 'Tab', hasNodes: true, target })).toBe('ignore');
      expect(
        resolveCanvasKeyboardAction({ key: 'ArrowUp', hasSelectedNode: true, target })
      ).toBe('ignore');
    }
  });

  it('computes correct nudged coordinate offsets for all 4 directions', () => {
    const pos = { x: 100, y: 100 };
    expect(computeNudgedPosition(pos, 'up', 20)).toEqual({ x: 100, y: 80 });
    expect(computeNudgedPosition(pos, 'down', 20)).toEqual({ x: 100, y: 120 });
    expect(computeNudgedPosition(pos, 'left', 20)).toEqual({ x: 80, y: 100 });
    expect(computeNudgedPosition(pos, 'right', 20)).toEqual({ x: 120, y: 100 });
    expect(computeNudgedPosition(pos, 'up', 50)).toEqual({ x: 100, y: 50 });
  });

  it('cycles through node selection forwards and backwards in wraparound fashion', () => {
    const nodes = [{ id: 'n1' }, { id: 'n2' }, { id: 'n3' }];

    // Forward cycling
    expect(getNextSelectedNodeId(nodes, null, 'next')).toBe('n1');
    expect(getNextSelectedNodeId(nodes, 'n1', 'next')).toBe('n2');
    expect(getNextSelectedNodeId(nodes, 'n2', 'next')).toBe('n3');
    expect(getNextSelectedNodeId(nodes, 'n3', 'next')).toBe('n1'); // wraps

    // Backward cycling
    expect(getNextSelectedNodeId(nodes, 'n1', 'prev')).toBe('n3'); // wraps
    expect(getNextSelectedNodeId(nodes, 'n3', 'prev')).toBe('n2');
    expect(getNextSelectedNodeId(nodes, 'n2', 'prev')).toBe('n1');

    // Edge cases
    expect(getNextSelectedNodeId([], null, 'next')).toBeNull();
    expect(getNextSelectedNodeId(nodes, 'unknown-id', 'next')).toBe('n1');
  });
});

describe('Day 11: Protected Reviewer Flow & Document Export (`Drag → Connect → Edit → Export JSON → Validate`)', () => {
  it('executes full end-to-end reviewer sequence maintaining integrity and schema conformity', async () => {
    const { exportTreeDocument } = await import('../lib/graphOperations');
    const store = useTreeStore.getState();
    store.resetToSampleData();

    // 1. Drag / Create new node
    const ruleNode = store.createNode('rule', { x: 300, y: 500 });
    expect(ruleNode).toBeDefined();
    expect(ruleNode?.id).toMatch(/^node_rule_/);

    // 2. Connect (valid connection: Root -> Rule)
    const connectRes = store.addEdgeConnection({
      source: 'root-policy-hierarchy',
      target: ruleNode!.id,
    });
    expect(connectRes.ok).toBe(true);

    // 2b. Attempt invalid connection (Action -> Rule) and verify rejection
    const actionNode = store.createNode('action', { x: 500, y: 500 })!;
    const invalidRes = store.addEdgeConnection({
      source: actionNode.id,
      target: ruleNode!.id,
    });
    expect(invalidRes.ok).toBe(false);
    expect(invalidRes.message).toBeDefined();

    // 3. Edit properties
    const editRes = store.updateNodeData(ruleNode!.id, {
      label: 'Reviewer Verified Rule',
      ruleId: 'SEC-17A-REVIEW',
      severity: 'high',
      status: 'active',
    });
    expect(editRes).toBe(true);

    // 4. Export JSON Document
    const currentNodes = useTreeStore.getState().nodes;
    const currentEdges = useTreeStore.getState().edges;
    const exportedDoc = exportTreeDocument(currentNodes, currentEdges);

    // Validate schema conformity: {"version": 1, "nodes": [], "edges": []}
    expect(exportedDoc.version).toBe(1);
    expect(Array.isArray(exportedDoc.nodes)).toBe(true);
    expect(Array.isArray(exportedDoc.edges)).toBe(true);
    expect(exportedDoc.nodes.length).toBe(currentNodes.length);
    expect(exportedDoc.edges.length).toBe(currentEdges.length);

    // Ensure transient UI states are strictly excluded from JSON payload
    const docJsonString = JSON.stringify(exportedDoc);
    expect(docJsonString).not.toContain('selectedNodeId');
    expect(docJsonString).not.toContain('selectedEdgeId');
    expect(docJsonString).not.toContain('deleteConfirmation');
    expect(docJsonString).not.toContain('miniMapVisible');
    expect(docJsonString).not.toContain('focusPulseNodeId');

    // Verify node IDs remain strictly unique
    const exportedIds = new Set(exportedDoc.nodes.map((n) => n.id));
    expect(exportedIds.size).toBe(exportedDoc.nodes.length);

    // 5. Validate / Run Diagnostics on the resulting graph
    const diag = runGraphDiagnostics(exportedDoc.nodes, exportedDoc.edges);
    expect(diag.metrics.nodeCount).toBe(exportedDoc.nodes.length);
    expect(diag.metrics.edgeCount).toBe(exportedDoc.edges.length);

    // 6. Test Undo / Redo reliability
    const preUndoCount = useTreeStore.getState().nodes.length;
    useTreeStore.getState().undo();
    expect(useTreeStore.getState().nodes.length).toBeLessThanOrEqual(preUndoCount);
    useTreeStore.getState().redo();
    expect(useTreeStore.getState().nodes.length).toBe(preUndoCount);
  });
});

