# Changelog - Interactive Visual Tree Editor

All notable changes to this project will be documented in this file.

## [Day 4] - 2026-10-06: Node Palette, HTML5 Drag-and-Drop & Centralized Node Creation

### Added
- **Node Factory & Pure Business Logic (`src/lib/nodeFactory.ts`)**:
  - `isPolicyNodeType(value)`: Strict runtime type guard validating incoming drag/drop payload without unsafe type casting.
  - `createDefaultNode(type, position, existingIds)`: Pure node construction factory generating complete, typed node payloads with collision-resistant unique IDs (`node_${type}_${randomUUID}`).
  - Generic non-regulatory labels (`New Root`, `New Rule`, `New Condition`, `New Action`) preventing hardcoded domain couplings.
- **Node Palette Component (`src/components/tree/NodePalette.tsx`)**:
  - Dedicated draggable palette displaying Root, Rule, Condition, and Action items.
  - Reuses shared `nodeTypeConfig` for labels, descriptions, badges, and styling.
  - Clear drag affordances (`GripVertical` icon, `cursor-grab active:cursor-grabbing`, `draggable`).
  - Native HTML5 drag-and-drop integration storing `'application/reactflow'`.
- **Canvas Drop Handling (`src/components/tree/TreeCanvas.tsx`)**:
  - Canvas drop listener converting screen coordinates via React Flow's `screenToFlowPosition({ x, y })`.
  - Position validation checking finite numeric coordinates before mutating graph state.
  - Centralized creation dispatch via Zustand store `createNode(type, position)`.
  - Automatic selection of newly created nodes (`selectedNodeId`).
  - Screen-reader accessible live status announcements (`aria-live="polite"`).
- **Zustand Store Actions (`src/store/treeStore.ts`)**:
  - `createNode(type, position)`: Centralized store action ensuring immutable graph updates (`nodes = N + 1`, `edges = E`).
  - `loadSampleTree()`: Canonical sample loader replacing graph state using deep clones of the canonical template, preventing shared-reference mutation.
  - Permitted temporary invalid structures (multiple roots, disconnected nodes) by decoupling creation from later validation rules.
- **Header Action Update (`src/components/tree/TreeHeader.tsx`)**:
  - Connected "Load Sample Tree" action button to `loadSampleTree()`.

### Tested
- Created `src/tests/nodeFactoryAndCreation.test.ts` (19 unit tests):
  - Verified runtime type guard acceptance and rejection.
  - Verified pure factory output, typed defaults, and collision prevention.
  - Verified Zustand `createNode` immutable updates and auto-selection.
  - Verified support for temporary multi-root structures.
  - Verified canonical sample tree immutability and idempotent restoration.
  - Verified invalid type and coordinate rejection without graph mutation.
- Total test suite now passes with 43 unit tests across 3 test suites.

## [Day 3] - 2026-10-06: Custom Node Components & Shared Node Type Configuration

### Added
- **Shared Node Type Configuration (`src/lib/nodeTypeConfig.ts`)**:
  - Framework-independent and serializable single source of truth for node presentation metadata.
  - Pure, deterministic resolver `getNodeTypeConfig(type)` with safe neutral fallback for unexpected runtime types.
  - Complete concrete color palettes (primary, background, border, text, accent) for future MiniMap and SVG export compatibility.
  - Full static Tailwind class mappings avoiding dynamic string interpolation.
  - Pure status presentation resolver `getNodeStatusConfig(status)` supporting `active`, `in_review`, `draft`, and `deprecated`.
  - Serializable icon identifiers (`'root' | 'rule' | 'condition' | 'action' | 'unknown'`) decoupled from React component instances.
- **Custom Node Component (`src/components/tree/CustomNode.tsx`)**:
  - Memoized React Flow custom node component (`CustomNode`) driving all 4 node types (Root, Rule, Condition, Action) dynamically.
  - Distinct iconography via Lucide React (`Layers`, `Shield`, `GitBranch`, `Zap`, `CircleHelp`).
  - Standardized compact width (~215px) for consistent, predictable hierarchical alignment.
  - Professional card layout: styled top header with icon and uppercase type badge, status indicator dot, readable title with line clamping, and monospace rule identifier.
  - Accessible interaction states: Default, Hover, Selected (border + focus ring + elevation), and visible Keyboard Focus (`focus-visible:ring-2`).
  - Structural Top (target) and Bottom (source) React Flow handles enabling smoothstep edges for the sample compliance hierarchy while strictly enforcing `isConnectable={false}` to disable manual connection creation until Day 5.
- **Canvas Integration**:
  - Registered `CustomNode` in `src/components/tree/TreeCanvas.tsx` for `root`, `rule`, `condition`, and `action`.
  - Preserved bidirectional node selection, viewport zoom/pan, fit-view, and background dot grid.

### Tested
- Created `src/tests/nodeTypeConfig.test.ts` (12 unit tests):
  - Verified accurate resolution for Root, Rule, Condition, Action.
  - Verified defensive neutral fallback for unknown, empty, null, and undefined types without throwing.
  - Verified color completeness and Tailwind static class integrity for future MiniMap reuse.
  - Verified strict JSON serializability (no React components or functions stored).
  - Verified status presentation resolution and fallback behavior.
- Total test suite now passes with 24 unit tests across 2 test suites.

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
