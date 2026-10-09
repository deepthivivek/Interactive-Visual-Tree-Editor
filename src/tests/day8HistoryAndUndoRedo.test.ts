import { describe, it, expect, beforeEach } from 'vitest';
import { applyNodeChanges } from '@xyflow/react';
import { useTreeStore } from '../store/treeStore';
import { resolveUndoRedoAction, type ElementLike } from '../lib/keyboardSafety';
import type { TreeNode, TreeEdge, NodeType } from '../types/tree';

describe('Day 8: Zundo Temporal History & Undo/Redo Engine', () => {
  beforeEach(() => {
    useTreeStore.getState().loadSampleTree();
  });

  describe('1. Store Integration, Partialize & History Boundary', () => {
    it('initializes with a clean baseline: 0 past states and 0 future states', () => {
      const { canUndo, canRedo, getHistoryDepth } = useTreeStore.getState();
      expect(canUndo()).toBe(false);
      expect(canRedo()).toBe(false);
      expect(getHistoryDepth()).toEqual({ past: 0, future: 0 });
    });

    it('tracks only graph document state (nodes and edges), producing zero history entries for transient selection changes', () => {
      const { setSelectedNodeId, setSelectedEdgeId, clearSelection, getHistoryDepth } =
        useTreeStore.getState();

      setSelectedNodeId('rule-finra-2210');
      setSelectedNodeId('cond-finra-2210');
      setSelectedEdgeId('e-finra-cond');
      clearSelection();

      expect(getHistoryDepth().past).toBe(0);
      expect(getHistoryDepth().future).toBe(0);
    });

    it('produces zero history entries for transient feedback or confirmation modals', () => {
      const { setStatusFeedback, setAddChildChoiceOpen, requestDeleteNode, cancelDeleteNode, getHistoryDepth } =
        useTreeStore.getState();

      setStatusFeedback('Test message');
      setAddChildChoiceOpen(true);
      requestDeleteNode('rule-finra-2210');
      cancelDeleteNode();

      expect(getHistoryDepth().past).toBe(0);
    });

    it('enforces history limit of 100', () => {
      const { createNode } = useTreeStore.getState();

      for (let i = 0; i < 110; i++) {
        createNode('action', { x: i * 10, y: i * 10 });
      }

      const { getHistoryDepth } = useTreeStore.getState();
      expect(getHistoryDepth().past).toBe(100);
    });
  });

  describe('2. Single Logical Operations & Atomic History Entries', () => {
    it('records exactly one history entry for node creation and restores cleanly on undo', () => {
      const { createNode, undo, redo, getHistoryDepth } = useTreeStore.getState();
      const initialNodeCount = useTreeStore.getState().nodes.length;

      const newNode = createNode('rule', { x: 300, y: 300 });
      expect(newNode).toBeDefined();
      expect(getHistoryDepth().past).toBe(1);

      undo();
      expect(useTreeStore.getState().nodes.length).toBe(initialNodeCount);
      expect(useTreeStore.getState().nodes.some((n) => n.id === newNode!.id)).toBe(false);
      expect(getHistoryDepth().future).toBe(1);

      redo();
      expect(useTreeStore.getState().nodes.length).toBe(initialNodeCount + 1);
      const restored = useTreeStore.getState().nodes.find((n) => n.id === newNode!.id);
      expect(restored).toBeDefined();
      expect(restored?.id).toBe(newNode!.id);
      expect(restored?.position).toEqual({ x: 300, y: 300 });
    });

    it('records exactly one entry for valid connection, and zero entries for invalid connection', () => {
      const { createNode, addEdgeConnection, undo, getHistoryDepth } = useTreeStore.getState();
      const rule = createNode('rule', { x: 100, y: 100 })!;
      const cond = createNode('condition', { x: 100, y: 200 })!;
      expect(getHistoryDepth().past).toBe(2);

      // Invalid connection (Condition -> Rule violates hierarchy)
      const invalidRes = addEdgeConnection({ source: cond.id, target: rule.id });
      expect(invalidRes.ok).toBe(false);
      expect(getHistoryDepth().past).toBe(2); // Zero new entries!

      // Valid connection (Rule -> Condition)
      const validRes = addEdgeConnection({ source: rule.id, target: cond.id });
      expect(validRes.ok).toBe(true);
      expect(getHistoryDepth().past).toBe(3); // Exactly one new entry!

      undo();
      expect(useTreeStore.getState().edges.some((e) => e.id === validRes.edge!.id)).toBe(false);
    });

    it('records exactly one entry for edge reconnection on success, and zero entries on failure', () => {
      const { reconnectEdgeConnection, undo, redo, getHistoryDepth, edges } =
        useTreeStore.getState();
      const edge = edges.find((e) => e.id === 'e-finra-cond')!;
      expect(edge).toBeDefined();
      expect(getHistoryDepth().past).toBe(0);

      // Invalid reconnect (target to root-policy-hierarchy: root cannot have parent)
      const failRes = reconnectEdgeConnection(edge, {
        source: 'rule-finra-2210',
        target: 'root-policy-hierarchy',
      });
      expect(failRes.ok).toBe(false);
      expect(getHistoryDepth().past).toBe(0);
      // Original edge intact
      expect(useTreeStore.getState().edges.find((e) => e.id === edge.id)?.target).toBe(
        'cond-finra-2210'
      );

      // Valid reconnect (reparent cond-finra-2210 to rule-sec-17a-4)
      const successRes = reconnectEdgeConnection(edge, {
        source: 'rule-sec-17a-4',
        target: 'cond-finra-2210',
      });
      expect(successRes.ok).toBe(true);
      expect(getHistoryDepth().past).toBe(1);
      expect(useTreeStore.getState().edges.find((e) => e.id === edge.id)?.source).toBe(
        'rule-sec-17a-4'
      );

      undo();
      expect(useTreeStore.getState().edges.find((e) => e.id === edge.id)?.source).toBe(
        'rule-finra-2210'
      );

      redo();
      expect(useTreeStore.getState().edges.find((e) => e.id === edge.id)?.source).toBe(
        'rule-sec-17a-4'
      );
    });

    it('records atomic combined entry for addChild (node + edge in single step)', () => {
      const { addChild, undo, redo, getHistoryDepth } = useTreeStore.getState();
      const initialNodeCount = useTreeStore.getState().nodes.length;
      const initialEdgeCount = useTreeStore.getState().edges.length;

      const res = addChild('rule-finra-2210', 'condition');
      expect(res.ok).toBe(true);
      expect(getHistoryDepth().past).toBe(1);

      undo();
      expect(useTreeStore.getState().nodes.length).toBe(initialNodeCount);
      expect(useTreeStore.getState().edges.length).toBe(initialEdgeCount);

      redo();
      expect(useTreeStore.getState().nodes.length).toBe(initialNodeCount + 1);
      expect(useTreeStore.getState().edges.length).toBe(initialEdgeCount + 1);
    });

    it('records atomic combined entry for node deletion (node + incident edges in single step)', () => {
      const { requestDeleteNode, confirmDeleteNode, undo, redo, getHistoryDepth } =
        useTreeStore.getState();
      const targetId = 'rule-finra-2210';
      const initialNodeCount = useTreeStore.getState().nodes.length;
      const initialEdgeCount = useTreeStore.getState().edges.length;

      requestDeleteNode(targetId);
      confirmDeleteNode();
      expect(getHistoryDepth().past).toBe(1);

      // Node and all incident edges removed
      expect(useTreeStore.getState().nodes.some((n) => n.id === targetId)).toBe(false);
      expect(
        useTreeStore.getState().edges.some((e) => e.source === targetId || e.target === targetId)
      ).toBe(false);

      undo();
      expect(useTreeStore.getState().nodes.length).toBe(initialNodeCount);
      expect(useTreeStore.getState().edges.length).toBe(initialEdgeCount);
      expect(useTreeStore.getState().nodes.some((n) => n.id === targetId)).toBe(true);

      redo();
      expect(useTreeStore.getState().nodes.some((n) => n.id === targetId)).toBe(false);
    });

    it('records atomic entry for subtree deletion and restores all descendants on undo', () => {
      const { deleteSubtree, undo, redo, getHistoryDepth } = useTreeStore.getState();
      const initialNodeCount = useTreeStore.getState().nodes.length;
      const initialEdgeCount = useTreeStore.getState().edges.length;

      // Delete SEC-17a-4 subtree (rule-sec-17a-4, cond-sec-17a-4, act-sec-17a-4)
      const res = deleteSubtree('rule-sec-17a-4');
      expect(res).toBe(true);
      expect(getHistoryDepth().past).toBe(1);

      expect(useTreeStore.getState().nodes.length).toBe(initialNodeCount - 3);

      undo();
      expect(useTreeStore.getState().nodes.length).toBe(initialNodeCount);
      expect(useTreeStore.getState().edges.length).toBe(initialEdgeCount);
      expect(useTreeStore.getState().nodes.some((n) => n.id === 'rule-sec-17a-4')).toBe(true);
      expect(useTreeStore.getState().nodes.some((n) => n.id === 'cond-sec-17a-4')).toBe(true);
      expect(useTreeStore.getState().nodes.some((n) => n.id === 'act-sec-17a-4')).toBe(true);

      redo();
      expect(useTreeStore.getState().nodes.length).toBe(initialNodeCount - 3);
    });

    it('records atomic entry for batch operations and returns false with 0 entries on unchanged batch', () => {
      const { applyGraphBatch, undo, getHistoryDepth } = useTreeStore.getState();
      const initialNodes = useTreeStore.getState().nodes;
      const initialEdges = useTreeStore.getState().edges;

      // Unchanged batch -> returns false, 0 history entries
      const noop = applyGraphBatch({ nodes: initialNodes, edges: initialEdges });
      expect(noop).toBe(false);
      expect(getHistoryDepth().past).toBe(0);

      // Modified batch
      const modifiedNodes = initialNodes.map((n) =>
        n.id === 'rule-finra-2210' ? { ...n, position: { x: 999, y: 999 } } : n
      );
      const applied = applyGraphBatch({ nodes: modifiedNodes });
      expect(applied).toBe(true);
      expect(getHistoryDepth().past).toBe(1);

      undo();
      expect(useTreeStore.getState().nodes.find((n) => n.id === 'rule-finra-2210')?.position).not.toEqual({
        x: 999,
        y: 999,
      });
    });
  });

  describe('3. Drag Transactions & Group Move Commits', () => {
    it('creates exactly one history entry for a completed drag gesture where nodes moved', () => {
      const { startNodeDrag, setNodes, stopNodeDrag, undo, redo, getHistoryDepth } =
        useTreeStore.getState();
      const initialPos = useTreeStore.getState().nodes.find((n) => n.id === 'rule-finra-2210')!.position;

      startNodeDrag();
      // Simulate continuous intermediate positions
      for (let offset = 10; offset <= 50; offset += 10) {
        const nextNodes = useTreeStore.getState().nodes.map((n) =>
          n.id === 'rule-finra-2210' ? { ...n, position: { x: initialPos.x + offset, y: initialPos.y + offset } } : n
        );
        setNodes(nextNodes);
      }
      stopNodeDrag();

      expect(getHistoryDepth().past).toBe(1);
      const finalPos = useTreeStore.getState().nodes.find((n) => n.id === 'rule-finra-2210')!.position;
      expect(finalPos).toEqual({ x: initialPos.x + 50, y: initialPos.y + 50 });

      undo();
      const restoredPos = useTreeStore.getState().nodes.find((n) => n.id === 'rule-finra-2210')!.position;
      expect(restoredPos).toEqual(initialPos);

      redo();
      const redonePos = useTreeStore.getState().nodes.find((n) => n.id === 'rule-finra-2210')!.position;
      expect(redonePos).toEqual({ x: initialPos.x + 50, y: initialPos.y + 50 });
    });

    it('creates zero history entries if node was dropped at its original baseline position', () => {
      const { startNodeDrag, setNodes, stopNodeDrag, getHistoryDepth } = useTreeStore.getState();
      const initialPos = useTreeStore.getState().nodes.find((n) => n.id === 'rule-finra-2210')!.position;

      startNodeDrag();
      // Drag away
      setNodes(
        useTreeStore.getState().nodes.map((n) =>
          n.id === 'rule-finra-2210' ? { ...n, position: { x: initialPos.x + 100, y: initialPos.y + 100 } } : n
        )
      );
      // Put back to baseline before dropping
      setNodes(
        useTreeStore.getState().nodes.map((n) =>
          n.id === 'rule-finra-2210' ? { ...n, position: { ...initialPos } } : n
        )
      );
      stopNodeDrag();

      expect(getHistoryDepth().past).toBe(0);
    });

    it('creates zero history entries and restores coordinates on canceled drag', () => {
      const { startNodeDrag, setNodes, cancelNodeDrag, getHistoryDepth } = useTreeStore.getState();
      const initialPos = useTreeStore.getState().nodes.find((n) => n.id === 'rule-finra-2210')!.position;

      startNodeDrag();
      setNodes(
        useTreeStore.getState().nodes.map((n) =>
          n.id === 'rule-finra-2210' ? { ...n, position: { x: 888, y: 888 } } : n
        )
      );
      cancelNodeDrag();

      expect(getHistoryDepth().past).toBe(0);
      const restored = useTreeStore.getState().nodes.find((n) => n.id === 'rule-finra-2210')!.position;
      expect(restored).toEqual(initialPos);
    });

    it('creates exactly one history entry for multi-node group drag and restores all nodes atomically', () => {
      const { startNodeDrag, setNodes, stopNodeDrag, undo, getHistoryDepth } =
        useTreeStore.getState();
      const initialA = useTreeStore.getState().nodes.find((n) => n.id === 'rule-finra-2210')!.position;
      const initialB = useTreeStore.getState().nodes.find((n) => n.id === 'cond-finra-2210')!.position;

      startNodeDrag();
      const groupMoved = useTreeStore.getState().nodes.map((n) => {
        if (n.id === 'rule-finra-2210' || n.id === 'cond-finra-2210') {
          return { ...n, position: { x: n.position.x + 60, y: n.position.y + 60 } };
        }
        return n;
      });
      setNodes(groupMoved);
      stopNodeDrag();

      expect(getHistoryDepth().past).toBe(1);

      undo();
      const posA = useTreeStore.getState().nodes.find((n) => n.id === 'rule-finra-2210')!.position;
      const posB = useTreeStore.getState().nodes.find((n) => n.id === 'cond-finra-2210')!.position;
      expect(posA).toEqual(initialA);
      expect(posB).toEqual(initialB);
    });
  });

  describe('4. Redo-Branch Invalidation & Baseline Reset', () => {
    it('invalidates future redo branch when a new operation is executed after undo', () => {
      const { createNode, undo, getHistoryDepth } = useTreeStore.getState();
      createNode('rule', { x: 10, y: 10 });
      createNode('action', { x: 20, y: 20 });
      expect(getHistoryDepth().past).toBe(2);

      undo();
      expect(getHistoryDepth().past).toBe(1);
      expect(getHistoryDepth().future).toBe(1);

      // Perform new action while in undo branch
      createNode('condition', { x: 30, y: 30 });
      expect(getHistoryDepth().past).toBe(2);
      expect(getHistoryDepth().future).toBe(0); // Redo branch cleared!
    });

    it('loadSampleTree clears all past and future history and establishes a new zero-baseline', () => {
      const { createNode, undo, loadSampleTree, getHistoryDepth } = useTreeStore.getState();
      createNode('rule', { x: 10, y: 10 });
      createNode('action', { x: 20, y: 20 });
      undo();
      expect(getHistoryDepth().past).toBe(1);
      expect(getHistoryDepth().future).toBe(1);

      loadSampleTree();
      expect(getHistoryDepth().past).toBe(0);
      expect(getHistoryDepth().future).toBe(0);
    });

    it('supports rapid consecutive undo and redo without dropping states', () => {
      const { createNode, undo, redo, getHistoryDepth } = useTreeStore.getState();
      for (let i = 0; i < 5; i++) {
        createNode('action', { x: i * 50, y: i * 50 });
      }
      expect(getHistoryDepth().past).toBe(5);

      // Rapid undo
      undo();
      undo();
      undo();
      expect(getHistoryDepth().past).toBe(2);
      expect(getHistoryDepth().future).toBe(3);

      // Rapid redo
      redo();
      redo();
      redo();
      expect(getHistoryDepth().past).toBe(5);
      expect(getHistoryDepth().future).toBe(0);
    });
  });

  describe('5. Keyboard Safety for Undo and Redo', () => {
    it('preserves native text undo by returning "ignore" when typing in inputs or textareas', () => {
      const targetInput: ElementLike = { tagName: 'input' };
      const ctxInput = {
        key: 'z',
        ctrlKey: true,
        target: targetInput,
      };
      expect(resolveUndoRedoAction(ctxInput)).toBe('ignore');

      const targetTextarea: ElementLike = { tagName: 'textarea' };
      const ctxTextarea = {
        key: 'z',
        metaKey: true,
        target: targetTextarea,
      };
      expect(resolveUndoRedoAction(ctxTextarea)).toBe('ignore');

      const targetNoKey: ElementLike = { closest: (s: string) => (s === '.nokey' ? {} : null) };
      const ctxNoKey = {
        key: 'z',
        ctrlKey: true,
        target: targetNoKey,
      };
      expect(resolveUndoRedoAction(ctxNoKey)).toBe('ignore');
    });

    it('resolves Ctrl+Z and Cmd+Z on canvas as "undo"', () => {
      const canvasTarget: ElementLike = { tagName: 'div' };
      expect(resolveUndoRedoAction({ key: 'z', ctrlKey: true, target: canvasTarget })).toBe(
        'undo'
      );
      expect(resolveUndoRedoAction({ key: 'Z', metaKey: true, target: canvasTarget })).toBe(
        'undo'
      );
    });

    it('resolves Ctrl+Shift+Z, Cmd+Shift+Z, and Ctrl+Y on canvas as "redo"', () => {
      const canvasTarget: ElementLike = { tagName: 'div' };
      expect(
        resolveUndoRedoAction({
          key: 'z',
          ctrlKey: true,
          shiftKey: true,
          target: canvasTarget,
        })
      ).toBe('redo');
      expect(
        resolveUndoRedoAction({
          key: 'Z',
          metaKey: true,
          shiftKey: true,
          target: canvasTarget,
        })
      ).toBe('redo');
      expect(resolveUndoRedoAction({ key: 'y', ctrlKey: true, target: canvasTarget })).toBe(
        'redo'
      );
    });
  });

  describe('6. Regression: Sidebar Palette Node Drop & Undo Flow', () => {
    it('creates exactly one history entry when dropping a new node, even after React Flow measures dimensions', () => {
      const { createNode, setNodes, undo, redo, getHistoryDepth } = useTreeStore.getState();
      const initialNodeCount = useTreeStore.getState().nodes.length;
      expect(getHistoryDepth().past).toBe(0);

      // 1. Drop new node onto canvas
      const droppedNode = createNode('rule', { x: 450, y: 350 });
      expect(droppedNode).toBeDefined();
      expect(getHistoryDepth().past).toBe(1);

      // 2. React Flow mounts and dispatches dimensions measurement
      const dimensionChanges = [
        {
          type: 'dimensions' as const,
          id: droppedNode!.id,
          dimensions: { width: 280, height: 110 },
          resizing: false,
        },
      ];
      const updatedNodes = applyNodeChanges(dimensionChanges, useTreeStore.getState().nodes) as TreeNode[];
      setNodes(updatedNodes);

      // Semantic equality must prevent extra history entry from DOM measurement!
      expect(getHistoryDepth().past).toBe(1);

      // 3. Press Undo ONCE: the newly dropped node MUST be removed from canvas and nodes array!
      undo();
      expect(useTreeStore.getState().nodes.length).toBe(initialNodeCount);
      expect(useTreeStore.getState().nodes.some((n) => n.id === droppedNode!.id)).toBe(false);
      expect(useTreeStore.getState().selectedNodeId).toBeNull();
      expect(getHistoryDepth().future).toBe(1);

      // 4. Press Redo: the node is restored with exact ID, drop coordinates, and data
      redo();
      expect(useTreeStore.getState().nodes.length).toBe(initialNodeCount + 1);
      const restored = useTreeStore.getState().nodes.find((n) => n.id === droppedNode!.id);
      expect(restored).toBeDefined();
      expect(restored?.id).toBe(droppedNode!.id);
      expect(restored?.position).toEqual({ x: 450, y: 350 });
      expect(restored?.type).toBe('rule');
    });

    it('creates no node and zero history entries on invalid or canceled drop', () => {
      const { createNode, getHistoryDepth } = useTreeStore.getState();
      const initialNodeCount = useTreeStore.getState().nodes.length;

      // Invalid node type
      const invalidType = createNode('invalid-type' as unknown as NodeType, { x: 100, y: 100 });
      expect(invalidType).toBeNull();

      // Invalid coordinates
      const invalidCoords = createNode('rule', { x: NaN, y: Infinity });
      expect(invalidCoords).toBeNull();

      expect(useTreeStore.getState().nodes.length).toBe(initialNodeCount);
      expect(getHistoryDepth().past).toBe(0);
    });

    it('invalidates the old Redo branch when creating a node, undoing, then creating another node', () => {
      const { createNode, undo, getHistoryDepth } = useTreeStore.getState();

      const nodeA = createNode('rule', { x: 100, y: 100 });
      expect(nodeA).toBeDefined();
      expect(getHistoryDepth().past).toBe(1);

      undo();
      expect(getHistoryDepth().past).toBe(0);
      expect(getHistoryDepth().future).toBe(1);

      // Create another node on a new branch
      const nodeB = createNode('action', { x: 200, y: 200 });
      expect(nodeB).toBeDefined();
      expect(getHistoryDepth().past).toBe(1);
      expect(getHistoryDepth().future).toBe(0); // Old Redo branch wiped!
    });

    it('confirms that moving an existing node and undoing it still restores its previous position', () => {
      const { startNodeDrag, setNodes, stopNodeDrag, undo, redo, getHistoryDepth } =
        useTreeStore.getState();
      const targetNode = useTreeStore.getState().nodes.find((n) => n.id === 'rule-finra-2210')!;
      const originalPos = { ...targetNode.position };

      // Drag existing node to a new location
      startNodeDrag();
      const movedNodes = useTreeStore.getState().nodes.map((n) =>
        n.id === targetNode.id ? { ...n, position: { x: originalPos.x + 120, y: originalPos.y + 80 } } : n
      );
      setNodes(movedNodes);
      stopNodeDrag();

      expect(getHistoryDepth().past).toBe(1);
      expect(
        useTreeStore.getState().nodes.find((n) => n.id === targetNode.id)!.position
      ).toEqual({ x: originalPos.x + 120, y: originalPos.y + 80 });

      // Undo restores original position
      undo();
      expect(
        useTreeStore.getState().nodes.find((n) => n.id === targetNode.id)!.position
      ).toEqual(originalPos);

      // Redo restores dragged position
      redo();
      expect(
        useTreeStore.getState().nodes.find((n) => n.id === targetNode.id)!.position
      ).toEqual({ x: originalPos.x + 120, y: originalPos.y + 80 });
    });
  });
});
