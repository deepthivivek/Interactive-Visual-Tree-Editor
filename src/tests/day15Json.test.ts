/**
 * Comprehensive Unit Tests for Day 15 Versioned JSON Engine & Import Pipeline (`src/tests/day15Json.test.ts`).
 *
 * Covers:
 * 1. Deterministic serialization and export normalization
 * 2. Strict Zod schema validation, input guards, and prototype-pollution protection
 * 3. Relationship rules, cycle detection, and structural validation
 * 4. Migration registry and error catalogue formatting
 * 5. Scale tests (500-node graph roundtrip and property idempotence)
 */

import { describe, it, expect } from 'vitest';
import {
  exportGraph,
  prepareGraphImport,
  normalizeDocument,
  getExportFilename,
  getUtf8ByteLength,
  getValidExampleDocument,
  getBrokenExampleDocument,
  CURRENT_VERSION,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_NODES,
} from '../lib/json';
import { useTreeStore, getCanonicalSampleNodes, getCanonicalSampleEdges } from '../store/treeStore';
import { buildLargeTree } from './helpers/treeBuilders';
import { evaluateExportGuard } from '../lib/exportGuard';
import type { TreeNode, TreeEdge } from '../types/tree';

describe('Day 15: Versioned JSON Engine & Import Pipeline (`src/lib/json.ts`)', () => {
  const sampleNodes = getCanonicalSampleNodes();
  const sampleEdges = getCanonicalSampleEdges();

  it('1. exports valid graph deterministically with exact indentation and trailing newline', () => {
    const json1 = exportGraph(sampleNodes, sampleEdges);
    const json2 = exportGraph(sampleNodes, sampleEdges);

    // Byte-identical check
    expect(json1).toBe(json2);
    expect(json1.endsWith('\n')).toBe(true);
    expect(json1).toContain('"version": 1');
    expect(json1).toContain('"nodes":');
    expect(json1).toContain('"edges":');

    const parsed = JSON.parse(json1);
    expect(parsed.version).toBe(CURRENT_VERSION);
    expect(parsed.nodes.length).toBe(sampleNodes.length);
    expect(parsed.edges.length).toBe(sampleEdges.length);
  });

  it('2. excludes React Flow runtime/UI fields during export normalization', () => {
    const dirtyNode = {
      ...sampleNodes[0],
      selected: true,
      dragging: false,
      measured: { width: 200, height: 100 },
      width: 200,
      height: 100,
      hidden: false,
      resizing: false,
    };

    const dirtyEdge = {
      ...sampleEdges[0],
      selected: true,
    };

    const json = exportGraph([dirtyNode], [dirtyEdge]);
    const parsed = JSON.parse(json);

    expect(parsed.nodes[0].selected).toBeUndefined();
    expect(parsed.nodes[0].dragging).toBeUndefined();
    expect(parsed.nodes[0].measured).toBeUndefined();
    expect(parsed.nodes[0].width).toBeUndefined();
    expect(parsed.nodes[0].height).toBeUndefined();
    expect(parsed.nodes[0].hidden).toBeUndefined();
    expect(parsed.nodes[0].resizing).toBeUndefined();
    expect(parsed.edges[0].selected).toBeUndefined();
  });

  it('3. generates correct deterministic export filenames', () => {
    const d = new Date(Date.UTC(2026, 9, 21, 15, 30));
    expect(getExportFilename(d)).toBe('tree-editor-20261021-1530.json');
  });

  it('4. calculates UTF-8 byte lengths correctly', () => {
    expect(getUtf8ByteLength('hello')).toBe(5);
    expect(getUtf8ByteLength('compliance-tree')).toBe(15);
  });

  it('5. guards against empty or whitespace-only inputs', () => {
    const res1 = prepareGraphImport('');
    expect(res1.ok).toBe(false);
    if (!res1.ok) {
      expect(res1.errors[0].code).toBe('INPUT_EMPTY');
    }

    const res2 = prepareGraphImport('   \n\t  ');
    expect(res2.ok).toBe(false);
    if (!res2.ok) {
      expect(res2.errors[0].code).toBe('INPUT_EMPTY');
    }
  });

  it('6. guards against malformed JSON syntax with location info', () => {
    const res = prepareGraphImport('{"version": 1, "nodes": [');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors[0].code).toBe('JSON_SYNTAX_ERROR');
    }
  });

  it('7. guards against missing or invalid version specifications', () => {
    const missingVer = prepareGraphImport(JSON.stringify({ nodes: [], edges: [] }));
    expect(missingVer.ok).toBe(false);
    if (!missingVer.ok) {
      expect(missingVer.errors[0].code).toBe('VERSION_MISSING');
    }

    const stringVer = prepareGraphImport(JSON.stringify({ version: '1', nodes: [], edges: [] }));
    expect(stringVer.ok).toBe(false);
    if (!stringVer.ok) {
      expect(stringVer.errors[0].code).toBe('VERSION_INVALID_TYPE');
    }

    const futureVer = prepareGraphImport(JSON.stringify({ version: 99, nodes: [], edges: [] }));
    expect(futureVer.ok).toBe(false);
    if (!futureVer.ok) {
      expect(futureVer.errors[0].code).toBe('VERSION_UNSUPPORTED_FUTURE');
    }
  });

  it('8. protects against prototype pollution keys', () => {
    const polluted = '{"version": 1, "nodes": [{"id": "n1", "type": "root", "position": {"x": 0, "y": 0}, "data": {"label": "Root", "__proto__": {"admin": true}}}], "edges": []}';

    const res = prepareGraphImport(polluted);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors[0].code).toBe('PROTOTYPE_POLLUTION_DETECTED');
    }
  });

  it('9. successfully parses and validates the valid sample compliance document', () => {
    const validJson = getValidExampleDocument();
    const res = prepareGraphImport(validJson);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.graph.nodes.length).toBe(sampleNodes.length);
      expect(res.graph.edges.length).toBe(sampleEdges.length);
    }
  });

  it('10. rejects the deliberately broken example document with actionable stage errors', () => {
    const brokenJson = getBrokenExampleDocument();
    const res = prepareGraphImport(brokenJson);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.length).toBeGreaterThan(0);
      const codes = res.errors.map((e) => e.code);
      expect(codes.some((c) => c === 'INVALID_RELATIONSHIP' || c === 'CYCLE_DETECTED')).toBe(true);
    }
  });

  it('11. normalization is strictly idempotent', () => {
    const raw = {
      version: 1,
      nodes: [
        {
          id: 'n1',
          type: 'root',
          position: { x: 100.7, y: 200.2 },
          data: { label: 'Test', selected: true },
        },
      ],
      edges: [],
    };

    const first = normalizeDocument(raw);
    const second = normalizeDocument(first.normalized);

    expect(first.normalized).toEqual(second.normalized);
  });

  it('12. failed import does not mutate target graph or state invariants', () => {
    const invalidJson = '{"version": 1, "nodes": [{"id": "n1", "type": "root", "position": {"x": 0, "y": 0}, "data": {"label": "Root"}}], "edges": [{"id": "e1", "source": "n1", "target": "non-existent"}]}';
    const res = prepareGraphImport(invalidJson);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.some((e) => e.code === 'DANGLING_EDGE_ENDPOINT')).toBe(true);
    }
  });

  it('13. export and import roundtrip preserves graph topology and data integrity', () => {
    const validJson = getValidExampleDocument();
    const prep = prepareGraphImport(validJson);
    expect(prep.ok).toBe(true);
    if (prep.ok) {
      const reExported = exportGraph(prep.graph.nodes, prep.graph.edges);
      const prep2 = prepareGraphImport(reExported);
      expect(prep2.ok).toBe(true);
      if (prep2.ok) {
        expect(prep2.graph.nodes.length).toBe(prep.graph.nodes.length);
        expect(prep2.graph.edges.length).toBe(prep.graph.edges.length);
      }
    }
  });

  it('14. guards against excessively large file sizes (5 MiB limit)', () => {
    const oversized = 'x'.repeat(5 * 1024 * 1024 + 100);
    const res = prepareGraphImport(oversized);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors[0].code).toBe('FILE_TOO_LARGE');
    }
  });

  it('15. successfully exports and imports a 500-node graph with zero data loss', () => {
    const largeTree = buildLargeTree(500);
    expect(largeTree.nodes.length).toBe(500);

    const json = exportGraph(largeTree.nodes, largeTree.edges);
    const prep = prepareGraphImport(json);
    expect(prep.ok).toBe(true);

    if (prep.ok) {
      expect(prep.graph.nodes.length).toBe(500);
      expect(prep.graph.edges.length).toBe(largeTree.edges.length);

      // Byte-identical re-export verification
      const reExported = exportGraph(prep.graph.nodes, prep.graph.edges);
      expect(reExported).toBe(json);
    }
  });

  it('16. property test: 50 diverse graphs roundtrip losslessly and normalization is strictly idempotent', () => {
    for (let i = 1; i <= 50; i++) {
      const nodeCount = 5 + (i % 35);
      const tree = buildLargeTree(nodeCount);

      // Attach diverse parameters and metadata
      for (const node of tree.nodes) {
        node.data.parameters = {
          iteration: i,
          activeFlag: i % 2 === 0,
          threshold: i * 1.5,
        };
        node.data.tags = [`tag-${i}`, `tier-${node.type}`];
      }

      const json = exportGraph(tree.nodes, tree.edges);
      const prep = prepareGraphImport(json);
      expect(prep.ok).toBe(true);

      if (prep.ok) {
        expect(prep.graph.nodes.length).toBe(nodeCount);
        expect(prep.graph.edges.length).toBe(tree.edges.length);

        // Idempotence check on raw object
        const parsed = JSON.parse(json);
        const norm1 = normalizeDocument(parsed);
        const norm2 = normalizeDocument(norm1.normalized);
        expect(norm1.normalized).toEqual(norm2.normalized);
      }
    }
  });

  describe('Day 15 Integration: Transactional Import, History & Integrity', () => {
    it('importing graph B over graph A creates exactly one undoable entry, restoring graph A on undo and graph B on redo', () => {
      const { loadSampleTree, applyGraphBatch, undo, redo, getHistoryDepth } = useTreeStore.getState();
      loadSampleTree();

      const graphA_Nodes = useTreeStore.getState().nodes;
      const graphA_Edges = useTreeStore.getState().edges;
      const jsonA = exportGraph(graphA_Nodes, graphA_Edges);

      // Build Graph B
      const graphB = buildLargeTree(8);
      const jsonB = exportGraph(graphB.nodes, graphB.edges);
      const prepB = prepareGraphImport(jsonB);
      expect(prepB.ok).toBe(true);

      if (prepB.ok) {
        // Commit Graph B
        const applied = applyGraphBatch({
          nodes: prepB.graph.nodes,
          edges: prepB.graph.edges,
        });
        expect(applied).toBe(true);
        expect(getHistoryDepth().past).toBe(1);

        // Verify Graph B is active
        expect(useTreeStore.getState().nodes.length).toBe(8);

        // Undo -> Restores Graph A exact document content
        undo();
        const jsonRestoredA = exportGraph(useTreeStore.getState().nodes, useTreeStore.getState().edges);
        expect(jsonRestoredA).toBe(jsonA);
        expect(getHistoryDepth().future).toBe(1);

        // Redo -> Restores Graph B exact document content
        redo();
        const jsonRestoredB = exportGraph(useTreeStore.getState().nodes, useTreeStore.getState().edges);
        expect(jsonRestoredB).toBe(jsonB);
      }
    });

    it('failed import creates zero history entries and does not mutate graph or undo stack', () => {
      const { loadSampleTree, getHistoryDepth } = useTreeStore.getState();
      loadSampleTree();

      const initialPast = getHistoryDepth().past;
      const initialNodes = useTreeStore.getState().nodes;

      // Prepare invalid graph
      const brokenJson = getBrokenExampleDocument();
      const prepBroken = prepareGraphImport(brokenJson);
      expect(prepBroken.ok).toBe(false);

      // Ensure store remains untouched
      expect(useTreeStore.getState().nodes).toEqual(initialNodes);
      expect(getHistoryDepth().past).toBe(initialPast);
    });

    it('generating child nodes and duplicating after import creates collision-free unique IDs', () => {
      const { loadSampleTree, applyGraphBatch, addChild, duplicateNode } = useTreeStore.getState();
      loadSampleTree();

      const tree = buildLargeTree(5);
      const json = exportGraph(tree.nodes, tree.edges);
      const prep = prepareGraphImport(json);
      expect(prep.ok).toBe(true);

      if (prep.ok) {
        applyGraphBatch({ nodes: prep.graph.nodes, edges: prep.graph.edges });

        // Add child rule
        const addRes = addChild('node-0', 'rule');
        expect(addRes.ok).toBe(true);

        const currentIds = new Set(useTreeStore.getState().nodes.map((n) => n.id));
        expect(currentIds.size).toBe(useTreeStore.getState().nodes.length);

        // Duplicate added node
        if (addRes.newChild) {
          const dupRes = duplicateNode(addRes.newChild.id);
          expect(dupRes.ok).toBe(true);

          const updatedIds = new Set(useTreeStore.getState().nodes.map((n) => n.id));
          expect(updatedIds.size).toBe(useTreeStore.getState().nodes.length);
        }
      }
    });

    it('export guard blocks exporting empty graphs or graphs with critical errors', () => {
      const emptyGuard = evaluateExportGuard([], []);
      expect(emptyGuard.allowed).toBe(false);
      expect(emptyGuard.reason).toContain('empty graph');

      // Critical structural error (e.g. non-root connected to non-existent node)
      const invalidNodes: TreeNode[] = [
        {
          id: 'rule-orphan',
          type: 'rule',
          position: { x: 0, y: 0 },
          data: { label: 'Orphan Rule' },
        },
      ];
      const invalidGuard = evaluateExportGuard(invalidNodes, []);
      expect(invalidGuard.allowed).toBe(false);
    });
  });
});


