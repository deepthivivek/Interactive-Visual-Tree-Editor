# Changelog - Interactive Visual Tree Editor

All notable changes to this project will be documented in this file.

## [Day 1] - 2026-10-04: Project Foundation, Core Model & Store Setup

### Added
- **Core Typed Data Model (`src/types/tree.ts`)**:
  - `NodeType`: `'root' | 'rule' | 'condition' | 'action'`
  - `NodeSeverity`: `'info' | 'low' | 'medium' | 'high' | 'critical'`
  - `NodeStatus`: `'draft' | 'active' | 'deprecated' | 'in_review'`
  - `TreeNodeData`: strict typed representation for label, ruleId, description, severity, status, parameters, metadata, and optional collapsed state.
  - `TreeNode` & `TreeEdge`: React Flow compatible typed nodes and edges.
  - `TreeDocument`: explicit persistence and export shape containing only version, nodes, and edges.
  - `TreeUiState` & `TreeStoreState`: separation between document state and transient UI state.
- **Zustand Tree Store (`src/store/treeStore.ts`)**:
  - Store initialized with strict boundary separating graph document state (`nodes`, `edges`) from transient UI state (`selectedNodeId`).
  - Actions for setting nodes, setting edges, updating selection, and resetting to sample data.
- **Realistic Mock Sample Data ("Sample Compliance Template")**:
  - Exactly ONE root: "Policy Hierarchy" (`root-policy-hierarchy`).
  - Three distinct branches:
    - `FINRA-2210` (Rule) with `Condition` and `Action` children.
    - `SEC-17a-4` (Rule) with `Condition` and `Action` children.
    - `DISC-09` (Rule) with `Condition` and `Action` children.
  - Clearly labelled as mock sample data (not official regulatory workflows).
  - Valid tree topology: single root (0 incoming edges), 9 non-root nodes each with exactly 1 parent edge.
- **Vitest Configuration & Unit Tests (`vitest.config.ts`, `src/tests/treeStore.test.ts`)**:
  - Configured Vitest test runner.
  - Real unit tests verifying root uniqueness, node ID uniqueness, compliance branch structure, single-parent constraint, typed node data fields, and store state separation between document and transient UI states.
- **Minimal Foundation Page & UI Components**:
  - `src/components/ui/badge.tsx`: reusable badge component for node types, severities, and statuses.
  - `src/components/tree/TreeFoundationViewer.tsx`: structured hierarchical view displaying nodes, metrics, edge manifests, and interactive selection.
  - `src/app/tree-editor/page.tsx` & `/app/tree-editor/page.tsx`: foundation verification route.
  - `/app/page.tsx`: redirect to `/tree-editor`.
- **Documentation**:
  - `REQUIREMENTS.md`: complete Task 4 requirements traceability matrix.
  - `ARCHITECTURE.md`: comprehensive architectural documentation covering current implementations and future planned modules.
  - Updated `metadata.json` and `app/layout.tsx`.

### Dependencies Installed
- `@xyflow/react` (`^12.12.0`): React Flow graph canvas foundation.
- `zustand` (`^5.0.15`): State management store.
- `vitest` (`^5.0.3` [dev]): Unit testing framework.

### Not Implemented (Strictly Deferred to Future Days)
- No interactive canvas, dragging, node palette, connection handles, or inspector.
- No relationship rules, cycle detection, validation, auto-layout, search, json export/import, or persistence modules (`src/lib/*` deferred).
- No undo/history (Zundo), Dagre, or Zod packages installed.
