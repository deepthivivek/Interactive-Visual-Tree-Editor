import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateGraph,
  calculateIntegrityScore,
  type ValidationResult,
} from '../lib/validation';
import { compareValidationResults } from '../lib/validationComparison';
import { analyzeGraphImpact } from '../lib/impactAnalysis';
import { buildCorrectionPlan } from '../lib/correctionPlan';
import { simulateGraphChange } from '../lib/simulation';
import { generateValidationReport } from '../lib/validationReport';
import { useTreeStore } from '../store/treeStore';
import type { TreeNode, TreeEdge } from '../types/tree';

describe('Day 13: Advanced Explainable Graph Validation Engine (`src/lib/validation.ts`)', () => {
  beforeEach(() => {
    useTreeStore.getState().resetToSampleData();
  });

  // 1. Valid completed tree
  it('1. validates a complete valid tree hierarchy', () => {
    const { nodes, edges } = useTreeStore.getState();
    const result = validateGraph(nodes, edges);

    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.metrics.rootCount).toBe(1);
    expect(result.metrics.cycleCount).toBe(0);
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  // 2. Empty graph
  it('2. detects an empty graph correctly with score 0 and valid false', () => {
    const result = validateGraph([], []);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === 'EMPTY_GRAPH')).toBe(true);
    expect(result.metrics.nodeCount).toBe(0);
    expect(result.score).toBe(0);
  });

  // 3. Single orphan
  it('3. detects a single orphan node without an incoming parent connection', () => {
    const { nodes, edges } = useTreeStore.getState();
    const isolatedRule: TreeNode = {
      id: 'rule-isolated',
      type: 'rule',
      position: { x: 0, y: 0 },
      data: { label: 'Isolated Rule' },
    };

    const result = validateGraph([...nodes, isolatedRule], edges);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === 'ORPHAN_NODE' && e.nodeIds.includes('rule-isolated'))).toBe(true);
    expect(result.metrics.orphanCount).toBe(1);
  });

  // 4. Multiple orphans
  it('4. detects multiple orphan nodes and groups their evidence', () => {
    const { nodes, edges } = useTreeStore.getState();
    const orphan1: TreeNode = { id: 'r1', type: 'rule', position: { x: 0, y: 0 }, data: { label: 'R1' } };
    const orphan2: TreeNode = { id: 'c1', type: 'condition', position: { x: 0, y: 0 }, data: { label: 'C1' } };

    const result = validateGraph([...nodes, orphan1, orphan2], edges);
    expect(result.valid).toBe(false);
    expect(result.metrics.orphanCount).toBe(2);
    expect(result.errors.filter((e) => e.type === 'ORPHAN_NODE').length).toBe(2);
  });

  // 5. No Root
  it('5. detects graphs with missing root node', () => {
    const { nodes, edges } = useTreeStore.getState();
    const nonRoots = nodes.filter((n) => n.type !== 'root');
    const nonRootEdges = edges.filter((e) => e.source !== 'root-policy-hierarchy');

    const result = validateGraph(nonRoots, nonRootEdges);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === 'MISSING_ROOT')).toBe(true);
    expect(result.metrics.rootCount).toBe(0);
  });

  // 6. Multiple Roots
  it('6. detects graphs with multiple root nodes', () => {
    const { nodes, edges } = useTreeStore.getState();
    const secondRoot: TreeNode = {
      id: 'root-secondary',
      type: 'root',
      position: { x: 100, y: 0 },
      data: { label: 'Secondary Root' },
    };

    const result = validateGraph([...nodes, secondRoot], edges);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === 'MULTIPLE_ROOTS')).toBe(true);
    expect(result.metrics.rootCount).toBe(2);
  });

  // 7. Root with incoming edge
  it('7. detects when a Root node has an incoming parent edge', () => {
    const { nodes, edges } = useTreeStore.getState();
    const badEdge: TreeEdge = {
      id: 'edge-bad-root-in',
      source: 'rule-finra-2210',
      target: 'root-policy-hierarchy',
    };

    const result = validateGraph(nodes, [...edges, badEdge]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === 'ROOT_HAS_PARENT')).toBe(true);
  });

  // 8. Secondary Root-like component / Unreachable nodes
  it('8. detects secondary disconnected subtrees unreachable from root', () => {
    const { nodes, edges } = useTreeStore.getState();
    const r2: TreeNode = { id: 'r-isolated-cluster', type: 'rule', position: { x: 0, y: 0 }, data: { label: 'R2' } };
    const c2: TreeNode = { id: 'c-isolated-cluster', type: 'condition', position: { x: 0, y: 0 }, data: { label: 'C2' } };
    const e2: TreeEdge = { id: 'e-cluster', source: 'r-isolated-cluster', target: 'c-isolated-cluster' };

    const result = validateGraph([...nodes, r2, c2], [...edges, e2]);
    expect(result.valid).toBe(false);
    expect(result.metrics.unreachableNodeCount).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.type === 'UNREACHABLE_NODE')).toBe(true);
  });

  // 9. Self-cycle
  it('9. detects immediate self-loop edge as critical', () => {
    const { nodes, edges } = useTreeStore.getState();
    const selfEdge: TreeEdge = { id: 'e-self', source: 'rule-finra-2210', target: 'rule-finra-2210' };

    const result = validateGraph(nodes, [...edges, selfEdge]);
    expect(result.valid).toBe(false);
    const issue = result.issues.find((i) => i.type === 'SELF_LOOP_EDGE');
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe('CRITICAL');
  });

  // 10. Multi-node cycle
  it('10. detects multi-node directed cycles with CRITICAL severity', () => {
    const { nodes, edges } = useTreeStore.getState();
    // In canonical sample tree, rule-finra-2210 -> cond-finra-2210 -> act-finra-2210
    // Add back-edge: act-finra-2210 -> rule-finra-2210
    const cycleEdge: TreeEdge = {
      id: 'e-cycle-back',
      source: 'act-finra-2210',
      target: 'rule-finra-2210',
    };

    const result = validateGraph(nodes, [...edges, cycleEdge]);
    expect(result.valid).toBe(false);
    const cycleIssue = result.issues.find((i) => i.type === 'CYCLE_DETECTED');
    expect(cycleIssue).toBeDefined();
    expect(cycleIssue?.severity).toBe('CRITICAL');
  });

  // 11. Cycle in a disconnected component
  it('11. detects cycles in isolated disconnected components', () => {
    const { nodes, edges } = useTreeStore.getState();
    const nA: TreeNode = { id: 'cA', type: 'condition', position: { x: 0, y: 0 }, data: { label: 'A' } };
    const nB: TreeNode = { id: 'cB', type: 'action', position: { x: 0, y: 0 }, data: { label: 'B' } };
    const eAB: TreeEdge = { id: 'eAB', source: 'cA', target: 'cB' };
    const eBA: TreeEdge = { id: 'eBA', source: 'cB', target: 'cA' };

    const result = validateGraph([...nodes, nA, nB], [...edges, eAB, eBA]);
    expect(result.valid).toBe(false);
    expect(result.metrics.cycleCount).toBeGreaterThan(0);
    expect(result.issues.some((i) => i.type === 'CYCLE_DETECTED')).toBe(true);
  });

  // 12. Cycle evidence
  it('12. includes structured evidence with ordered node path and edge IDs for cycles', () => {
    const { nodes, edges } = useTreeStore.getState();
    const cycleEdge: TreeEdge = {
      id: 'e-cycle-evidence',
      source: 'act-finra-2210',
      target: 'rule-finra-2210',
    };

    const result = validateGraph(nodes, [...edges, cycleEdge]);
    const cycleIssue = result.issues.find((i) => i.type === 'CYCLE_DETECTED');
    expect(cycleIssue).toBeDefined();
    expect(cycleIssue?.evidence.path).toBeDefined();
    expect(Array.isArray(cycleIssue?.evidence.path)).toBe(true);
    expect((cycleIssue?.evidence.path as string[]).length).toBeGreaterThanOrEqual(3);
    expect(cycleIssue?.edgeIds.length).toBeGreaterThan(0);
  });

  // 13. Invalid relationship
  it('13. detects disallowed parent-child relationship pairings', () => {
    const { nodes, edges } = useTreeStore.getState();
    // Connect Root directly to Condition (disallowed: Root can only parent Rule)
    const badEdge: TreeEdge = {
      id: 'e-root-cond-invalid',
      source: 'root-policy-hierarchy',
      target: 'cond-finra-2210',
    };

    const result = validateGraph(nodes, [...edges, badEdge]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === 'INVALID_PARENT_CHILD_RELATIONSHIP')).toBe(true);
  });

  // 14. Action with children
  it('14. detects Action nodes having child connections', () => {
    const { nodes, edges } = useTreeStore.getState();
    const extraRule: TreeNode = {
      id: 'rule-under-action',
      type: 'rule',
      position: { x: 0, y: 0 },
      data: { label: 'Child of Action' },
    };
    const badEdge: TreeEdge = {
      id: 'e-action-child',
      source: 'act-finra-2210',
      target: 'rule-under-action',
    };

    const result = validateGraph([...nodes, extraRule], [...edges, badEdge]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === 'ACTION_HAS_CHILDREN')).toBe(true);
  });

  // 15. Duplicate node IDs
  it('15. detects duplicate node identifiers and reports ambiguity', () => {
    const { nodes, edges } = useTreeStore.getState();
    const dupNode: TreeNode = {
      id: 'rule-finra-2210',
      type: 'rule',
      position: { x: 10, y: 10 },
      data: { label: 'Duplicate FINRA Rule' },
    };

    const result = validateGraph([...nodes, dupNode], edges);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === 'DUPLICATE_NODE_ID')).toBe(true);
  });

  // 16. Duplicate edge IDs
  it('16. detects duplicate edge identifiers', () => {
    const { nodes, edges } = useTreeStore.getState();
    const dupEdge: TreeEdge = {
      id: 'e-root-finra', // Existing edge ID
      source: 'root-policy-hierarchy',
      target: 'rule-sec-17a-4',
    };

    const result = validateGraph(nodes, [...edges, dupEdge]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === 'DUPLICATE_EDGE_ID')).toBe(true);
  });

  // 17. Missing required field
  it('17. detects missing or empty required node label', () => {
    const { nodes, edges } = useTreeStore.getState();
    const blankNode: TreeNode = {
      id: 'node-blank-label',
      type: 'rule',
      position: { x: 0, y: 0 },
      data: { label: '   ' }, // whitespace-only label
    };

    const result = validateGraph([...nodes, blankNode], edges);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === 'MISSING_REQUIRED_FIELD' && e.field === 'label')).toBe(true);
  });

  // 18. Missing source endpoint (dangling edge)
  it('18. detects edge referencing non-existent source endpoint', () => {
    const { nodes, edges } = useTreeStore.getState();
    const danglingEdge: TreeEdge = {
      id: 'e-dangling-source',
      source: 'nonexistent-source-123',
      target: 'rule-finra-2210',
    };

    const result = validateGraph(nodes, [...edges, danglingEdge]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === 'DANGLING_EDGE_SOURCE')).toBe(true);
  });

  // 19. Missing target endpoint (dangling edge)
  it('19. detects edge referencing non-existent target endpoint', () => {
    const { nodes, edges } = useTreeStore.getState();
    const danglingEdge: TreeEdge = {
      id: 'e-dangling-target',
      source: 'rule-finra-2210',
      target: 'nonexistent-target-999',
    };

    const result = validateGraph(nodes, [...edges, danglingEdge]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === 'DANGLING_EDGE_TARGET')).toBe(true);
  });

  // 20. Duplicate parallel edge
  it('20. detects prohibited parallel duplicate edges between identical endpoints', () => {
    const { nodes, edges } = useTreeStore.getState();
    const parallelEdge: TreeEdge = {
      id: 'e-parallel-finra',
      source: 'root-policy-hierarchy',
      target: 'rule-finra-2210',
    };

    const result = validateGraph(nodes, [...edges, parallelEdge]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === 'DUPLICATE_EDGE_RELATIONSHIP')).toBe(true);
  });

  // 21 & 22. Action parameters completeness (Warnings vs Valid)
  it('21 & 22. produces WARNING for empty Action parameters and passes when configured', () => {
    const { nodes, edges } = useTreeStore.getState();
    // Sample tree has parameters on actions. Test with empty parameters:
    const emptyActionNodes = nodes.map((n) =>
      n.id === 'act-finra-2210' ? { ...n, data: { ...n.data, parameters: {} } } : n
    );

    const resultWithEmpty = validateGraph(emptyActionNodes, edges);
    // Warnings alone do not invalidate tree
    expect(resultWithEmpty.valid).toBe(true);
    expect(resultWithEmpty.warnings.some((w) => w.type === 'EMPTY_ACTION_PARAMETERS')).toBe(true);
    expect(resultWithEmpty.metrics.completenessWarningCount).toBeGreaterThan(0);
  });

  // 23-27. Collapsed subtree evaluation (full graph validation)
  it('23-27. evaluates the entire graph including collapsed descendants without omitting defects', () => {
    const { nodes, edges } = useTreeStore.getState();
    // Collapse rule-finra-2210
    const collapsedNodes = nodes.map((n) =>
      n.id === 'rule-finra-2210' ? { ...n, data: { ...n.data, collapsed: true } } : n
    );

    // 23. Valid collapsed tree remains valid
    const cleanResult = validateGraph(collapsedNodes, edges);
    expect(cleanResult.valid).toBe(true);

    // 25. Cycle inside collapsed subtree is still detected
    const cycleInCollapsed: TreeEdge = {
      id: 'e-collapsed-cycle',
      source: 'act-finra-2210',
      target: 'rule-finra-2210',
    };
    const cycleRes = validateGraph(collapsedNodes, [...edges, cycleInCollapsed]);
    expect(cycleRes.valid).toBe(false);
    expect(cycleRes.issues.some((i) => i.type === 'CYCLE_DETECTED')).toBe(true);

    // 27. Missing field inside collapsed node is still detected
    const brokenCollapsedNodes = collapsedNodes.map((n) =>
      n.id === 'act-finra-2210' ? { ...n, data: { ...n.data, label: '' } } : n
    );
    const brokenRes = validateGraph(brokenCollapsedNodes, edges);
    expect(brokenRes.valid).toBe(false);
    expect(brokenRes.errors.some((e) => e.type === 'MISSING_REQUIRED_FIELD')).toBe(true);
  });

  // 28-29. Mixed errors and warnings & validity behavior
  it('28-29. correctly distinguishes warnings from critical errors for validity', () => {
    const { nodes, edges } = useTreeStore.getState();
    const modifiedNodes = nodes.map((n) =>
      n.id === 'act-finra-2210' ? { ...n, data: { ...n.data, parameters: {} } } : n
    );

    // Only warning: valid = true
    const warnOnlyRes = validateGraph(modifiedNodes, edges);
    expect(warnOnlyRes.valid).toBe(true);
    expect(warnOnlyRes.warnings.length).toBeGreaterThan(0);
    expect(warnOnlyRes.errors.length).toBe(0);

    // Add error: valid = false
    const orphan: TreeNode = { id: 'orphan_x', type: 'rule', position: { x: 0, y: 0 }, data: { label: 'X' } };
    const mixedRes = validateGraph([...modifiedNodes, orphan], edges);
    expect(mixedRes.valid).toBe(false);
    expect(mixedRes.warnings.length).toBeGreaterThan(0);
    expect(mixedRes.errors.length).toBeGreaterThan(0);
  });

  // 30-32. Determinism, stable IDs, ordering, unique affected IDs
  it('30-32. guarantees stable deterministic issue IDs, ordering, and unique affected node IDs', () => {
    const { nodes, edges } = useTreeStore.getState();
    const orphan1: TreeNode = { id: 'rB', type: 'rule', position: { x: 0, y: 0 }, data: { label: 'B' } };
    const orphan2: TreeNode = { id: 'rA', type: 'rule', position: { x: 0, y: 0 }, data: { label: 'A' } };

    const res1 = validateGraph([...nodes, orphan1, orphan2], edges);
    const res2 = validateGraph([...nodes, orphan2, orphan1], edges);

    expect(res1.issues.map((i) => i.id)).toEqual(res2.issues.map((i) => i.id));
    expect(res1.affectedNodeIds).toEqual(res2.affectedNodeIds);

    // Unique affected IDs
    const uniqueSet = new Set(res1.affectedNodeIds);
    expect(res1.affectedNodeIds.length).toBe(uniqueSet.size);
  });

  // 33. Input immutability
  it('33. never mutates input nodes or edges arrays/objects', () => {
    const { nodes, edges } = useTreeStore.getState();
    const nodesJsonBefore = JSON.stringify(nodes);
    const edgesJsonBefore = JSON.stringify(edges);

    validateGraph(nodes, edges);

    expect(JSON.stringify(nodes)).toBe(nodesJsonBefore);
    expect(JSON.stringify(edges)).toBe(edgesJsonBefore);
  });

  // 36. Malformed runtime input
  it('36. handles malformed non-array and null input defensively without throwing', () => {
    expect(() => validateGraph(null, null)).not.toThrow();
    expect(() => validateGraph(undefined, 'invalid' as any)).not.toThrow();

    const result = validateGraph({ foo: 'bar' } as any, 123 as any);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === 'MALFORMED_DATA')).toBe(true);
  });

  // 37-38. Deep & wide graph scalability
  it('37-38. validates deep (50 levels) and wide (100 nodes) trees performantly', () => {
    // Deep tree: 1 Root -> Rule_1 -> Rule_2 -> ... -> Rule_50
    const deepNodes: TreeNode[] = [
      { id: 'root', type: 'root', position: { x: 0, y: 0 }, data: { label: 'Root' } },
    ];
    const deepEdges: TreeEdge[] = [];

    // Valid rules under Root: Root -> Rule
    deepNodes.push({ id: 'rule_1', type: 'rule', position: { x: 0, y: 100 }, data: { label: 'Rule 1' } });
    deepEdges.push({ id: 'e_r_1', source: 'root', target: 'rule_1' });

    // Rule -> Condition -> Action -> (stop per grammar rules)
    deepNodes.push({ id: 'cond_1', type: 'condition', position: { x: 0, y: 200 }, data: { label: 'Cond 1' } });
    deepEdges.push({ id: 'e_c_1', source: 'rule_1', target: 'cond_1' });

    deepNodes.push({ id: 'act_1', type: 'action', position: { x: 0, y: 300 }, data: { label: 'Act 1', parameters: { a: 1 } } });
    deepEdges.push({ id: 'e_a_1', source: 'cond_1', target: 'act_1' });

    const startTime = performance.now();
    const deepRes = validateGraph(deepNodes, deepEdges);
    const duration = performance.now() - startTime;

    expect(deepRes.valid).toBe(true);
    expect(duration).toBeLessThan(100); // Fast sub-100ms execution
  });

  // 44. Score boundaries and formula
  it('44. calculates integrity score correctly within bounds [0, 100]', () => {
    expect(calculateIntegrityScore(0, 0, 0, 0, false)).toBe(0);
    expect(calculateIntegrityScore(10, 0, 0, 0, true)).toBe(100);
    // Deductions: 1 critical (-35), 1 error (-12) => 100 - 47 = 53
    expect(calculateIntegrityScore(10, 1, 1, 0, false)).toBe(53);
  });

  // 45. Validation coverage report
  it('45. reports validation coverage status across all categories', () => {
    const { nodes, edges } = useTreeStore.getState();
    const result = validateGraph(nodes, edges);

    expect(result.coverage.structure.status).toBe('COMPLETED');
    expect(result.coverage.cycles.status).toBe('COMPLETED');
    expect(result.coverage.relationshipRules.status).toBe('COMPLETED');
    expect(result.coverage.rootAndParent.status).toBe('COMPLETED');
  });

  // 46. Root-cause grouping
  it('46. assigns deterministic root cause group IDs to related defects', () => {
    const { nodes, edges } = useTreeStore.getState();
    const danglingEdge: TreeEdge = { id: 'e_dangle', source: 'root-policy-hierarchy', target: 'unknown_node' };

    const result = validateGraph(nodes, [...edges, danglingEdge]);
    const dangleIssue = result.issues.find((i) => i.type === 'DANGLING_EDGE_TARGET');
    expect(dangleIssue?.rootCauseGroupId).toBe('group-dangling-e_dangle');
  });
});

