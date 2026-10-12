import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateAutoLayout,
  autoLayout,
  resolveNodeDimensions,
  LAYOUT_DEFAULTS,
  type AutoLayoutResult,
} from '../lib/autoLayout';
import type { TreeNode, TreeEdge } from '../types/tree';
import { useTreeStore } from '../store/treeStore';
import { buildLargeTree } from './helpers/treeBuilders';
import { getCachedSearchNodes } from '../lib/search';

describe('Day 10: Hierarchical Auto-Layout Engine (`src/lib/autoLayout.ts`)', () => {
  // Sample valid small tree fixture
  const createSmallTree = (): { nodes: TreeNode[]; edges: TreeEdge[] } => {
    const nodes: TreeNode[] = [
      {
        id: 'root-1',
        type: 'root',
        position: { x: 400, y: 50 },
        data: { label: 'Policy Root', ruleId: 'ROOT-01' },
      },
      {
        id: 'rule-1',
        type: 'rule',
        position: { x: 200, y: 200 },
        data: { label: 'Rule One', ruleId: 'R-01' },
      },
      {
        id: 'rule-2',
        type: 'rule',
        position: { x: 600, y: 200 },
        data: { label: 'Rule Two', ruleId: 'R-02' },
      },
      {
        id: 'cond-1',
        type: 'condition',
        position: { x: 200, y: 350 },
        data: { label: 'Condition One', ruleId: 'C-01' },
      },
      {
        id: 'act-1',
        type: 'action',
        position: { x: 200, y: 500 },
        data: { label: 'Action One', ruleId: 'A-01' },
      },
    ];

    const edges: TreeEdge[] = [
      { id: 'e-root-r1', source: 'root-1', target: 'rule-1', type: 'smoothstep' },
      { id: 'e-root-r2', source: 'root-1', target: 'rule-2', type: 'smoothstep' },
      { id: 'e-r1-c1', source: 'rule-1', target: 'cond-1', type: 'smoothstep' },
      { id: 'e-c1-a1', source: 'cond-1', target: 'act-1', type: 'smoothstep' },
    ];

    return { nodes, edges };
  };

  describe('1. Pure Layout Engine Core Requirements', () => {
    it('handles empty graph cleanly with safe no-op and zero metrics', () => {
      const result = calculateAutoLayout([], []);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.positions).toEqual({});
        expect(result.hasMoved).toBe(false);
        expect(result.metrics.nodeCount).toBe(0);
        expect(result.metrics.movedCount).toBe(0);
        expect(result.metrics.ranksCount).toBe(0);
        expect(result.metrics.overlapCount).toBe(0);
      }
    });

    it('positions a single-node graph with valid finite coordinates', () => {
      const singleNode: TreeNode = {
        id: 'single-1',
        type: 'root',
        position: { x: 100, y: 100 },
        data: { label: 'Solo Root' },
      };

      const result = calculateAutoLayout([singleNode], []);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.positions['single-1']).toBeDefined();
        expect(Number.isFinite(result.positions['single-1'].x)).toBe(true);
        expect(Number.isFinite(result.positions['single-1'].y)).toBe(true);
        expect(result.metrics.nodeCount).toBe(1);
        expect(result.metrics.ranksCount).toBe(1);
        expect(result.metrics.maxNodesPerRank).toBe(1);
        expect(result.metrics.overlapCount).toBe(0);
      }
    });

    it('arranges small valid tree and preserves all node identities without mutation', () => {
      const { nodes, edges } = createSmallTree();
      const nodesClone = JSON.parse(JSON.stringify(nodes));
      const edgesClone = JSON.parse(JSON.stringify(edges));

      const result = calculateAutoLayout(nodes, edges);
      expect(result.ok).toBe(true);

      // Verify zero mutation of inputs
      expect(nodes).toEqual(nodesClone);
      expect(edges).toEqual(edgesClone);

      if (result.ok) {
        expect(Object.keys(result.positions).length).toBe(nodes.length);
        for (const node of nodes) {
          expect(result.positions[node.id]).toBeDefined();
          expect(Number.isFinite(result.positions[node.id].x)).toBe(true);
          expect(Number.isFinite(result.positions[node.id].y)).toBe(true);
        }
      }
    });

    it('lays out a deep linear tree where every parent is vertically above its child', () => {
      const nodes: TreeNode[] = [
        { id: 'n1', type: 'root', position: { x: 0, y: 0 }, data: { label: 'N1' } },
        { id: 'n2', type: 'rule', position: { x: 0, y: 0 }, data: { label: 'N2' } },
        { id: 'n3', type: 'condition', position: { x: 0, y: 0 }, data: { label: 'N3' } },
        { id: 'n4', type: 'action', position: { x: 0, y: 0 }, data: { label: 'N4' } },
      ];
      const edges: TreeEdge[] = [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
        { id: 'e3', source: 'n3', target: 'n4' },
      ];

      const result = calculateAutoLayout(nodes, edges);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const p1 = result.positions['n1'];
        const p2 = result.positions['n2'];
        const p3 = result.positions['n3'];
        const p4 = result.positions['n4'];

        // Strictly downward top-to-bottom order: y1 < y2 < y3 < y4
        expect(p1.y).toBeLessThan(p2.y);
        expect(p2.y).toBeLessThan(p3.y);
        expect(p3.y).toBeLessThan(p4.y);
        expect(result.metrics.ranksCount).toBeGreaterThanOrEqual(4);
      }
    });

    it('lays out a wide tree with multiple siblings occupying the same rank without horizontal overlap', () => {
      const siblingCount = 5;
      const nodes: TreeNode[] = [
        { id: 'root', type: 'root', position: { x: 0, y: 0 }, data: { label: 'Root' } },
      ];
      const edges: TreeEdge[] = [];

      for (let i = 1; i <= siblingCount; i++) {
        const id = `sibling-${i}`;
        nodes.push({ id, type: 'rule', position: { x: 0, y: 0 }, data: { label: `Rule ${i}` } });
        edges.push({ id: `e-${i}`, source: 'root', target: id });
      }

      const result = calculateAutoLayout(nodes, edges);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.metrics.overlapCount).toBe(0);
        // All siblings should have the exact same y coordinate in a balanced wide tree
        const siblingYs = new Set(
          nodes.slice(1).map((n) => result.positions[n.id].y)
        );
        expect(siblingYs.size).toBe(1);

        // All siblings must have distinct x coordinates
        const siblingXs = new Set(
          nodes.slice(1).map((n) => result.positions[n.id].x)
        );
        expect(siblingXs.size).toBe(siblingCount);
      }
    });

    it('handles multiple roots and disconnected components cleanly without artificial links', () => {
      const nodes: TreeNode[] = [
        { id: 'root-a', type: 'root', position: { x: 0, y: 0 }, data: { label: 'Root A' } },
        { id: 'child-a', type: 'rule', position: { x: 0, y: 0 }, data: { label: 'Child A' } },
        { id: 'root-b', type: 'root', position: { x: 0, y: 0 }, data: { label: 'Root B' } },
        { id: 'child-b', type: 'rule', position: { x: 0, y: 0 }, data: { label: 'Child B' } },
        { id: 'orphan-1', type: 'rule', position: { x: 0, y: 0 }, data: { label: 'Isolated' } },
      ];
      const edges: TreeEdge[] = [
        { id: 'ea', source: 'root-a', target: 'child-a' },
        { id: 'eb', source: 'root-b', target: 'child-b' },
      ];

      const result = calculateAutoLayout(nodes, edges);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(Object.keys(result.positions).length).toBe(5);
        expect(result.metrics.overlapCount).toBe(0);
        // Every node receives valid coordinates
        for (const node of nodes) {
          expect(Number.isFinite(result.positions[node.id].x)).toBe(true);
          expect(Number.isFinite(result.positions[node.id].y)).toBe(true);
        }
      }
    });

    it('handles newly added nodes with arbitrary generated IDs', () => {
      const randomId1 = `node_rule_${Date.now()}_abc`;
      const randomId2 = `node_cond_${Date.now()}_xyz`;
      const nodes: TreeNode[] = [
        { id: randomId1, type: 'rule', position: { x: 0, y: 0 }, data: { label: 'Dynamic Rule' } },
        { id: randomId2, type: 'condition', position: { x: 0, y: 0 }, data: { label: 'Dynamic Cond' } },
      ];
      const edges: TreeEdge[] = [
        { id: 'dyn-edge', source: randomId1, target: randomId2 },
      ];

      const result = calculateAutoLayout(nodes, edges);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.positions[randomId1]).toBeDefined();
        expect(result.positions[randomId2]).toBeDefined();
        expect(result.positions[randomId1].y).toBeLessThan(result.positions[randomId2].y);
      }
    });

    it('guarantees idempotence: running layout twice produces identical positions', () => {
      const { nodes, edges } = createSmallTree();
      const firstRun = calculateAutoLayout(nodes, edges);
      expect(firstRun.ok).toBe(true);

      if (firstRun.ok) {
        // Apply positions to nodes for the second run
        const positionedNodes: TreeNode[] = nodes.map((n) => ({
          ...n,
          position: firstRun.positions[n.id],
        }));

        const secondRun = calculateAutoLayout(positionedNodes, edges);
        expect(secondRun.ok).toBe(true);
        if (secondRun.ok) {
          expect(secondRun.positions).toEqual(firstRun.positions);
          // When positions are already applied, hasMoved must be false
          expect(secondRun.hasMoved).toBe(false);
          expect(secondRun.metrics.movedCount).toBe(0);
        }
      }
    });

    it('guarantees independence from old positions: different initial positions produce identical results', () => {
      const { nodes, edges } = createSmallTree();
      const layoutA = calculateAutoLayout(nodes, edges);

      // Create identical graph with chaotic scattered positions
      const scrambledNodes: TreeNode[] = nodes.map((n, i) => ({
        ...n,
        position: { x: i * 999 - 500, y: -i * 777 + 200 },
      }));
      const layoutB = calculateAutoLayout(scrambledNodes, edges);

      expect(layoutA.ok).toBe(true);
      expect(layoutB.ok).toBe(true);
      if (layoutA.ok && layoutB.ok) {
        expect(layoutB.positions).toEqual(layoutA.positions);
      }
    });

    it('safely handles cycles and self-loops without crashing and produces finite coordinates', () => {
      const nodes: TreeNode[] = [
        { id: 'cycle-1', type: 'rule', position: { x: 0, y: 0 }, data: { label: 'C1' } },
        { id: 'cycle-2', type: 'condition', position: { x: 0, y: 0 }, data: { label: 'C2' } },
      ];
      // Mutual cycle + self-loop
      const edges: TreeEdge[] = [
        { id: 'e-1-2', source: 'cycle-1', target: 'cycle-2' },
        { id: 'e-2-1', source: 'cycle-2', target: 'cycle-1' },
        { id: 'e-self', source: 'cycle-1', target: 'cycle-1' },
      ];

      const result = calculateAutoLayout(nodes, edges);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(Number.isFinite(result.positions['cycle-1'].x)).toBe(true);
        expect(Number.isFinite(result.positions['cycle-1'].y)).toBe(true);
        expect(Number.isFinite(result.positions['cycle-2'].x)).toBe(true);
        expect(Number.isFinite(result.positions['cycle-2'].y)).toBe(true);
      }
    });

    it('safely ignores edges with missing endpoints in the temporary layout without altering real graph', () => {
      const nodes: TreeNode[] = [
        { id: 'valid-1', type: 'rule', position: { x: 0, y: 0 }, data: { label: 'V1' } },
        { id: 'valid-2', type: 'rule', position: { x: 0, y: 0 }, data: { label: 'V2' } },
      ];
      const edges: TreeEdge[] = [
        { id: 'e-valid', source: 'valid-1', target: 'valid-2' },
        { id: 'e-missing-source', source: 'ghost-source', target: 'valid-1' },
        { id: 'e-missing-target', source: 'valid-2', target: 'ghost-target' },
      ];

      const result = calculateAutoLayout(nodes, edges);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.positions['valid-1']).toBeDefined();
        expect(result.positions['valid-2']).toBeDefined();
      }
    });

    it('safely handles parallel edges in temporary multigraph', () => {
      const nodes: TreeNode[] = [
        { id: 'p1', type: 'root', position: { x: 0, y: 0 }, data: { label: 'P1' } },
        { id: 'p2', type: 'rule', position: { x: 0, y: 0 }, data: { label: 'P2' } },
      ];
      const edges: TreeEdge[] = [
        { id: 'e-par-1', source: 'p1', target: 'p2' },
        { id: 'e-par-2', source: 'p1', target: 'p2' },
      ];

      const result = calculateAutoLayout(nodes, edges);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.positions['p1'].y).toBeLessThan(result.positions['p2'].y);
      }
    });

    it('rejects input with duplicate node IDs with a clear typed failure', () => {
      const duplicateNodes: TreeNode[] = [
        { id: 'dup-1', type: 'root', position: { x: 0, y: 0 }, data: { label: 'A' } },
        { id: 'dup-1', type: 'rule', position: { x: 0, y: 0 }, data: { label: 'B' } },
      ];

      const result = calculateAutoLayout(duplicateNodes, []);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain('Duplicate node ID');
      }
    });

    it('rejects input with invalid or non-finite node dimensions', () => {
      const invalidNode: TreeNode = {
        id: 'bad-dim',
        type: 'root',
        position: { x: 0, y: 0 },
        width: -50, // Invalid negative width
        data: { label: 'Bad' },
      };

      const result = calculateAutoLayout([invalidNode], []);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain('Invalid node dimensions');
      }
    });

    it('accurately calculates metrics matching real coordinates and dimensions', () => {
      const { nodes, edges } = createSmallTree();
      const result = calculateAutoLayout(nodes, edges);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const { metrics, positions } = result;
        expect(metrics.nodeCount).toBe(5);
        expect(metrics.overlapCount).toBe(0);
        expect(metrics.ranksCount).toBeGreaterThanOrEqual(3);
        expect(metrics.maxNodesPerRank).toBeGreaterThanOrEqual(2);

        // Verify bounding box matches min/max of calculated positions
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const n of nodes) {
          const pos = positions[n.id];
          const dims = resolveNodeDimensions(n);
          minX = Math.min(minX, pos.x);
          minY = Math.min(minY, pos.y);
          maxX = Math.max(maxX, pos.x + dims.width);
          maxY = Math.max(maxY, pos.y + dims.height);
        }

        expect(metrics.boundingBox.minX).toBe(minX);
        expect(metrics.boundingBox.minY).toBe(minY);
        expect(metrics.boundingBox.maxX).toBe(maxX);
        expect(metrics.boundingBox.maxY).toBe(maxY);
        expect(metrics.boundingBox.width).toBe(maxX - minX);
        expect(metrics.boundingBox.height).toBe(maxY - minY);
      }
    });
  });

  describe('2. Large-Graph Benchmark Test (`buildLargeTree(500)`)', () => {
    it('successfully positions a 500-node graph with zero overlaps and finite coordinates', () => {
      const { nodes, edges } = buildLargeTree(500);
      expect(nodes.length).toBe(500);
      expect(edges.length).toBe(499);

      const result = calculateAutoLayout(nodes, edges);
      expect(result.ok).toBe(true);

      if (result.ok) {
        expect(Object.keys(result.positions).length).toBe(500);
        expect(result.metrics.nodeCount).toBe(500);
        expect(result.metrics.overlapCount).toBe(0);

        // Every coordinate must be an integer and finite
        for (const node of nodes) {
          const pos = result.positions[node.id];
          expect(pos).toBeDefined();
          expect(Number.isFinite(pos.x)).toBe(true);
          expect(Number.isFinite(pos.y)).toBe(true);
          expect(Number.isInteger(pos.x)).toBe(true);
          expect(Number.isInteger(pos.y)).toBe(true);
        }

        // Apex root (node-0) must be at the top level
        const rootY = result.positions['node-0'].y;
        for (let i = 1; i < 500; i++) {
          expect(result.positions[`node-${i}`].y).toBeGreaterThan(rootY);
        }
      }
    });
  });

  describe('3. Store Integration and Single-Step Undo/Redo', () => {
    beforeEach(() => {
      useTreeStore.getState().resetToSampleData();
    });

    it('creates exactly ONE history entry for layout that moves nodes', () => {
      const store = useTreeStore.getState();
      // Scramble node positions to guarantee moves
      const scrambledNodes = store.nodes.map((n, i) => ({
        ...n,
        position: { x: i * 50, y: i * 50 },
      }));
      useTreeStore.setState({ nodes: scrambledNodes });
      useTreeStore.temporal.getState().clear();

      expect(useTreeStore.temporal.getState().pastStates.length).toBe(0);

      const layoutResult = useTreeStore.getState().applyAutoLayout();
      expect(layoutResult.ok).toBe(true);
      expect(layoutResult.noop).toBe(false);

      // Must produce exactly 1 history entry
      expect(useTreeStore.temporal.getState().pastStates.length).toBe(1);
    });

    it('restores all original node positions in ONE single Undo step', () => {
      const store = useTreeStore.getState();
      const originalPositions = store.nodes.map((n) => ({ id: n.id, ...n.position }));

      // Scramble positions and baseline history
      const scrambledNodes = store.nodes.map((n, i) => ({
        ...n,
        position: { x: (i + 1) * 300, y: (i + 1) * 200 },
      }));
      useTreeStore.setState({ nodes: scrambledNodes });
      const baselinePositions = scrambledNodes.map((n) => ({ id: n.id, ...n.position }));
      useTreeStore.temporal.getState().clear();

      // Apply layout
      const result = useTreeStore.getState().applyAutoLayout();
      expect(result.ok).toBe(true);
      expect(useTreeStore.temporal.getState().pastStates.length).toBe(1);

      // Undo once
      useTreeStore.getState().undo();
      expect(useTreeStore.temporal.getState().pastStates.length).toBe(0);

      // All node positions must be restored to baseline
      const currentNodes = useTreeStore.getState().nodes;
      for (const b of baselinePositions) {
        const curr = currentNodes.find((n) => n.id === b.id);
        expect(curr?.position.x).toBe(b.x);
        expect(curr?.position.y).toBe(b.y);
      }
    });

    it('re-applies complete layout in ONE single Redo step', () => {
      // Scramble positions
      const store = useTreeStore.getState();
      const scrambledNodes = store.nodes.map((n, i) => ({
        ...n,
        position: { x: i * 80, y: i * 80 },
      }));
      useTreeStore.setState({ nodes: scrambledNodes });
      useTreeStore.temporal.getState().clear();

      useTreeStore.getState().applyAutoLayout();
      const layoutPositions = useTreeStore.getState().nodes.map((n) => ({ id: n.id, ...n.position }));

      // Undo
      useTreeStore.getState().undo();
      expect(useTreeStore.temporal.getState().pastStates.length).toBe(0);

      // Redo
      useTreeStore.getState().redo();
      expect(useTreeStore.temporal.getState().pastStates.length).toBe(1);

      const currentNodes = useTreeStore.getState().nodes;
      for (const lp of layoutPositions) {
        const curr = currentNodes.find((n) => n.id === lp.id);
        expect(curr?.position.x).toBe(lp.x);
        expect(curr?.position.y).toBe(lp.y);
      }
    });

    it('creates zero history entries when layout is a no-op (already arranged)', () => {
      // Run layout once to settle
      useTreeStore.getState().applyAutoLayout();
      useTreeStore.temporal.getState().clear();
      expect(useTreeStore.temporal.getState().pastStates.length).toBe(0);

      // Second click on already-arranged graph
      const secondResult = useTreeStore.getState().applyAutoLayout();
      expect(secondResult.ok).toBe(true);
      expect(secondResult.noop).toBe(true);
      expect(secondResult.message).toBe('Already arranged.');

      // Must remain 0 past states
      expect(useTreeStore.temporal.getState().pastStates.length).toBe(0);
    });

    it('preserves node IDs, node types, node data payloads, and edge data strictly', () => {
      const store = useTreeStore.getState();
      const preNodes = store.nodes;
      const preEdges = store.edges;

      useTreeStore.getState().applyAutoLayout();

      const postNodes = useTreeStore.getState().nodes;
      const postEdges = useTreeStore.getState().edges;

      expect(postNodes.length).toBe(preNodes.length);
      expect(postEdges.length).toBe(preEdges.length);

      for (let i = 0; i < preNodes.length; i++) {
        expect(postNodes[i].id).toBe(preNodes[i].id);
        expect(postNodes[i].type).toBe(preNodes[i].type);
        // Node data reference must remain identical
        expect(postNodes[i].data).toBe(preNodes[i].data);
      }

      for (let i = 0; i < preEdges.length; i++) {
        expect(postEdges[i]).toBe(preEdges[i]);
      }
    });

    it('preserves selection and inspector state during auto-layout', () => {
      const targetNodeId = 'rule-finra-2210';
      useTreeStore.getState().setSelectedNodeId(targetNodeId);

      expect(useTreeStore.getState().selectedNodeId).toBe(targetNodeId);

      useTreeStore.getState().applyAutoLayout();

      expect(useTreeStore.getState().selectedNodeId).toBe(targetNodeId);
    });

    it('preserves Day 9 search cache stability after position-only layout update', () => {
      const initialNodes = useTreeStore.getState().nodes;
      const query = 'finra';

      // First search invocation primes cache
      const searchResults1 = getCachedSearchNodes(initialNodes, query);
      expect(searchResults1.length).toBeGreaterThan(0);

      // Apply auto-layout (changes positions only, preserves node data references)
      useTreeStore.getState().applyAutoLayout();
      const updatedNodes = useTreeStore.getState().nodes;

      // Second search invocation with new nodes array
      const searchResults2 = getCachedSearchNodes(updatedNodes, query);

      // Fast-path cache contract: exact array reference equality preserved
      expect(searchResults2).toBe(searchResults1);
      // Results contain updated node instances with new positions
      const matchedNode = searchResults2[0].node;
      const storeNode = updatedNodes.find((n) => n.id === matchedNode.id);
      expect(matchedNode.position).toEqual(storeNode?.position);
    });
  });
});
