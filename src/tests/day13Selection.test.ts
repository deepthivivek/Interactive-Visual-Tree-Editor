import { describe, it, expect, beforeEach } from 'vitest';
import { normalizeBox, findNodesInSelectionBox } from '../lib/selectionBox';
import { useTreeStore } from '../store/treeStore';
import type { TreeNode } from '../types/tree';
import { resolveKeyboardAction, resolveCanvasKeyboardAction } from '../lib/keyboardSafety';
import { resolveNodeContextMenuItems, resolvePaneContextMenuItems } from '../lib/contextMenu';

describe('Day 13: Drag-Box Multi-Selection Engine (`src/lib/selectionBox.ts`)', () => {
  beforeEach(() => {
    useTreeStore.getState().resetToSampleData();
  });

  it('normalizes selection boxes correctly regardless of drag direction', () => {
    const box1 = { startX: 10, startY: 20, endX: 100, endY: 80 };
    const norm1 = normalizeBox(box1);
    expect(norm1).toEqual({ x: 10, y: 20, width: 90, height: 60 });

    // Reverse drag direction (bottom-right to top-left)
    const box2 = { startX: 100, startY: 80, endX: 10, endY: 20 };
    const norm2 = normalizeBox(box2);
    expect(norm2).toEqual({ x: 10, y: 20, width: 90, height: 60 });
  });

  it('identifies nodes intersecting or contained within the selection box', () => {
    const nodes: TreeNode[] = [
      { id: 'n1', type: 'root', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
      { id: 'n2', type: 'rule', position: { x: 300, y: 300 }, data: { label: 'Node 2' } },
      { id: 'n3', type: 'action', position: { x: 50, y: 50 }, data: { label: 'Node 3' } },
    ];

    // Box covering n1 and n3 (node width=220, height=80)
    const box = { startX: -10, startY: -10, endX: 280, endY: 150 };
    const matched = findNodesInSelectionBox(box, nodes);

    expect(matched).toContain('n1');
    expect(matched).toContain('n3');
    expect(matched).not.toContain('n2');
  });

  it('ignores tiny accidental clicks below threshold', () => {
    const nodes: TreeNode[] = [
      { id: 'n1', type: 'root', position: { x: 10, y: 10 }, data: { label: 'Node 1' } },
    ];
    const tinyBox = { startX: 12, startY: 12, endX: 14, endY: 14 }; // width=2, height=2
    const matched = findNodesInSelectionBox(tinyBox, nodes);
    expect(matched.length).toBe(0);
  });

  it('integrates with store selection actions correctly', () => {
    expect(useTreeStore.getState().selectedNodeIds.length).toBe(0);

    useTreeStore.getState().setSelectedNodeIds(new Set(['root-policy-hierarchy', 'rule-finra-2210']));
    expect(useTreeStore.getState().selectedNodeIds.length).toBe(2);
    expect(useTreeStore.getState().selectedNodeIds.includes('root-policy-hierarchy')).toBe(true);
    expect(useTreeStore.getState().selectedNodeIds.includes('rule-finra-2210')).toBe(true);

    useTreeStore.getState().toggleNodeSelection('rule-finra-2210', true); // toggle off
    expect(useTreeStore.getState().selectedNodeIds.length).toBe(1);
    expect(useTreeStore.getState().selectedNodeIds.includes('root-policy-hierarchy')).toBe(true);
    expect(useTreeStore.getState().selectedNodeIds.includes('rule-finra-2210')).toBe(false);

    useTreeStore.getState().clearSelection();
    const state = useTreeStore.getState();
    const len = Array.isArray(state.selectedNodeIds) ? state.selectedNodeIds.length : (state.selectedNodeIds as any).size;
    expect(len).toBe(0);
  });

  it('persists multi-selection when modifier key is released', () => {
    // 1. Single click selects first node
    useTreeStore.getState().setSelectedNodeId('root-policy-hierarchy');
    expect(useTreeStore.getState().selectedNodeId).toBe('root-policy-hierarchy');
    expect(useTreeStore.getState().selectedNodeIds).toEqual(['root-policy-hierarchy']);

    // 2. Ctrl/Cmd-click on second node adds it
    useTreeStore.getState().toggleNodeSelection('rule-finra-2210', true);
    expect(useTreeStore.getState().selectedNodeIds).toContain('root-policy-hierarchy');
    expect(useTreeStore.getState().selectedNodeIds).toContain('rule-finra-2210');
    expect(useTreeStore.getState().selectedNodeIds.length).toBe(2);

    // 3. Ctrl/Cmd-click on third node adds it
    useTreeStore.getState().toggleNodeSelection('rule-sec-17a-4', true);
    expect(useTreeStore.getState().selectedNodeIds.length).toBe(3);
    expect(useTreeStore.getState().selectedNodeIds).toEqual(
      expect.arrayContaining(['root-policy-hierarchy', 'rule-finra-2210', 'rule-sec-17a-4'])
    );

    // 4. Modifier key released (no state clear happens on keyup)
    // Selection must remain active and unchanged!
    const stateAfterKeyRelease = useTreeStore.getState();
    expect(stateAfterKeyRelease.selectedNodeIds.length).toBe(3);
    expect(stateAfterKeyRelease.selectedNodeIds.includes('root-policy-hierarchy')).toBe(true);
    expect(stateAfterKeyRelease.selectedNodeIds.includes('rule-finra-2210')).toBe(true);
    expect(stateAfterKeyRelease.selectedNodeIds.includes('rule-sec-17a-4')).toBe(true);
  });

  it('toggles an already-selected node off with Ctrl/Cmd while keeping others selected', () => {
    useTreeStore.getState().setSelectedNodeIds(['root-policy-hierarchy', 'rule-finra-2210', 'rule-sec-17a-4']);
    expect(useTreeStore.getState().selectedNodeIds.length).toBe(3);

    // Ctrl-click rule-finra-2210 to toggle it off
    useTreeStore.getState().toggleNodeSelection('rule-finra-2210', true);
    const updated = useTreeStore.getState().selectedNodeIds;
    expect(updated.length).toBe(2);
    expect(updated).toContain('root-policy-hierarchy');
    expect(updated).toContain('rule-sec-17a-4');
    expect(updated).not.toContain('rule-finra-2210');
  });

  it('handles both Array and Set inputs to setSelectedNodeIds without crashing', () => {
    // Array input
    useTreeStore.getState().setSelectedNodeIds(['root-policy-hierarchy', 'rule-finra-2210']);
    expect(Array.isArray(useTreeStore.getState().selectedNodeIds)).toBe(true);
    expect(useTreeStore.getState().selectedNodeIds.length).toBe(2);

    // Set input
    useTreeStore.getState().setSelectedNodeIds(new Set(['rule-sec-17a-4', 'cond-sec-17a-4']));
    expect(Array.isArray(useTreeStore.getState().selectedNodeIds)).toBe(true);
    expect(useTreeStore.getState().selectedNodeIds.length).toBe(2);
    expect(useTreeStore.getState().selectedNodeIds).toContain('rule-sec-17a-4');
    expect(useTreeStore.getState().selectedNodeIds).toContain('cond-sec-17a-4');
  });

  it('supports moving multiple selected nodes in one drag transaction preserving graph relationships', () => {
    const store = useTreeStore.getState();
    const initialEdges = [...store.edges];
    const initialNodes = [...store.nodes];

    // Select 2 nodes
    useTreeStore.getState().setSelectedNodeIds(['rule-finra-2210', 'rule-sec-17a-4']);
    expect(useTreeStore.getState().selectedNodeIds.length).toBe(2);

    // Start drag transaction
    useTreeStore.getState().startNodeDrag();

    // Move both nodes by +50, +30
    const node1Before = initialNodes.find((n) => n.id === 'rule-finra-2210')!;
    const node2Before = initialNodes.find((n) => n.id === 'rule-sec-17a-4')!;

    const shiftedNodes = store.nodes.map((n) => {
      if (n.id === 'rule-finra-2210') {
        return { ...n, position: { x: node1Before.position.x + 50, y: node1Before.position.y + 30 } };
      }
      if (n.id === 'rule-sec-17a-4') {
        return { ...n, position: { x: node2Before.position.x + 50, y: node2Before.position.y + 30 } };
      }
      return n;
    });

    useTreeStore.getState().setNodes(shiftedNodes);

    // Stop drag transaction (commits exactly one undo step)
    useTreeStore.getState().stopNodeDrag();

    const afterMoveNodes = useTreeStore.getState().nodes;
    const node1After = afterMoveNodes.find((n) => n.id === 'rule-finra-2210')!;
    const node2After = afterMoveNodes.find((n) => n.id === 'rule-sec-17a-4')!;
    const unselectedNode = afterMoveNodes.find((n) => n.id === 'root-policy-hierarchy')!;

    // Selected nodes moved
    expect(node1After.position.x).toBe(node1Before.position.x + 50);
    expect(node1After.position.y).toBe(node1Before.position.y + 30);
    expect(node2After.position.x).toBe(node2Before.position.x + 50);
    expect(node2After.position.y).toBe(node2Before.position.y + 30);

    // Unselected nodes did NOT move
    const rootBefore = initialNodes.find((n) => n.id === 'root-policy-hierarchy')!;
    expect(unselectedNode.position).toEqual(rootBefore.position);

    // Graph edges and relationships are completely preserved
    expect(useTreeStore.getState().edges).toEqual(initialEdges);

    // Undo restores baseline in 1 step
    expect(useTreeStore.getState().canUndo()).toBe(true);
    useTreeStore.getState().undo();

    const afterUndoNodes = useTreeStore.getState().nodes;
    expect(afterUndoNodes.find((n) => n.id === 'rule-finra-2210')!.position).toEqual(node1Before.position);
    expect(afterUndoNodes.find((n) => n.id === 'rule-sec-17a-4')!.position).toEqual(node2Before.position);

    // Redo reapplies in 1 step
    useTreeStore.getState().redo();
    const afterRedoNodes = useTreeStore.getState().nodes;
    expect(afterRedoNodes.find((n) => n.id === 'rule-finra-2210')!.position.x).toBe(node1Before.position.x + 50);
  });

  it('supports copying and deleting multiple selected nodes in bulk operations', () => {
    useTreeStore.getState().setSelectedNodeIds(['rule-finra-2210', 'rule-sec-17a-4']);
    expect(useTreeStore.getState().selectedNodeIds.length).toBe(2);

    // Copy selected nodes
    const copyOk = useTreeStore.getState().copySelectedNodes();
    expect(copyOk).toBe(true);
    const clipboard = useTreeStore.getState().clipboard;
    expect(clipboard).not.toBeNull();
    expect(clipboard!.nodes.length).toBe(2);

    // Delete selected nodes
    const deleteOk = useTreeStore.getState().deleteSelectedNodes();
    expect(deleteOk).toBe(true);

    const store = useTreeStore.getState();
    expect(store.nodes.some((n) => n.id === 'rule-finra-2210' || n.id === 'rule-sec-17a-4')).toBe(false);
    expect(store.selectedNodeIds.length).toBe(0);
    // Unrelated nodes (like root) remain intact
    expect(store.nodes.some((n) => n.id === 'root-policy-hierarchy')).toBe(true);
  });

  it('pastes multi-selection copy at requested destination coordinates and allows deleting pasted nodes', () => {
    useTreeStore.getState().setSelectedNodeIds(['rule-finra-2210', 'rule-sec-17a-4']);
    useTreeStore.getState().copySelectedNodes();

    const initialCount = useTreeStore.getState().nodes.length;

    // Paste at requested flow position (x: 1000, y: 500)
    const pasteRes = useTreeStore.getState().pasteSubtree(null, {
      cursorPosition: { x: 1000, y: 500 },
    });
    expect(pasteRes.ok).toBe(true);
    expect(pasteRes.pastedCount).toBe(2);

    const store = useTreeStore.getState();
    expect(store.nodes.length).toBe(initialCount + 2);

    // Check root of pasted group is at requested position
    const pastedRoot = store.nodes.find((n) => n.id === pasteRes.newRootId)!;
    expect(pastedRoot.position).toEqual({ x: 1000, y: 500 });

    // Select pasted nodes and delete them
    const pastedNodeIds = store.nodes.slice(initialCount).map((n) => n.id);
    store.setSelectedNodeIds(pastedNodeIds);
    expect(store.selectedNodeIds.length).toBe(2);

    const deleteRes = store.deleteSelectedNodes();
    expect(deleteRes).toBe(true);

    const afterDeleteStore = useTreeStore.getState();
    expect(afterDeleteStore.nodes.length).toBe(initialCount);
    expect(afterDeleteStore.nodes.some((n) => n.id === 'root-policy-hierarchy')).toBe(true);
  });

  it('should resolve delete-node action on Delete key when multiple nodes are selected', () => {
    const action = resolveKeyboardAction({
      key: 'Delete',
      target: { tagName: 'div' },
      selection: {
        selectedNodeId: null,
        selectedNodeIds: ['rule-finra-2210', 'rule-sec-17a-4'],
        selectedEdgeId: null,
      },
      confirmationOpen: false,
    });
    expect(action).toBe('delete-node');
  });

  it('should resolve copy-subtree action on Ctrl+C when multiple nodes are selected', () => {
    const action = resolveCanvasKeyboardAction({
      key: 'c',
      ctrlKey: true,
      hasSelectedNode: false,
      selectedNodeCount: 2,
    });
    expect(action).toBe('copy-subtree');
  });

  it('deletes every type of node (Root, Rule, Condition, Action) correctly', () => {
    const store = useTreeStore.getState();

    // 1. Action node deletion
    const actionNode = store.nodes.find((n) => n.type === 'action')!;
    const deleteActionRes = store.deleteSingleNode(actionNode.id);
    expect(deleteActionRes).toBe(true);
    expect(useTreeStore.getState().nodes.find((n) => n.id === actionNode.id)).toBeUndefined();

    // 2. Condition node deletion
    const conditionNode = store.nodes.find((n) => n.type === 'condition')!;
    const deleteCondRes = store.deleteSingleNode(conditionNode.id);
    expect(deleteCondRes).toBe(true);
    expect(useTreeStore.getState().nodes.find((n) => n.id === conditionNode.id)).toBeUndefined();

    // 3. Rule node deletion
    const ruleNode = store.nodes.find((n) => n.type === 'rule')!;
    const deleteRuleRes = store.deleteSingleNode(ruleNode.id);
    expect(deleteRuleRes).toBe(true);
    expect(useTreeStore.getState().nodes.find((n) => n.id === ruleNode.id)).toBeUndefined();

    // 4. Root node deletion
    const rootNode = store.nodes.find((n) => n.type === 'root')!;
    const deleteRootRes = store.deleteSingleNode(rootNode.id);
    expect(deleteRootRes).toBe(true);
    expect(useTreeStore.getState().nodes.find((n) => n.id === rootNode.id)).toBeUndefined();
    expect(useTreeStore.getState().statusFeedback).toBe('Node deleted successfully.');
  });

  it('deletes multiple selected nodes containing Root and other types simultaneously in bulk', () => {
    useTreeStore.getState().resetToSampleData();
    const store = useTreeStore.getState();
    const root = store.nodes.find((n) => n.type === 'root')!;
    const rule = store.nodes.find((n) => n.type === 'rule')!;

    useTreeStore.getState().setSelectedNodeIds([root.id, rule.id]);
    expect(useTreeStore.getState().selectedNodeIds.length).toBe(2);

    const deleteOk = useTreeStore.getState().deleteSelectedNodes();
    expect(deleteOk).toBe(true);

    const afterState = useTreeStore.getState();
    expect(afterState.nodes.find((n) => n.id === root.id)).toBeUndefined();
    expect(afterState.nodes.find((n) => n.id === rule.id)).toBeUndefined();
    expect(afterState.statusFeedback).toBe('2 nodes deleted successfully.');
  });

  it('supports duplicate, delete-subtree, collapse, and nudging shortcuts when selected via selectedNodeCount', () => {
    expect(
      resolveCanvasKeyboardAction({
        key: 'd',
        ctrlKey: true,
        selectedNodeCount: 2,
      })
    ).toBe('duplicate-subtree');

    expect(
      resolveCanvasKeyboardAction({
        key: 'Delete',
        shiftKey: true,
        selectedNodeCount: 1,
      })
    ).toBe('delete-subtree');

    expect(
      resolveCanvasKeyboardAction({
        key: 'e',
        ctrlKey: true,
        selectedNodeCount: 1,
      })
    ).toBe('toggle-collapse');

    expect(
      resolveCanvasKeyboardAction({
        key: 'ArrowDown',
        selectedNodeCount: 3,
      })
    ).toBe('nudge-node-down');
  });

  it('supports select-all (Ctrl+A / Cmd+A) when canvas has nodes', () => {
    expect(
      resolveCanvasKeyboardAction({
        key: 'a',
        ctrlKey: true,
        hasNodes: true,
      })
    ).toBe('select-all');

    expect(
      resolveCanvasKeyboardAction({
        key: 'a',
        metaKey: true,
        hasNodes: true,
      })
    ).toBe('select-all');

    // Ignored when typing in text fields
    expect(
      resolveCanvasKeyboardAction({
        key: 'a',
        ctrlKey: true,
        hasNodes: true,
        target: { tagName: 'INPUT' },
      })
    ).toBe('ignore');
  });

  it('deletes a single node of any type (root, rule, condition, action) via deleteSelectedNodes', () => {
    // 1. Root node
    useTreeStore.getState().resetToSampleData();
    const rootNode = useTreeStore.getState().nodes.find((n) => n.type === 'root')!;
    useTreeStore.getState().setSelectedNodeId(rootNode.id);
    expect(useTreeStore.getState().deleteSelectedNodes()).toBe(true);
    expect(useTreeStore.getState().nodes.find((n) => n.id === rootNode.id)).toBeUndefined();
    expect(useTreeStore.getState().statusFeedback).toBe('1 node deleted successfully.');

    // 2. Rule node
    useTreeStore.getState().resetToSampleData();
    const ruleNode = useTreeStore.getState().nodes.find((n) => n.type === 'rule')!;
    useTreeStore.getState().setSelectedNodeId(ruleNode.id);
    expect(useTreeStore.getState().deleteSelectedNodes()).toBe(true);
    expect(useTreeStore.getState().nodes.find((n) => n.id === ruleNode.id)).toBeUndefined();
    expect(useTreeStore.getState().statusFeedback).toBe('1 node deleted successfully.');

    // 3. Condition node
    useTreeStore.getState().resetToSampleData();
    const conditionNode = useTreeStore.getState().nodes.find((n) => n.type === 'condition')!;
    useTreeStore.getState().setSelectedNodeId(conditionNode.id);
    expect(useTreeStore.getState().deleteSelectedNodes()).toBe(true);
    expect(useTreeStore.getState().nodes.find((n) => n.id === conditionNode.id)).toBeUndefined();
    expect(useTreeStore.getState().statusFeedback).toBe('1 node deleted successfully.');

    // 4. Action node
    useTreeStore.getState().resetToSampleData();
    const actionNode = useTreeStore.getState().nodes.find((n) => n.type === 'action')!;
    useTreeStore.getState().setSelectedNodeId(actionNode.id);
    expect(useTreeStore.getState().deleteSelectedNodes()).toBe(true);
    expect(useTreeStore.getState().nodes.find((n) => n.id === actionNode.id)).toBeUndefined();
    expect(useTreeStore.getState().statusFeedback).toBe('1 node deleted successfully.');
  });

  it('deletes newly pasted nodes cleanly using deleteSelectedNodes', () => {
    useTreeStore.getState().resetToSampleData();
    const ruleNode = useTreeStore.getState().nodes.find((n) => n.type === 'rule')!;
    useTreeStore.getState().copySubtree(ruleNode.id);

    const pasteRes = useTreeStore.getState().pasteSubtree();
    expect(pasteRes.ok).toBe(true);
    const newRootId = pasteRes.newRootId!;
    expect(useTreeStore.getState().selectedNodeId).toBe(newRootId);

    const deleteOk = useTreeStore.getState().deleteSelectedNodes();
    expect(deleteOk).toBe(true);
    expect(useTreeStore.getState().nodes.find((n) => n.id === newRootId)).toBeUndefined();
    expect(useTreeStore.getState().statusFeedback).toBe('1 node deleted successfully.');
  });

  it('supports context-menu delete actions (deleteSingleNode and deleteSubtree) correctly', () => {
    useTreeStore.getState().resetToSampleData();
    const conditionNode = useTreeStore.getState().nodes.find((n) => n.type === 'condition')!;
    
    // Simulate context menu delete action (deleteSingleNode)
    const deleteRes = useTreeStore.getState().deleteSingleNode(conditionNode.id);
    expect(deleteRes).toBe(true);
    expect(useTreeStore.getState().nodes.find((n) => n.id === conditionNode.id)).toBeUndefined();
    expect(useTreeStore.getState().statusFeedback).toBe('Node deleted successfully.');
  });

  it('verifies context menu item resolvers for nodes and pane', () => {
    useTreeStore.getState().resetToSampleData();
    const ruleNode = useTreeStore.getState().nodes.find((n) => n.type === 'rule')!;
    const items = resolveNodeContextMenuItems(ruleNode, {
      hasClipboard: true,
      descendantCount: 2,
      isCollapsed: false,
    });
    expect(items.some((i) => i.id === 'copy-subtree')).toBe(true);
    expect(items.some((i) => i.id === 'paste-subtree-child')).toBe(true);
    expect(items.some((i) => i.id === 'duplicate-subtree')).toBe(true);
    expect(items.some((i) => i.id === 'delete-subtree')).toBe(true);

    const paneItems = resolvePaneContextMenuItems({ hasClipboard: true });
    expect(paneItems.some((i) => i.id === 'paste-subtree-pane')).toBe(true);
    expect(paneItems.some((i) => i.id === 'add-root')).toBe(true);
  });

  it('guarantees copying exactly 4 selected nodes from a 10-node tree copies and pastes exactly 4 nodes', () => {
    useTreeStore.getState().resetToSampleData();
    const initialNodes = useTreeStore.getState().nodes;
    expect(initialNodes.length).toBe(10);

    // Simulate stale selected: true flags on remaining nodes
    useTreeStore.setState({
      nodes: initialNodes.map((n, idx) => ({ ...n, selected: idx >= 4 })),
    });

    // Explicitly select 4 specific nodes
    const fourIds = ['root-policy-hierarchy', 'rule-finra-2210', 'cond-finra-2210', 'act-finra-2210'];
    useTreeStore.getState().setSelectedNodeIds(fourIds);
    expect(useTreeStore.getState().selectedNodeIds).toHaveLength(4);

    // Copy selected nodes
    const copyOk = useTreeStore.getState().copySelectedNodes();
    expect(copyOk).toBe(true);

    const clipboard = useTreeStore.getState().clipboard;
    expect(clipboard).not.toBeNull();
    // CRITICAL: Must be exactly 4 nodes, NOT 10 nodes!
    expect(clipboard!.nodes).toHaveLength(4);
    expect(clipboard!.nodes.map((n) => n.id).sort()).toEqual(fourIds.slice().sort());

    // Paste the 4 copied nodes
    const pasteRes = useTreeStore.getState().pasteSubtree(null, {
      cursorPosition: { x: 800, y: 800 },
    });
    expect(pasteRes.ok).toBe(true);
    // CRITICAL: Must have pasted exactly 4 nodes!
    expect(pasteRes.pastedCount).toBe(4);

    const afterPasteNodes = useTreeStore.getState().nodes;
    expect(afterPasteNodes.length).toBe(14); // 10 original + 4 pasted = 14

    // Newly pasted root node should be the current selection
    expect(useTreeStore.getState().selectedNodeId).toBe(pasteRes.newRootId);
  });
});