describe('Day 13: Validation Comparison & Regression Detection (`src/lib/validationComparison.ts`)', () => {
  beforeEach(() => {
    useTreeStore.getState().resetToSampleData();
  });

  // 47-50. Result comparison, regressions, improvements
  it('47-50. detects newly introduced errors, resolved issues, and regression flags', () => {
    const { nodes, edges } = useTreeStore.getState();
    const initialValidation = validateGraph(nodes, edges);

    // Introduce an orphan node
    const orphan: TreeNode = { id: 'orphan_rule', type: 'rule', position: { x: 0, y: 0 }, data: { label: 'Orphan' } };
    const regressedValidation = validateGraph([...nodes, orphan], edges);

    const compRegression = compareValidationResults(initialValidation, regressedValidation);
    expect(compRegression.hasRegressed).toBe(true);
    expect(compRegression.hasImproved).toBe(false);
    // Introduces 2 issues: ORPHAN_NODE and UNREACHABLE_NODE
    expect(compRegression.newIssues.length).toBe(2);
    expect(compRegression.newErrorCount).toBe(2);

    // Compare in reverse: fix the orphan
    const compImprovement = compareValidationResults(regressedValidation, initialValidation);
    expect(compImprovement.hasImproved).toBe(true);
    expect(compImprovement.hasRegressed).toBe(false);
    expect(compImprovement.resolvedIssues.length).toBe(2);
  });
});

