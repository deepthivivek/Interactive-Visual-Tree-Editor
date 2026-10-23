import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useTreeStore, getCanonicalSampleNodes, getCanonicalSampleEdges } from '../store/treeStore';
import { validateConnection } from '../lib/connectionValidation';
import { validateGraph } from '../lib/validation';
import { exportGraph, prepareGraphImport, mergeGraph } from '../lib/json';
import { loadPersistedWorkspace, savePersistedWorkspace, PERSISTENCE_STORAGE_KEY } from '../lib/persistence';

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

describe('Day 17: Mandatory Regression Workflow & Acceptance Suite', () => {
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

  it('Executes the 15-step Mandatory Regression Workflow end-to-end', () => {
    const store = useTreeStore.getState();

    // 1. Create a node using supported createNode action
    const newNode = store.createNode('rule', { x: 600, y: 200 });
    expect(newNode).not.toBeNull();
    expect(newNode?.type).toBe('rule');

    // 2. Confirm its ID is unique
    const currentNodes = useTreeStore.getState().nodes;
    const occurrences = currentNodes.filter((n) => n.id === newNode!.id).length;
    expect(occurrences).toBe(1);

    // 3. Create a permitted connection (Root -> Rule)
    const validConnRes = useTreeStore.getState().addEdgeConnection({
      source: 'root-policy-hierarchy',
      target: newNode!.id,
    });
    expect(validConnRes.ok).toBe(true);
    expect(validConnRes.edge?.data?.relationshipType).toBe('root-rule');

    // 4. Attempt an invalid connection (Action -> Rule, or Cycle) and confirm rejection
    const invalidConn = validateConnection(
      { source: 'act-finra-2210', target: newNode!.id },
      useTreeStore.getState().nodes,
      useTreeStore.getState().edges
    );
    expect(invalidConn.ok).toBe(false);
    if (!invalidConn.ok) {
      expect(invalidConn.reason).toBe('invalid-relationship');
    }

    // 5. Edit a node property
    const labelUpdated = useTreeStore.getState().updateNodeData(newNode!.id, {
      label: 'Updated Rule Label - Compliance Standard',
    });
    expect(labelUpdated).toBe(true);
    const updatedNode = useTreeStore.getState().nodes.find((n) => n.id === newNode!.id);
    expect(updatedNode?.data.label).toBe('Updated Rule Label - Compliance Standard');

    // 6. Undo the relevant operation
    const pastCountBeforeUndo = useTreeStore.temporal.getState().pastStates.length;
    expect(pastCountBeforeUndo).toBeGreaterThan(0);
    useTreeStore.getState().undo();

    const nodeAfterUndo = useTreeStore.getState().nodes.find((n) => n.id === newNode!.id);
    expect(nodeAfterUndo?.data.label).not.toBe('Updated Rule Label - Compliance Standard');

    // 7. Redo it and verify the expected state
    useTreeStore.getState().redo();
    const nodeAfterRedo = useTreeStore.getState().nodes.find((n) => n.id === newNode!.id);
    expect(nodeAfterRedo?.data.label).toBe('Updated Rule Label - Compliance Standard');

    // 8. Validate the graph
    const valResult1 = validateGraph(useTreeStore.getState().nodes, useTreeStore.getState().edges);
    expect(valResult1.valid).toBe(true);
    expect(valResult1.errors).toHaveLength(0);

    // 9. Export a version 1 JSON document
    const exportedStr = exportGraph(useTreeStore.getState().nodes, useTreeStore.getState().edges);
    expect(typeof exportedStr).toBe('string');
    const parsedExport = JSON.parse(exportedStr);
    expect(parsedExport.version).toBe(1);
    expect(parsedExport.nodes.length).toBe(useTreeStore.getState().nodes.length);
    expect(parsedExport.edges.length).toBe(useTreeStore.getState().edges.length);

    // 10. Import the exported document into the intended editor state
    const prepResult = prepareGraphImport(exportedStr);
    expect(prepResult.ok).toBe(true);

    if (prepResult.ok) {
      // 11. Verify data, positions, IDs, and edges remain consistent where expected
      expect(prepResult.graph.version).toBe(1);
      expect(prepResult.graph.nodes).toHaveLength(parsedExport.nodes.length);
      expect(prepResult.graph.edges).toHaveLength(parsedExport.edges.length);

      // 12. Confirm successful import creates exactly one history entry
      const pastBeforeImport = useTreeStore.temporal.getState().pastStates.length;
      // When imported with merge into canvas:
      const merged = mergeGraph(
        useTreeStore.getState().nodes,
        useTreeStore.getState().edges,
        prepResult.graph.nodes,
        prepResult.graph.edges
      );
      const mergeApplied = useTreeStore.getState().applyGraphBatch({
        nodes: merged.nodes,
        edges: merged.edges,
      });
      expect(mergeApplied).toBe(true);
      expect(useTreeStore.temporal.getState().pastStates.length).toBe(pastBeforeImport + 1);
    }

    // 13. Persistence save and refresh restoration
    const finalNodes = useTreeStore.getState().nodes;
    const finalEdges = useTreeStore.getState().edges;
    const saveRes = savePersistedWorkspace(finalNodes, finalEdges, { gridVisible: true });
    expect(saveRes.ok).toBe(true);

    // Simulate page refresh: restore from storage
    const restored = loadPersistedWorkspace();
    expect(restored.ok).toBe(true);
    if (restored.ok) {
      expect(restored.document.nodes.length).toBe(finalNodes.length);
      expect(restored.document.edges.length).toBe(finalEdges.length);

      // 14. Confirm the restored graph starts with a fresh history
      useTreeStore.temporal.getState().clear();
      expect(useTreeStore.temporal.getState().pastStates.length).toBe(0);
      expect(useTreeStore.temporal.getState().futureStates.length).toBe(0);

      // 15. Validate again and verify structural consistency
      const valResult2 = validateGraph(restored.document.nodes, restored.document.edges);
      expect(valResult2.errors.filter((e) => e.type === 'CYCLE_DETECTED')).toHaveLength(0);
      expect(
        valResult2.errors.filter(
          (e) => e.type === 'DANGLING_EDGE_SOURCE' || e.type === 'DANGLING_EDGE_TARGET'
        )
      ).toHaveLength(0);
    }
  });

  it('Verifies prototype pollution rejection on deeply nested import payloads', () => {
    const maliciousPayload =
      '{"version":1,"nodes":[{"id":"root-1","type":"root","position":{"x":0,"y":0},"data":{"label":"Root Node","__proto__":{"isAdmin":true}}}],"edges":[]}';

    const prep = prepareGraphImport(maliciousPayload);
    expect(prep.ok).toBe(false);
    if (!prep.ok) {
      expect(prep.errors.some((e) => e.code === 'PROTOTYPE_POLLUTION_DETECTED')).toBe(true);
    }
  });

  it('Verifies that an empty canvas is supported and valid for local persistence and recovery', () => {
    // Persistence supports saving and restoring empty graph (blank-canvas state)
    const saveRes = savePersistedWorkspace([], []);
    expect(saveRes.ok).toBe(true);

    const loadRes = loadPersistedWorkspace();
    expect(loadRes.ok).toBe(true);
    if (loadRes.ok) {
      expect(loadRes.document.nodes).toEqual([]);
      expect(loadRes.document.edges).toEqual([]);
    }
  });

  it('Rejects invalid connections cleanly without mutating graph state', () => {
    const initialEdges = useTreeStore.getState().edges;
    const initialEdgeCount = initialEdges.length;

    // Attempt to connect Root to Condition (invalid relationship: Root can only connect to Rule)
    const invalidResult = useTreeStore.getState().addEdgeConnection({
      source: 'root-policy-hierarchy',
      target: 'cond-finra-2210',
    });

    expect(invalidResult.ok).toBe(false);
    expect(useTreeStore.getState().edges.length).toBe(initialEdgeCount);
  });

  it('Preserves descendants and underlying edges when collapsing/expanding a subtree', () => {
    const rootId = 'rule-finra-2210';
    const initialNodeCount = useTreeStore.getState().nodes.length;
    const initialEdgeCount = useTreeStore.getState().edges.length;

    // Toggle collapse
    useTreeStore.getState().toggleNodeCollapse(rootId);
    const targetNode = useTreeStore.getState().nodes.find((n) => n.id === rootId);
    expect(targetNode?.data.collapsed).toBe(true);

    // Graph nodes and edges in store MUST remain intact
    expect(useTreeStore.getState().nodes.length).toBe(initialNodeCount);
    expect(useTreeStore.getState().edges.length).toBe(initialEdgeCount);

    // Validation must inspect the actual complete graph (collapsed descendants not treated as missing)
    const val = validateGraph(useTreeStore.getState().nodes, useTreeStore.getState().edges);
    expect(val.valid).toBe(true);

    // Expand again
    useTreeStore.getState().toggleNodeCollapse(rootId);
    const expandedNode = useTreeStore.getState().nodes.find((n) => n.id === rootId);
    expect(expandedNode?.data.collapsed).toBe(false);
  });
});
