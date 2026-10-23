import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useTreeStore, getCanonicalSampleNodes, getCanonicalSampleEdges } from '../store/treeStore';
import { exportGraph, prepareGraphImport, mergeGraph, getValidExampleDocument, getBrokenExampleDocument } from '../lib/json';

describe('Day 15/16 Modal & JSON Interchange Regression Suite', () => {
  beforeEach(() => {
    useTreeStore.setState({
      nodes: getCanonicalSampleNodes(),
      edges: getCanonicalSampleEdges(),
      selectedNodeId: null,
      selectedEdgeId: null,
      selectedNodeIds: [],
    });
    useTreeStore.temporal.getState().clear();
  });

  it('1. Export serialization exports current graph accurately', () => {
    const nodes = useTreeStore.getState().nodes;
    const edges = useTreeStore.getState().edges;
    const jsonStr = exportGraph(nodes, edges);

    const parsed = JSON.parse(jsonStr);
    expect(parsed.version).toBe(1);
    expect(parsed.nodes).toHaveLength(nodes.length);
    expect(parsed.edges).toHaveLength(edges.length);
  });

  it('2. Successful import updates graph and creates exactly one history entry', () => {
    // Mutate graph first so imported graph differs from current state
    useTreeStore.getState().addChild('root-policy-hierarchy', 'rule');
    const pastBeforeImport = useTreeStore.temporal.getState().pastStates.length;

    const validJson = getValidExampleDocument();
    const prep = prepareGraphImport(validJson);
    expect(prep.ok).toBe(true);

    if (prep.ok) {
      const success = useTreeStore.getState().applyGraphBatch({
        nodes: prep.graph.nodes,
        edges: prep.graph.edges,
      });
      expect(success).toBe(true);
      expect(useTreeStore.temporal.getState().pastStates.length).toBe(pastBeforeImport + 1);
    }
  });

  it('3. Invalid import keeps current graph unchanged and does not commit', () => {
    const nodeCountBefore = useTreeStore.getState().nodes.length;
    const brokenJson = getBrokenExampleDocument();
    const prep = prepareGraphImport(brokenJson);
    expect(prep.ok).toBe(false);

    expect(useTreeStore.getState().nodes.length).toBe(nodeCountBefore);
    expect(useTreeStore.temporal.getState().pastStates.length).toBe(0);
  });

  it('4. Merged import creates history entry and supports undo/redo correctly', () => {
    const initialNodeCount = useTreeStore.getState().nodes.length;
    const validJson = getValidExampleDocument();
    const prep = prepareGraphImport(validJson);
    expect(prep.ok).toBe(true);

    if (prep.ok) {
      const state = useTreeStore.getState();
      const merged = mergeGraph(state.nodes, state.edges, prep.graph.nodes, prep.graph.edges);
      const success = state.applyGraphBatch({ nodes: merged.nodes, edges: merged.edges });
      expect(success).toBe(true);
      expect(useTreeStore.getState().nodes.length).toBeGreaterThan(initialNodeCount);

      // Undo should restore initial node count
      useTreeStore.getState().undo();
      expect(useTreeStore.getState().nodes.length).toBe(initialNodeCount);

      // Redo should restore merged node count
      useTreeStore.getState().redo();
      expect(useTreeStore.getState().nodes.length).toBeGreaterThan(initialNodeCount);
    }
  });

  it('5. Replacement import creates history entry and supports undo/redo correctly', () => {
    const initialNodeCount = useTreeStore.getState().nodes.length;
    const validJson = getValidExampleDocument();
    const prep = prepareGraphImport(validJson);
    expect(prep.ok).toBe(true);

    if (prep.ok) {
      const state = useTreeStore.getState();
      const success = state.applyGraphBatch({ nodes: prep.graph.nodes, edges: prep.graph.edges });
      expect(success).toBe(true);

      // Undo should restore initial node count
      useTreeStore.getState().undo();
      expect(useTreeStore.getState().nodes.length).toBe(initialNodeCount);

      // Redo should restore imported node count
      useTreeStore.getState().redo();
      expect(useTreeStore.getState().nodes.length).toBe(prep.graph.nodes.length);
    }
  });
});