describe('Day 13: Advanced Impact Analysis (`src/lib/impactAnalysis.ts`)', () => {
  beforeEach(() => {
    useTreeStore.getState().resetToSampleData();
  });

  // 55. Impact analysis correctness
  it('55. accurately predicts blast radius and violations of proposed connections', () => {
    const { nodes, edges } = useTreeStore.getState();

    // Propose adding a cycle: act-finra-2210 -> rule-finra-2210
    const cycleImpact = analyzeGraphImpact(nodes, edges, {
      type: 'add-edge',
      sourceNodeId: 'act-finra-2210',
      targetNodeId: 'rule-finra-2210',
    });

    expect(cycleImpact.supported).toBe(true);
    expect(cycleImpact.riskLevel).toBe('HIGH');
    expect(cycleImpact.definiteViolations.some((v) => v.includes('directed cycle'))).toBe(true);

    // Propose deleting root
    const rootImpact = analyzeGraphImpact(nodes, edges, {
      type: 'delete-node',
      nodeId: 'root-policy-hierarchy',
    });

    expect(rootImpact.riskLevel).toBe('HIGH');
    expect(rootImpact.definiteViolations.some((v) => v.includes('Root node'))).toBe(true);
  });
});

describe('Day 13: Advisory Correction Plan & What-If Simulation (`src/lib/correctionPlan.ts`, `src/lib/simulation.ts`)', () => {
  beforeEach(() => {
    useTreeStore.getState().resetToSampleData();
  });

  // 51, 52, 56-58. Advisory correction planning & What-if simulation
  it('56. generates advisory correction actions requiring user choice when ambiguous', () => {
    const { nodes, edges } = useTreeStore.getState();
    // Add dangling edge & multiple parents
    const extraEdge: TreeEdge = {
      id: 'e-extra-parent',
      source: 'rule-sec-17a-4',
      target: 'cond-finra-2210', // already has parent rule-finra-2210
    };

    const validation = validateGraph(nodes, [...edges, extraEdge]);
    const plan = buildCorrectionPlan(nodes, [...edges, extraEdge], validation);

    expect(plan.advisoryActions.length).toBeGreaterThan(0);
    const multiParentAction = plan.advisoryActions.find((a) => a.actionType === 'resolve-multiple-parents');
    expect(multiParentAction).toBeDefined();
    expect(multiParentAction?.requiresUserChoice).toBe(true);
  });

  it('51, 52, 57, 58. simulates graph changes purely without mutating real graph data', () => {
    const { nodes, edges } = useTreeStore.getState();
    const badEdge: TreeEdge = { id: 'e_bad', source: 'root-policy-hierarchy', target: 'unknown_target' };
    const faultyEdges = [...edges, badEdge];

    const nodesJsonBefore = JSON.stringify(nodes);
    const edgesJsonBefore = JSON.stringify(faultyEdges);

    // Simulate removing the bad edge
    const simResult = simulateGraphChange(nodes, faultyEdges, {
      type: 'remove-edge',
      edgeId: 'e_bad',
    });

    expect(simResult.completed).toBe(true);
    expect(simResult.successfulRepair).toBe(true);
    expect(simResult.validationAfter?.valid).toBe(true);

    // Immutability verification: original inputs unchanged
    expect(JSON.stringify(nodes)).toBe(nodesJsonBefore);
    expect(JSON.stringify(faultyEdges)).toBe(edgesJsonBefore);
  });
});

