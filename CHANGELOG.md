# Changelog - Interactive Visual Tree Editor

All notable changes to this project will be documented in this file.

## [Day 5 Part 2] - 2026-10-07: Connection Hardening, Edge Reconnection & Safety

### Added
- **Safe Edge Reconnection Architecture (`src/store/treeStore.ts`, `src/lib/connectionValidation.ts`)**:
  - Implemented `reconnectEdgeConnection(oldEdge, newConnection)` with pre-mutation validation.
  - Validates proposed replacement connection BEFORE modifying or removing the existing edge, guaranteeing the original edge is never lost if reconnection is invalid.
  - Enforced `ignoreEdgeId` across duplicate checks, single-parent constraints, and cycle detection so the edge being replaced does not falsely invalidate itself.
  - Atomic replacement: on success, preserves edge ID, custom styling, and metadata while updating endpoints and `relationshipType`. On failure, produces ZERO graph mutations and surfaces clear feedback.
- **Transient Edge Selection State (`src/types/tree.ts`, `src/store/treeStore.ts`)**:
  - Added `selectedEdgeId` to transient UI state (ephemeral, not persisted, zero undo history).
  - Styled selected edges with prominent royal blue stroke (`#2563eb`), 2.5px width, and matching arrow markers.
  - Syncs with React Flow edge clicks and deselects safely on canvas pane clicks.
  - Automatic cleanup: `deleteEdge` and `setEdges` automatically clear `selectedEdgeId` if the edge no longer exists, ensuring the inspector never reads a stale or deleted edge.
- **Edge Deletion Action (`src/store/treeStore.ts`)**:
  - Added `deleteEdge(edgeId)`: deletes only the specified edge while preserving all nodes, unrelated edges, and `selectedNodeId`.
  - Keyboard shortcut: pressing `Delete` or `Backspace` deletes the selected edge.
- **Node Deletion Protection (Strict Day 6 Boundary)**:
  - Disabled node deletion across keyboard events and React Flow changes.
  - Pressing `Delete` or `Backspace` with a node selected preserves the node intact. Node deletion is strictly deferred to Day 6.
- **Input Keyboard Safety (`src/lib/keyboardSafety.ts`)**:
  - Implemented pure `isKeyboardEventTargetProtected` type guard protecting `<input>`, `<textarea>`, `<select>`, `contenteditable`, and elements inside `.nokey`.
  - Added `.nokey` class to inspector, palette sidebar, and header controls.
  - Guaranteed normal typing and backspace/delete text editing in UI controls without triggering canvas edge deletion.
- **Connection Inspector Panel (`src/components/tree/PropertiesInspectorSidebar.tsx`)**:
  - Enhanced inspector to show connection details when an edge is selected (endpoints, relationship type, edge ID).
  - Added explicit "Delete Connection" button with accessible feedback.

### Tested
- Created `src/tests/reconnectionAndEdgeSafety.test.ts` (22 unit tests):
  - Verified valid reconnection atomicity, ID preservation, and unrelated graph preservation.
  - Verified invalid reconnection zero graph mutation and original edge preservation.
  - Verified `ignoreEdgeId` behavior preventing false duplicate, false parent, and false cycle errors.
  - Verified edge selection, deletion, and `selectedEdgeId` cleanup.
  - Verified node preservation during edge deletion and node selection retention.
  - Verified malformed connection, missing node, and stale edge error safety.
  - Verified keyboard event target protection guard across inputs, editables, `.nokey` containers, and canvas elements.
- Total test suite now passes with 95 tests across 5 test suites.

## [Day 5] - 2026-10-07: Directional Parent-Child Connections & Graph Relationship Validation

### Added
- **Relationship Rules Single Source of Truth (`src/lib/relationshipRules.ts`)**:
  - Defined strict directional parent-to-child relationship policies (`Root -> Rule`, `Rule -> Condition`, `Rule -> Action`, `Condition -> Action`).
  - Prohibited invalid pairings (`Root -> Condition`, `Root -> Action`, `anything -> Root`, `Action -> anything`, `Condition -> Rule`).
  - Added pure typed helpers: `isValidParentChildRelationship`, `getAllowedChildTypes`, `getAllowedParentTypes`, `canHaveParent`, `canAcceptChild`, `getRelationshipType`.
- **Pure Graph Cycle Detection (`src/lib/cycleDetection.ts`)**:
  - Implemented `wouldCreateCycle(source, target, edges, ignoreEdgeId)` using directed reachability analysis.
  - Implemented `hasAnyCycle(edges)` topological sort algorithm for whole-graph acyclic validation.
  - Supported `ignoreEdgeId` for reconnecting existing edges without false positives.
- **Unified Connection Validator (`src/lib/connectionValidation.ts`)**:
  - Single pure validation pipeline shared across canvas drag interactions, completion handlers, and test suites.
  - Explicit failure reason codes: `'malformed'`, `'missing-node'`, `'self-link'`, `'invalid-relationship'`, `'has-parent'`, `'duplicate-edge'`, `'cycle'`.
  - Zero side effects: does not mutate graph or UI state.
- **Zustand Atomic Connection Action (`src/store/treeStore.ts`)**:
  - `addEdgeConnection(connection)`: atomicity guaranteed—zero mutations on failure, exactly one edge created with a unique stable ID on success.
- **Interactive React Flow Connection Integration (`src/components/tree/TreeCanvas.tsx`)**:
  - Enabled connectable handles on `CustomNode` (top target, bottom source) with `ConnectionMode.Strict`.
  - `isValidConnection`: Pure, live validation hook giving real-time connection feedback while dragging without triggering error toasts.
  - `onConnect`: Commits valid connections atomically to the Zustand store.
  - `onConnectEnd`: Surfaces transient feedback only when a user drops onto an invalid handle (dropping on empty canvas produces no feedback).
  - Configured directional closed arrow markers (`MarkerType.ArrowClosed`) and `interactionWidth: 20` via `defaultEdgeOptions`.
  - Added transient accessible feedback banner with auto-dismiss timer.

### Tested
- Created `src/tests/connectionValidation.test.ts` (30 unit tests):
  - Verified all 4 valid relationship pairings.
  - Verified rejection of all invalid pairings (including Root as target and Action as source).
  - Verified rejection of self-links, duplicate edges, and second parents.
  - Verified cycle detection (self-cycle, 2-node cycle, multi-hop cycle, and acyclic graphs).
  - Verified input malformation safety and missing node detection.
  - Verified Zustand atomicity and tolerance for temporary multiple Root nodes.
- Total test suite now passes with 73 unit tests across 4 test suites.

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
