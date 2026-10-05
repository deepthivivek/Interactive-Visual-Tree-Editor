# Changelog - Interactive Visual Tree Editor

All notable changes to this project will be documented in this file.

## [Day 2] - 2026-10-05: Basic React Flow Canvas

### Added
- **Interactive React Flow Canvas (`src/components/tree/TreeCanvas.tsx`)**:
  - Reusable, isolated canvas component powered by `@xyflow/react`.
  - Integrates existing Zustand store nodes (`nodes`) and edges (`edges`) into the React Flow viewport.
  - Interactive canvas navigation:
    - Mouse-wheel zoom, pan, and dragging existing nodes.
    - Floating bottom toolbar with accessible controls: Zoom Out, Zoom Indicator (e.g. `100%`), Zoom In, Fit View, Reset View, and Grid Toggle.
    - Non-destructive **Reset View**: restores default viewport and zoom without modifying graph document nodes or edges.
    - Toggleable dot grid background (`Background` with `BackgroundVariant.Dots`).
    - Informational Empty State: displays `"Drag a node from the left to get started."` when zero nodes are present.
  - Integration with Day 1 shell:
    - Hosted directly in `TreeCanvasArea.tsx` inside the dominant central workspace.
    - Node selection syncs bidirectionally with `selectedNodeId` in the Zustand store and updates the right Properties Inspector.
    - Strictly preserves Day 1 application shell, navigation, header, and inspector.
  - Minimal Day 2 node representation:
    - Clean card styling with label and rule ID.
    - Invisible non-interactive handles allowing React Flow edge path calculations without exposing Day 5 connection handles.
    - Strictly deferred custom node design to Day 3.

### Tested
- Expanded unit tests in `src/tests/treeStore.test.ts` to 10 tests, adding coverage for:
  - Node position updates during canvas interaction without affecting edge structure.
  - Clearing nodes to verify empty state behavior and resetting cleanly.

## [Day 1] - 2026-10-04: Project Foundation, Core Model & Store Setup

### Added
- **Permanent Enterprise Product Architecture (Day 1 Visual Refinement)**:
  - **Top Application Header (`TreeHeader.tsx`)**: Permanent header with logo, title, subtitle, mock template chip, working reset sample data, and reserved action placeholders (Search, Validate, JSON, Theme, User).
  - **Left Application Sidebar (`NodePaletteSidebar.tsx`)**:
    - Primary Navigation: `Tree Editor` (active), `Templates` (placeholder), `Settings` (placeholder).
    - Node Palette: visual-only specifications for `Root` (purple), `Rule` (blue), `Condition` (restrained green), and `Action` (restrained orange).
  - **Central Tree Editor Workspace (`TreeCanvasArea.tsx`)**:
    - Dominant workspace area with light dot grid pattern.
    - Workspace header: "Tree Editor" / "Sample Compliance Template".
    - Directional hierarchical preview of the Sample Compliance Template (Root -> 3 Rules -> Condition & Action).
    - Floating canvas controls placeholder (Zoom in/out, 100%, Fit view, Grid, MiniMap).
    - Mock sample disclaimer.
  - **Right Properties / Inspector Sidebar (`PropertiesInspectorSidebar.tsx`)**:
    - "Node Inspector" panel with empty state ("No node selected. Select a node from the tree to view its properties.").
    - Quick Stats card: Nodes (10), Edges (9), Root (1 ✓).
    - Read-only inspection of selected node attributes.
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