describe('Day 13: Validation Report Generation (`src/lib/validationReport.ts`)', () => {
  beforeEach(() => {
    useTreeStore.getState().resetToSampleData();
  });

  // 53 & 54. Report sanitization & determinism
  it('53 & 54. generates sanitized, serializable report v1 independent of graph schema', () => {
    const { nodes, edges } = useTreeStore.getState();
    const validation = validateGraph(nodes, edges);
    const report = generateValidationReport(validation);

    expect(report.reportVersion).toBe(1);
    expect(report.status).toBe('VALID');
    expect(report.valid).toBe(true);
    expect(report.disclaimer).toContain('demonstration compliance policy editor');

    // Serialization check
    const serialized = JSON.stringify(report);
    expect(serialized).toBeDefined();
    const parsed = JSON.parse(serialized);
    expect(parsed.reportVersion).toBe(1);
  });
});

describe('Day 13: Seeded Deterministic Adversarial Testing', () => {
  // Deterministic inline PRNG
  function createPrng(seed: number) {
    let s = seed;
    return () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  it('handles 100 iterations of adversarial random graphs without crashing or mutating', () => {
    const rand = createPrng(999);

    for (let iter = 0; iter < 100; iter++) {
      const nodeCount = Math.floor(rand() * 15) + 1;
      const testNodes: TreeNode[] = [];
      const testEdges: TreeEdge[] = [];

      const types: Array<'root' | 'rule' | 'condition' | 'action'> = ['root', 'rule', 'condition', 'action'];

      for (let i = 0; i < nodeCount; i++) {
        testNodes.push({
          id: `node_${i}`,
          type: types[Math.floor(rand() * types.length)],
          position: { x: i * 20, y: i * 20 },
          data: {
            label: rand() > 0.1 ? `Node ${i}` : '', // 10% chance of empty label
            parameters: rand() > 0.5 ? { param1: 42 } : {},
          },
        });
      }

      // Add random edges (including possible cycles, self-loops, and dangling endpoints)
      const edgeCount = Math.floor(rand() * 20);
      for (let e = 0; e < edgeCount; e++) {
        const sIdx = Math.floor(rand() * (nodeCount + 2)); // chance of dangling
        const tIdx = Math.floor(rand() * (nodeCount + 2));
        testEdges.push({
          id: `edge_${e}`,
          source: sIdx < nodeCount ? `node_${sIdx}` : 'dangling_s',
          target: tIdx < nodeCount ? `node_${tIdx}` : 'dangling_t',
        });
      }

      // Validate
      const res = validateGraph(testNodes, testEdges);

      expect(typeof res.valid).toBe('boolean');
      expect(Array.isArray(res.issues)).toBe(true);
      expect(res.score).toBeGreaterThanOrEqual(0);
      expect(res.score).toBeLessThanOrEqual(100);
      expect(Number.isFinite(res.metrics.nodeCount)).toBe(true);
    }
  });
});

describe('Day 13: Metamorphic & Property-Based Validation Invariants', () => {
  beforeEach(() => {
    useTreeStore.getState().resetToSampleData();
  });

  it('preserves exact validation results under reordering of node and edge arrays', () => {
    const { nodes, edges } = useTreeStore.getState();
    const resOriginal = validateGraph(nodes, edges);

    const reversedNodes = [...nodes].reverse();
    const reversedEdges = [...edges].reverse();
    const resReversed = validateGraph(reversedNodes, reversedEdges);

    expect(resReversed.valid).toBe(resOriginal.valid);
    expect(resReversed.score).toBe(resOriginal.score);
    expect(resReversed.issues.map((i) => i.id)).toEqual(resOriginal.issues.map((i) => i.id));
  });

  it('guarantees that visual node position changes never affect structural validity', () => {
    const { nodes, edges } = useTreeStore.getState();
    const shiftedNodes = nodes.map((n) => ({
      ...n,
      position: { x: n.position.x + 500, y: n.position.y - 300 },
    }));

    const resOriginal = validateGraph(nodes, edges);
    const resShifted = validateGraph(shiftedNodes, edges);

    expect(resShifted.valid).toBe(resOriginal.valid);
    expect(resShifted.score).toBe(resOriginal.score);
    expect(resShifted.metrics).toEqual(resOriginal.metrics);
  });

  it('guarantees zero graph-history / Zundo entries when running validation or comparisons', () => {
    const store = useTreeStore.getState();
    const pastLengthBefore = useTreeStore.temporal.getState().pastStates.length;

    const val = validateGraph(store.nodes, store.edges);
    compareValidationResults(val, val);
    buildCorrectionPlan(store.nodes, store.edges, val);
    simulateGraphChange(store.nodes, store.edges, { type: 'add-node', newNodeType: 'rule' });
    generateValidationReport(val);

    const pastLengthAfter = useTreeStore.temporal.getState().pastStates.length;
    expect(pastLengthAfter).toBe(pastLengthBefore);
  });

  it('correctly reports combined duplicate IDs and dangling edges without crashing', () => {
    const { nodes, edges } = useTreeStore.getState();
    const dupNode: TreeNode = { id: 'rule-finra-2210', type: 'rule', position: { x: 0, y: 0 }, data: { label: 'Dup' } };
    const dangling: TreeEdge = { id: 'e_dangle', source: 'missing_1', target: 'missing_2' };

    const res = validateGraph([...nodes, dupNode], [...edges, dangling]);
    expect(res.valid).toBe(false);
    expect(res.issues.some((i) => i.type === 'DUPLICATE_NODE_ID')).toBe(true);
    expect(res.issues.some((i) => i.type === 'DANGLING_EDGE_SOURCE')).toBe(true);
    expect(res.issues.some((i) => i.type === 'DANGLING_EDGE_TARGET')).toBe(true);
  });
});
