import { describe, it, expect, beforeEach } from 'vitest';
import { createPracticeTreeFixture } from '../lib/practiceTree';
import { evaluateExportGuard } from '../lib/exportGuard';
import { validateGraph } from '../lib/validation';
import { useTreeStore } from '../store/treeStore';

describe('Day 14 Phase 1: Validation Panel, Export Guard, Practice Fixtures & History Notifications', () => {
  beforeEach(() => {
    useTreeStore.getState().resetToSampleData();
  });

  it('1. generates valid practice tree fixtures across all preset types', () => {
    const clean = createPracticeTreeFixture('clean');
    expect(clean.nodes.length).toBe(2);
    expect(clean.edges.length).toBe(1);
    expect(validateGraph(clean.nodes, clean.edges).valid).toBe(true);

    const orphans = createPracticeTreeFixture('orphans');
    expect(orphans.nodes.length).toBe(2);
    expect(validateGraph(orphans.nodes, orphans.edges).valid).toBe(false);

    const cycle = createPracticeTreeFixture('cycle');
    expect(cycle.nodes.length).toBe(2);
    expect(validateGraph(cycle.nodes, cycle.edges).valid).toBe(false);

    const missingRoot = createPracticeTreeFixture('missing-root');
    expect(missingRoot.nodes.length).toBe(1);
    expect(validateGraph(missingRoot.nodes, missingRoot.edges).valid).toBe(false);
  });

  it('2. evaluates export guard correctly for valid vs invalid graphs', () => {
    const cleanFixture = createPracticeTreeFixture('clean');
    const exportCheckValid = evaluateExportGuard(cleanFixture.nodes, cleanFixture.edges);
    expect(exportCheckValid.allowed).toBe(true);
    expect(exportCheckValid.validation.valid).toBe(true);

    const missingRootFixture = createPracticeTreeFixture('missing-root');
    const exportCheckInvalid = evaluateExportGuard(missingRootFixture.nodes, missingRootFixture.edges);
    expect(exportCheckInvalid.allowed).toBe(false);
    expect(exportCheckInvalid.reason).toBeDefined();
  });

  it('3. handles history revision and undo notification flow correctly', () => {
    const store = useTreeStore.getState();
    const initialNodesCount = store.nodes.length;

    // Add node
    const newNode = store.createNode('condition', { x: 100, y: 100 });
    expect(newNode).toBeDefined();
    expect(useTreeStore.getState().nodes.length).toBe(initialNodesCount + 1);

    // Undo should restore previous node count
    useTreeStore.getState().undo();
    expect(useTreeStore.getState().nodes.length).toBe(initialNodesCount);
  });

  it('4. validates sample compliance template graph quality score and metrics', () => {
    const { nodes, edges } = useTreeStore.getState();
    const result = validateGraph(nodes, edges);
    expect(result.valid).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.metrics.rootCount).toBe(1);
  });
});
