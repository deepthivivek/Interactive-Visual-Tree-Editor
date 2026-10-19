# Day 13: Advanced Explainable Graph Validation, Quality Analysis, Impact Analysis and Safe Correction Planning

## 1. Overview & Architectural Principles

The Day 13 Graph Validation Engine is a pure, explainable, framework-independent diagnostic system for compliance policy trees.

### Core Principles
1. **Pure & Read-Only**: Validation functions never mutate node or edge inputs. They produce deterministic results without changing application or DOM state.
2. **Explainable with Graph Evidence**: Every finding cites exact node IDs, edge IDs, and structured evidence (e.g., cycle paths, duplicate occurrences, and invalid parent/child pairings).
3. **Decoupled from Graph History**: Validation state, quality scores, impact analyses, advisory plans, and simulations never pollute Zundo undo/redo history.
4. **Full Graph Traversal**: Considers the entire graph, including hidden descendants collapsed within UI subtrees.
5. **Advisory by Default**: Correction planning and what-if simulation provide non-destructive guidance and isolated forecasts; they never perform unprompted automatic repairs.
6. **Mock Compliance Context**: The system validates compliance hierarchy structures (Root -> Rule -> Condition -> Action). Graph validity does not constitute legal or regulatory certification.

---

## 2. Validation Engine API & Result Contract (`src/lib/validation.ts`)

### Primary Signature
```typescript
function validateGraph(
  nodes: unknown,
  edges: unknown,
  options?: ValidationOptions
): ValidationResult
```

### Result Schema
```typescript
interface ValidationResult {
  valid: boolean;                 // true if 0 critical cycles and 0 errors
  errors: ValidationIssue[];      // CRITICAL and ERROR severity issues
  warnings: ValidationIssue[];    // Non-structural completeness issues
  issues: ValidationIssue[];      // All issues deterministically sorted
  affectedNodeIds: string[];      // Unique, deterministically sorted node IDs
  metrics: GraphQualityMetrics;   // Comprehensive graph metrics
  coverage: ValidationCoverageReport; // Coverage statuses across 7 categories
  score: number;                  // Heuristic quality score (0-100)
}
```

### Issue Schema
```typescript
interface ValidationIssue {
  id: string;                     // Deterministic identifier (e.g. `issue-cycle-nodeA-nodeB`)
  severity: 'CRITICAL' | 'ERROR' | 'WARNING';
  type: ValidationIssueType;
  message: string;
  nodeIds: string[];              // Affected existing node IDs
  edgeIds: string[];              // Affected existing edge IDs
  field?: string;                 // Relevant field when applicable
  evidence: Record<string, unknown>; // Structured facts supporting finding
  suggestedFix?: string;          // Human-readable advisory fix
  rootCauseGroupId?: string;      // Group ID linking cascade symptoms to root cause
  confidence: 'DIRECT' | 'DERIVED' | 'HYPOTHESIS';
}
```

---

## 3. Structural Invariants & Hierarchy Rules

1. **Hierarchy Grammar**:
   - `root -> rule`
   - `rule -> condition`, `rule -> action`
   - `condition -> action`
   - `action` is a terminal leaf (cannot have children)
2. **Single-Parent Invariant**:
   - Each non-root node must have exactly one incoming parent connection.
   - Root nodes must have zero incoming parent connections.
3. **Tree Root**:
   - The tree must contain exactly one Root node.
4. **Acyclicity**:
   - The directed graph must contain zero self-loops and zero multi-node cycles.
5. **Endpoint Integrity**:
   - Every edge source and target must exist in the node set. No dangling edges permitted.
6. **Identifier Uniqueness**:
   - Every node and edge must possess a unique non-empty string identifier.
   - Prohibits multiple parallel edges between the same source and target.
7. **Completeness**:
   - Every node requires a non-empty `label`.
   - Action nodes require configured `parameters` (generates `WARNING` if empty).

---

## 4. Severity & Validation Policy

- **`CRITICAL`**: Directed cycles and circular dependencies. Invalidates graph (`valid = false`).
- **`ERROR`**: Structural violations, missing/multiple roots, orphans, multiple parents, invalid relationships, duplicate IDs, dangling edges, and missing required fields. Invalidates graph (`valid = false`).
- **`WARNING`**: Incomplete but non-structural configuration (e.g., Action with empty parameters). Does **not** invalidate an otherwise structurally sound tree.
- **Empty Graph**: Treated as invalid (`valid = false`, `score = 0`) with `EMPTY_GRAPH` issue.

---

## 5. Quality Score Heuristic (0–100)

$$\text{Score} = \max\left(0, 100 - (\text{criticalCount} \times 35 + \text{errorCount} \times 12 + \text{warningCount} \times 3)\right)$$

- Capped at **85** if `valid === false` to ensure an invalid graph is never portrayed as flawless.
- Empty graph evaluates to **0**.
- Explicitly documented as an internal structural heuristic, not an external certification.

---

## 6. Validation Result Comparison & Regression (`src/lib/validationComparison.ts`)

Compares two validation snapshots using stable issue IDs to detect:
- `newIssues` & `newErrorCount` (Regressions)
- `resolvedIssues` & `resolvedErrorCount` (Improvements)
- `persistentIssues`
- `severityChanges`
- `metricDeltas` & `scoreDelta`

---

## 7. Advanced Impact Analysis (`src/lib/impactAnalysis.ts`)

Evaluates proposed mutations (`add-edge`, `remove-edge`, `delete-node`) before application:
- Identifies directly affected nodes and downstream descendants.
- Detects definite violations (e.g. cycles formed, single-parent violations, root deletions).
- Flags potential consequences (e.g. isolated subtrees, orphaned descendants).
- Categorizes risk as `LOW`, `MEDIUM`, or `HIGH`.

---

## 8. Minimal Advisory Correction Planning (`src/lib/correctionPlan.ts`)

Generates explainable repair proposals:
- Identifies unambiguous fixes (removing dangling edges, disconnecting invalid connections).
- Flags ambiguous decisions requiring user choice (e.g. which edge to break in a multi-node cycle, or which parent to keep when a node has multiple parents).
- Completely advisory: zero automatic mutations.

---

## 9. Safe What-If Simulation (`src/lib/simulation.ts`)

Executes proposed corrections on an isolated deep clone of the graph:
- Runs validation before and after.
- Compares results to forecast whether the change repairs defects without introducing regressions.
- Leaves the active workspace graph 100% untouched.

---

## 10. Separate Validation Report (`src/lib/validationReport.ts`)

Generates a standalone, sanitized JSON report conforming to the Version 1 Report Schema:
- Completely separate from the graph document schema (`{"version":1,"nodes":[],"edges":[]}`).
- Excludes viewport coordinates, selection flags, and transient UI states.
