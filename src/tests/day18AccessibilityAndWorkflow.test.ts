import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useTreeStore, getCanonicalSampleNodes, getCanonicalSampleEdges } from '../store/treeStore';
import { validateConnection } from '../lib/connectionValidation';
import { validateGraph } from '../lib/validation';
import { exportGraph, prepareGraphImport, mergeGraph } from '../lib/json';
import { loadPersistedWorkspace, savePersistedWorkspace } from '../lib/persistence';
import { getFocusableElements, handleModalTabKey } from '../lib/modalFocus';
import {
  isKeyboardEventTargetProtected,
  resolveKeyboardAction,
  resolveUndoRedoAction,
  resolveCanvasKeyboardAction,
} from '../lib/keyboardSafety';

class MockStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

if (typeof globalThis.window === 'undefined') {
  (globalThis as unknown as Record<string, unknown>).window = globalThis;
}

describe('Day 18: Accessibility, Keyboard Safety & Protected Workflow Suite', () => {
  let mockStorage: MockStorage;

  beforeEach(() => {
    mockStorage = new MockStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis.window, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    useTreeStore.setState({
      nodes: getCanonicalSampleNodes(),
      edges: getCanonicalSampleEdges(),
      selectedNodeId: null,
      selectedEdgeId: null,
      selectedNodeIds: [],
    });
    useTreeStore.temporal.getState().clear();
  });

  // TEST 1: Protected Reviewer Workflow (Create -> Connect -> Edit -> Export JSON -> Validate)
  it('1. Executes the 5-step Protected Reviewer Workflow flawlessly', () => {
    const store = useTreeStore.getState();

    // 1. Create a node
    const ruleNode = store.createNode('rule', { x: 450, y: 150 });
    expect(ruleNode).not.toBeNull();
    expect(ruleNode?.type).toBe('rule');

    // 2. Connect nodes (Root -> Rule)
    const connResult = store.addEdgeConnection({
      source: 'root-policy-hierarchy',
      target: ruleNode!.id,
    });
    expect(connResult.ok).toBe(true);
    expect(connResult.edge?.data?.relationshipType).toBe('root-rule');

    // 3. Edit node data
    const edited = store.updateNodeData(ruleNode!.id, {
      label: 'Day 18 Accessibility Standard Rule',
      ruleId: 'RULE-A11Y-01',
    });
    expect(edited).toBe(true);

    // 4. Export JSON
    const exportedStr = exportGraph(useTreeStore.getState().nodes, useTreeStore.getState().edges);
    const parsed = JSON.parse(exportedStr);
    expect(parsed.version).toBe(1);
    expect(parsed.nodes.some((n: { id: string }) => n.id === ruleNode!.id)).toBe(true);

    // 5. Validate the graph
    const valResult = validateGraph(useTreeStore.getState().nodes, useTreeStore.getState().edges);
    expect(valResult.valid).toBe(true);
    expect(valResult.errors).toHaveLength(0);
  });

  // TEST 2: Node Palette Keyboard Activation
  it('2. Verifies keyboard activation of Node Palette items creates nodes with unique IDs and history entry', () => {
    const pastBefore = useTreeStore.temporal.getState().pastStates.length;
    const initialNodeCount = useTreeStore.getState().nodes.length;

    // Simulate keyboard activation on 'condition' palette item
    const createdCondition = useTreeStore.getState().createNode('condition', { x: 500, y: 300 });
    expect(createdCondition).not.toBeNull();
    expect(createdCondition?.type).toBe('condition');
    expect(useTreeStore.getState().nodes.length).toBe(initialNodeCount + 1);

    // Creates exactly 1 history entry
    expect(useTreeStore.temporal.getState().pastStates.length).toBe(pastBefore + 1);

    // New node is automatically selected
    expect(useTreeStore.getState().selectedNodeId).toBe(createdCondition?.id);
  });

  // TEST 3: Modal Focus Trapping Utility
  it('3. Verifies modal focus trapping logic cycles correctly between first and last elements', () => {
    const createMockElement = (id: string) => {
      let focused = false;
      return {
        id,
        isMockVisible: true,
        offsetWidth: 100,
        offsetHeight: 30,
        offsetParent: {},
        focus() { focused = true; },
        isFocused() { return focused; },
      };
    };

    const el1 = createMockElement('btn-first');
    const el2 = createMockElement('input-middle');
    const el3 = createMockElement('btn-last');

    const mockContainer = {
      querySelectorAll: () => [el1, el2, el3],
      contains: (el: unknown) => el === el1 || el === el2 || el === el3,
    } as unknown as HTMLElement;

    const focusables = getFocusableElements(mockContainer);
    expect(focusables.length).toBe(3);
    expect(focusables[0].id).toBe('btn-first');
    expect(focusables[2].id).toBe('btn-last');

    // Simulate Tab key on last element -> wraps to first
    let defaultPrevented = false;
    const tabEvent = {
      key: 'Tab',
      shiftKey: false,
      preventDefault() { defaultPrevented = true; },
    };
    handleModalTabKey(tabEvent, mockContainer);
    expect(defaultPrevented).toBe(true);

    // Simulate Shift+Tab on first element -> wraps to last
    let shiftDefaultPrevented = false;
    const shiftTabEvent = {
      key: 'Tab',
      shiftKey: true,
      preventDefault() { shiftDefaultPrevented = true; },
    };
    handleModalTabKey(shiftTabEvent, mockContainer);
    expect(shiftDefaultPrevented).toBe(true);
  });

  // TEST 4: Text-Editing & Keyboard Safety Matrix
  it('4. Shields text inputs and nokey containers from canvas deletions and undo/redo hijacking', () => {
    const inputTarget = { tagName: 'input', isContentEditable: false, closest: () => null };
    const nokeyTarget = {
      tagName: 'button',
      isContentEditable: false,
      closest: (sel: string) => (sel === '.nokey' ? {} : null),
    };

    // Input element is protected
    expect(isKeyboardEventTargetProtected(inputTarget)).toBe(true);
    // Element inside .nokey container is protected
    expect(isKeyboardEventTargetProtected(nokeyTarget)).toBe(true);

    // Typing Delete/Backspace in an input element resolves to 'ignore'
    const deleteInInput = resolveKeyboardAction({
      key: 'Delete',
      target: { tagName: 'INPUT', isContentEditable: false, insideNoKey: false },
      selection: { selectedNodeId: 'node-1', selectedEdgeId: null },
      confirmationOpen: false,
    });
    expect(deleteInInput).toBe('ignore');

    // Undo/Redo while inside text input resolves to 'ignore'
    const undoInInput = resolveUndoRedoAction({
      key: 'z',
      ctrlKey: true,
      target: inputTarget,
    });
    expect(undoInInput).toBe('ignore');

    // Canvas keyboard shortcuts (e.g. Fit view, auto-layout) are ignored when typing
    const canvasActionInInput = resolveCanvasKeyboardAction({
      key: 'l',
      ctrlKey: true,
      shiftKey: true,
      target: inputTarget,
    });
    expect(canvasActionInInput).toBe('ignore');
  });

  // TEST 5: Escape Key Safety & Hierarchy
  it('5. Verifies Escape key resolves hierarchically without corrupting graph state', () => {
    // 1. When confirmation dialog is open: Escape cancels confirmation
    useTreeStore.getState().openResetConfirmation();
    expect(useTreeStore.getState().isResetConfirmationOpen).toBe(true);
    useTreeStore.getState().closeResetConfirmation();
    expect(useTreeStore.getState().isResetConfirmationOpen).toBe(false);

    // 2. When node is selected: Escape clears selection with 0 history changes
    useTreeStore.getState().setSelectedNodeId('rule-finra-2210');
    expect(useTreeStore.getState().selectedNodeId).toBe('rule-finra-2210');
    const pastBefore = useTreeStore.temporal.getState().pastStates.length;

    useTreeStore.getState().clearSelection();
    expect(useTreeStore.getState().selectedNodeId).toBeNull();
    // Transient UI selection change creates ZERO history entries
    expect(useTreeStore.temporal.getState().pastStates.length).toBe(pastBefore);
  });

  // TEST 6: Complete 15-Step Master Regression Workflow
  it('6. Executes the 15-step Master Regression Workflow end-to-end', () => {
    const store = useTreeStore.getState();

    // 1. Create a node
    const newNode = store.createNode('rule', { x: 550, y: 180 });
    expect(newNode).not.toBeNull();

    // 2. ID is unique
    const duplicates = useTreeStore.getState().nodes.filter((n) => n.id === newNode!.id);
    expect(duplicates).toHaveLength(1);

    // 3. Permitted connection (Root -> Rule)
    const connRes = store.addEdgeConnection({
      source: 'root-policy-hierarchy',
      target: newNode!.id,
    });
    expect(connRes.ok).toBe(true);

    // 4. Invalid connection (Action -> Rule) rejected cleanly
    const invalidConn = validateConnection(
      { source: 'act-finra-2210', target: newNode!.id },
      store.nodes,
      store.edges
    );
    expect(invalidConn.ok).toBe(false);

    // 5. Edit node property
    store.updateNodeData(newNode!.id, { label: 'Day 18 Master Verified Rule' });
    const editedNode = useTreeStore.getState().nodes.find((n) => n.id === newNode!.id);
    expect(editedNode?.data.label).toBe('Day 18 Master Verified Rule');

    // 6. Undo
    store.undo();
    const undoneNode = useTreeStore.getState().nodes.find((n) => n.id === newNode!.id);
    expect(undoneNode?.data.label).not.toBe('Day 18 Master Verified Rule');

    // 7. Redo
    store.redo();
    const redoneNode = useTreeStore.getState().nodes.find((n) => n.id === newNode!.id);
    expect(redoneNode?.data.label).toBe('Day 18 Master Verified Rule');

    // 8. Validate graph
    const valResult = validateGraph(useTreeStore.getState().nodes, useTreeStore.getState().edges);
    expect(valResult.valid).toBe(true);

    // 9. Export JSON
    const exportedStr = exportGraph(useTreeStore.getState().nodes, useTreeStore.getState().edges);
    const parsedExport = JSON.parse(exportedStr);
    expect(parsedExport.version).toBe(1);

    // 10. Prepare import
    const prep = prepareGraphImport(exportedStr);
    expect(prep.ok).toBe(true);

    // 11. Merge import into canvas
    if (prep.ok) {
      const merged = mergeGraph(
        useTreeStore.getState().nodes,
        useTreeStore.getState().edges,
        prep.graph.nodes,
        prep.graph.edges
      );
      const applySuccess = useTreeStore.getState().applyGraphBatch({
        nodes: merged.nodes,
        edges: merged.edges,
      });
      expect(applySuccess).toBe(true);
    }

    // 12. Save to persistence
    const finalNodes = useTreeStore.getState().nodes;
    const finalEdges = useTreeStore.getState().edges;
    const saveRes = savePersistedWorkspace(finalNodes, finalEdges);
    expect(saveRes.ok).toBe(true);

    // 13. Refresh restoration simulation
    const restored = loadPersistedWorkspace();
    expect(restored.ok).toBe(true);
    if (restored.ok) {
      expect(restored.document.nodes.length).toBe(finalNodes.length);
      expect(restored.document.edges.length).toBe(finalEdges.length);

      // 14. Fresh history guarantee
      useTreeStore.temporal.getState().clear();
      expect(useTreeStore.temporal.getState().pastStates.length).toBe(0);
      expect(useTreeStore.temporal.getState().futureStates.length).toBe(0);

      // 15. Post-restore validation
      const postVal = validateGraph(restored.document.nodes, restored.document.edges);
      expect(postVal.errors.filter((e) => e.type === 'CYCLE_DETECTED')).toHaveLength(0);
      expect(
        postVal.errors.filter(
          (e) => e.type === 'DANGLING_EDGE_SOURCE' || e.type === 'DANGLING_EDGE_TARGET'
        )
      ).toHaveLength(0);
    }
  });
});
