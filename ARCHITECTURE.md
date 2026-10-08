# System Architecture: Interactive Visual Tree Editor

This document outlines the architectural principles, component structure, state management boundaries, data models, and roadmap for the Interactive Visual Tree Editor.

---

## 1. Technical Stack Overview

### Framework & Foundations
- **Next.js 15+ (App Router)**: Server-side routing and layout rendering with client components at interactive leaves. Entry page available at `/tree-editor`.
- **TypeScript (Strict Mode)**: Comprehensive type safety across all graph models, nodes, edges, and stores. No usage of `any`.
- **Tailwind CSS (v4)**: Modern utility-first styling for cards, badges, layouts, and status indicators.
- **React Flow (`@xyflow/react`)**: Graph canvas engine for rendering interactive node nodes, handles, edges, and viewports.
- **Zustand (`zustand`)**: Lightweight client-side reactive store for graph document and transient UI state.
- **Lucide React (`lucide-react`)**: Clean, accessible, and consistent iconography.
- **Vitest (`vitest`)**: Fast unit testing framework configured via `vitest.config.ts`.

---

## 2. State Ownership & Architecture

### State Separation Principle
A strict architectural boundary divides **Graph Document State** from **Transient UI State**:

```
+-----------------------------------------------------------------------+
|                             Zustand Store                             |
|                                                                       |
|  +---------------------------------+  +----------------------------+  |
|  |      Graph / Document State     |  |     Transient UI State     |  |
|  |  (Persisted, History Tracked)   |  |   (Ephemeral, Unsaved)     |  |
|  +---------------------------------+  +----------------------------+  |
|  | - nodes: TreeNode[]             |  | - selectedNodeId           |  |
|  | - edges: TreeEdge[]             |  | - [future] searchQuery     |  |
|  |                                 |  | - [future] inspectorOpen   |  |
|  |                                 |  | - [future] clipboard       |  |
|  +---------------------------------+  +----------------------------+  |
+-----------------------------------------------------------------------+
```

1. **Graph / Document State**:
   - `nodes: TreeNode[]`
   - `edges: TreeEdge[]`
   - **Responsibility**: Represents the pure mathematical and visual graph structure. This is the only state exported to JSON, loaded from disk, and tracked by future undo/redo history.
2. **Transient UI State**:
   - `selectedNodeId: string | null`
   - **Responsibility**: Ephemeral user interaction state (which node is clicked, inspector drawer state, search query string, dragging/hovering state, clipboard).
   - **Rule**: Changing transient UI state MUST NEVER trigger an undo history entry or alter persisted document files.

---

## 3. Data Models (Implemented in Day 1)

### Typed Node Model (`src/types/tree.ts`)
Nodes strictly discriminate by four fundamental types:
- `root`: The apex of the policy tree. Exactly one root node exists in a valid completed tree.
- `rule`: Regulatory requirement or policy standard branch.
- `condition`: Logical rule evaluation criteria or parameter gate.
- `action`: Enforcement, remediation, or routing operation. Action nodes have no children.

#### Node Data Payload (`TreeNodeData`):
- `label: string` - User-visible title
- `ruleId?: string` - Regulatory identifier (e.g. `RULE-FINRA-2210`, `COND-01`)
- `description?: string` - Long-form explanation or rationale
- `severity?: NodeSeverity` - `'info' | 'low' | 'medium' | 'high' | 'critical'`
- `status?: NodeStatus` - `'draft' | 'active' | 'deprecated' | 'in_review'`
- `parameters?: Record<string, string | number | boolean>` - Configuration key-values
- `metadata?: Record<string, string | number | boolean>` - Audit tags and metadata
- `collapsed?: boolean` - Tree subtree folding flag (changes visibility, not graph topology)

### Typed Edge Model
- `TreeEdge`: React Flow compatible edge containing `source`, `target`, and `data.relationshipType` (`root-rule`, `rule-condition`, `rule-action`, `condition-action`).

---

## 4. Mock Sample Compliance Template

The application includes sample mock data labelled clearly as:
**"Sample Compliance Template"**
*(Explicit Notice: Mock sample data for testing and layout demonstration only; not official regulatory workflows).*

### Hierarchy:
```
Policy Hierarchy (Root)
├── FINRA-2210 (Rule)
│   ├── Condition: Retail Audience Count
│   └── Action: Principal Review Routing
├── SEC-17a-4 (Rule)
│   ├── Condition: Record Type Identification
│   └── Action: Store in WORM Vault
└── DISC-09 (Rule)
    ├── Condition: Missing Risk Warning
    └── Action: Inject Standard Disclaimer
```

- **Topological Integrity**:
  - Total Nodes: 10
  - Total Edges: 9
  - Root Nodes: 1 (zero incoming edges)
  - Non-Root Nodes: 9 (each with exactly 1 incoming parent edge)
  - Node IDs: Globally unique across all nodes.

---

## 5. Current Component Structure & Visual Layout Architecture (Day 1)

### Three-Zone Enterprise Visual Layout
```
Header
    ↓
┌────────────┬───────────────────────────────┬──────────────┐
│ Node       │                               │ Properties   │
│ Palette    │       Tree Canvas             │ Inspector    │
│            │                               │              │
│ Root       │       Policy Hierarchy        │ No node      │
│ Rule       │              │                │ selected     │
│ Condition  │        ┌─────┼─────┐          │              │
│ Action     │       Rule  Rule  Rule         │              │
│            │                               │              │
└────────────┴───────────────────────────────┴──────────────┘
```

1. **Header (`TreeHeader.tsx`)**:
   - Application logo, title, subtitle, sample template indicator, topological stats (10 Nodes, 9 Connections), and Reset Sample action.
2. **Left Sidebar (`NodePaletteSidebar.tsx`)**:
   - Dedicated node palette reserving space for Root, Rule, Condition, and Action nodes.
   - Day 1: Static visual placeholders only (Drag & Drop scheduled for Day 3).
3. **Center Main Canvas (`TreeCanvasArea.tsx`)**:
   - Primary workspace with subtle dot grid background and hierarchical compliance tree preview.
   - Renders Root -> Rules -> Conditions & Actions with connector branches.
   - Clicking nodes updates transient selection (`selectedNodeId`) with visible blue highlight rings.
4. **Right Sidebar (`PropertiesInspectorSidebar.tsx`)**:
   - Dedicated properties panel.
   - Day 1: Empty state ("No node selected. Select a node to view its properties") or read-only attribute inspection (live editing scheduled for Day 7).

---

## 5. Node Presentation Architecture (Implemented in Day 3)

### Shared, Framework-Independent Configuration (`src/lib/nodeTypeConfig.ts`)
To prevent hardcoded presentation logic and ensure cross-component reuse, node type presentation metadata is governed by a framework-independent module:
- **Serializability**: The configuration strictly contains primitive strings and hex color codes. React components and Lucide icon instances are NEVER stored in the configuration.
- **Icon Identifier Mapping**: Stable strings (`'root' | 'rule' | 'condition' | 'action' | 'unknown'`) are resolved in the UI layer (`CustomNode.tsx`), leaving the configuration portable for non-React contexts (e.g. export pipelines, Canvas rendering, MiniMap).
- **Static Tailwind Utilities**: All Tailwind classes are full, static strings to ensure guaranteed detection by the PostCSS/Tailwind compiler without fragile dynamic string templates.
- **Defensive Fallback**: Pure resolver `getNodeTypeConfig(type)` provides deterministic fallback to `UNKNOWN_NODE_TYPE_CONFIG` for null, undefined, or unrecognized strings without throwing runtime errors.
- **Future Reusability**: The same configuration module will drive the Node Palette (Day 4), MiniMap (Day 9+), and Properties Inspector (Day 7).

### Custom Node Component (`src/components/tree/CustomNode.tsx`)
- **Single Component Architecture**: Instead of 4 separate components, a single data-driven `CustomNode` component handles all node types dynamically based on `node.type` and `nodeTypeConfig`.
- **Compact Layout (~215px)**: Predictable dimensions preventing layout overlap and excessive canvas growth.
- **Accessibility & Discovery**: Text truncation with `title` attributes, visible focus rings (`focus-visible:ring-2`), and `aria-label` screen-reader announcements.
- **Handle Constraints (Day 3 Boundary)**: Structural target (top) and source (bottom) handles are provided to render existing sample tree edges while enforcing `isConnectable={false}` to disable manual connection creation until Day 5.

---

## 6. Node Creation & Drag-and-Drop Architecture (Implemented in Day 4)

### Pure Node Factory (`src/lib/nodeFactory.ts`)
Node instantiation logic is decoupled from React components and global stores:
- **`isPolicyNodeType(value)`**: Strict runtime type guard validating incoming drag/drop payload without unsafe type casting.
- **`createDefaultNode(type, position, existingIds)`**: Pure function constructing complete, typed `TreeNode` records with collision-resistant unique IDs (`node_${type}_${randomUUID}`).
- **Generic Defaults**: Assigns generic titles (`New Root`, `New Rule`, `New Condition`, `New Action`) without regulatory identifiers (FINRA, SEC, DISC), preserving domain extensibility.

### Drag-and-Drop Pipeline
```
NodePalette (HTML5 dragstart: 'application/reactflow')
    ↓
Canvas Drop Zone (TreeCanvas: onDragOver & onDrop)
    ↓
Runtime Type Guard (isPolicyNodeType)
    ↓
Screen-to-Flow Coordinate Conversion (screenToFlowPosition)
    ↓
Position Validity Check (Number.isFinite)
    ↓
Zustand Action (createNode)
    ↓
Pure Node Factory (createDefaultNode)
    ↓
Immutable Graph Update (nodes: [...nodes, newNode], edges: [...edges])
    ↓
Auto-Selection (selectedNodeId: newNode.id)
```

### Temporary Invalid Structures Permitted
Day 4 intentionally decouples node creation from connection and hierarchy validation. The graph may temporarily contain multiple Roots, orphan nodes, or disconnected subtrees without being rejected, allowing natural authoring prior to relationship enforcement in Day 5.

### Canonical Sample Restoration & Immutability
`loadSampleTree()` uses `structuredClone` / JSON serialization to replace the active graph with the canonical Day 1 template without mutating canonical constants or sharing object references across sessions.

---

## 7. Directional Parent-Child Connection Architecture (Implemented in Day 5)

### Relationship Rules Single Source of Truth (`src/lib/relationshipRules.ts`)
Directional grammar policy is strictly defined and decoupled from React components:
- **Direction**: `SOURCE = PARENT` (bottom handle), `TARGET = CHILD` (top handle).
- **Valid Relationships**:
  - `Root -> Rule`
  - `Rule -> Condition`
  - `Rule -> Action`
  - `Condition -> Action`
- **Prohibited Pairings**:
  - `Root -> Condition`
  - `Root -> Action`
  - `anything -> Root` (Root cannot have a parent)
  - `Action -> anything` (Action cannot have children)
  - `Condition -> Rule`
- **Pure Helpers**: `isValidParentChildRelationship`, `getAllowedChildTypes`, `getAllowedParentTypes`, `canHaveParent`, `canAcceptChild`, `getRelationshipType`.

### Pure Graph Cycle Detection (`src/lib/cycleDetection.ts`)
- **Acyclic Enforcement**: Uses directed BFS reachability to determine if `source` is reachable from `target` prior to edge creation.
- **Support for Reconnection**: Accepts `ignoreEdgeId` to evaluate modified edges without self-invalidation.
- **Zero UI Coupling**: Pure algorithmic functions with zero dependencies on React, Zustand, or the DOM.

### Shared Connection Validation Pipeline (`src/lib/connectionValidation.ts`)
Unified, side-effect-free validator returning `{ ok: true, relationshipType }` or `{ ok: false, reason, message }`:
1. Source and target input presence (`malformed`)
2. Self-link rejection (`self-link`)
3. Node existence check (`missing-node`)
4. Relationship grammar verification (`invalid-relationship`)
5. Duplicate edge check (`duplicate-edge`)
6. Single-parent hierarchy constraint (`has-parent`)
7. Cycle prevention (`cycle`)

### Connection Lifecycle in React Flow
```
User starts drag from bottom source handle
    ↓
Dragging over target handles
    ↓
isValidConnection (pure, side-effect free, styles connection line/handle)
    ↓
User releases pointer:
    ├── On Valid Target Handle:
    │   └── onConnect fires → Zustand addEdgeConnection() → atomic edge append
    ├── On Invalid Target Handle:
    │   └── onConnectEnd fires → validateConnection() → transient feedback banner
    └── On Empty Canvas:
        └── onConnectEnd fires → toNode is null → zero rejection feedback
```

### Safe Edge Reconnection (Day 5 Part 2)
```
Existing edge handle drag starts
    ↓
reconnectingEdgeIdRef.current set to existingEdge.id
    ↓
isValidConnection uses shared validator with ignoreEdgeId: existingEdge.id
    ↓
User drops connection on target handle:
    ├── Valid Reconnection:
    │   └── onReconnect fires → Zustand reconnectEdgeConnection()
    │       ├── Pre-validation before mutating original edge
    │       ├── Evaluates proposed replacement with ignoreEdgeId
    │       └── Atomic replacement in edges array preserving edge ID & custom configuration
    └── Invalid Reconnection:
        ├── Rejection feedback displayed in transient banner
        └── ZERO graph mutations (original edge remains 100% intact)
```

### Edge Selection & Deletion Safety (Day 5 Part 2)
- **Transient Selection (`selectedEdgeId`)**: Maintained in store transient state without polluting document state. Styled with royal blue stroke (`#2563eb`), 2.5px width, and matching arrow markers.
- **Atomic Edge Deletion (`deleteEdge`)**: Deletes only the targeted edge, preserving all nodes, unrelated edges, and `selectedNodeId`. Clears `selectedEdgeId` safely.
- **Node Deletion Protection (Strict Day 6 Boundary)**: Pressing `Delete` or `Backspace` on a selected node does NOT delete the node. Node deletion is strictly deferred to Day 6.
- **Input Keyboard Safety (`src/lib/keyboardSafety.ts`)**: Type guard `isKeyboardEventTargetProtected` checks `<input>`, `<textarea>`, `<select>`, `contenteditable`, and elements inside `.nokey`. Keystrokes in inputs freely edit text without triggering canvas operations.

### Multi-Root State & Validation Boundary
- **Temporary Multi-Root State**: During authoring, the editor permits multiple roots, orphan nodes, and disconnected subtrees without blocking creation.
- **Day 13 Boundary**: Whole-graph structural validation (e.g. enforcing exactly one root for a complete exportable tree) strictly belongs to Day 13.

---

## 8. Directory Structure

```
/
├── app/
│   ├── globals.css                # Global styles and Tailwind configuration
│   ├── layout.tsx                 # Root layout with app metadata
│   ├── page.tsx                   # Redirect to /tree-editor
│   └── tree-editor/
│       └── page.tsx               # Re-exporting TreeEditorPage
├── src/
│   ├── app/
│   │   └── tree-editor/
│   │       └── page.tsx           # Tree Editor page container rendering TreeWorkspace
│   ├── components/
│   │   ├── tree/
│   │   │   ├── TreeHeader.tsx                 # Header with title, toolbar controls, and Load Sample Tree (.nokey)
│   │   │   ├── NodePaletteSidebar.tsx         # Left sidebar hosting navigation and NodePalette (.nokey)
│   │   │   ├── NodePalette.tsx                # HTML5 draggable node palette
│   │   │   ├── TreeCanvasArea.tsx             # Center workspace: hierarchical tree canvas preview
│   │   │   ├── TreeCanvas.tsx                 # React Flow interactive canvas with connections, reconnection, and keyboard safety
│   │   │   ├── CustomNode.tsx                 # Reusable data-driven custom node component with connectable handles
│   │   │   ├── PropertiesInspectorSidebar.tsx # Right sidebar: node & connection inspector (.nokey)
│   │   │   ├── TreeWorkspace.tsx              # Three-zone enterprise layout container
│   │   │   └── TreeFoundationViewer.tsx       # Retained foundation diagnostic component
│   │   └── ui/
│   │       └── badge.tsx          # Reusable type/severity/status badge
│   ├── lib/
│   │   ├── nodeTypeConfig.ts          # Shared framework-independent node presentation metadata
│   │   ├── nodeFactory.ts             # Pure node creation factory and runtime type guard
│   │   ├── relationshipRules.ts       # Relationship rules policy single source of truth
│   │   ├── cycleDetection.ts          # Pure graph cycle detection algorithms
│   │   ├── connectionValidation.ts    # Unified connection validation pipeline
│   │   ├── keyboardSafety.ts          # Pure keyboard event target protection guard and resolver
│   │   ├── graphOperations.ts         # Pure centralized graph operations (add child, duplicate, delete, reparent)
│   │   ├── labelUtils.ts              # Pure label deduplication and sequencing utility
│   │   └── statusTimer.ts             # Status message auto-dismiss timer manager
│   ├── store/
│   │   └── treeStore.ts           # Zustand store with document vs transient separation
│   ├── types/
│   │   └── tree.ts                # TypeScript strict interfaces and types
│   └── tests/
│       ├── treeStore.test.ts              # Unit tests for tree model and state separation
│       ├── nodeTypeConfig.test.ts         # Unit tests for shared node presentation configuration
│       ├── nodeFactoryAndCreation.test.ts # Unit tests for factory, creation, and immutability
│       ├── connectionValidation.test.ts   # Unit tests for relationships, cycles, and connections
│       ├── reconnectionAndEdgeSafety.test.ts # Unit tests for safe edge reconnection, deletion, and keyboard guard
│       └── nodeOperationsDay6.test.ts     # Unit tests for Day 6 node operations, reparenting, and timers
├── vitest.config.mjs              # Vitest runner configuration
├── REQUIREMENTS.md                # Requirements traceability matrix
├── CHANGELOG.md                   # Chronological development log
└── ARCHITECTURE.md                # Architecture and design documentation
```

---

## 9. Planned Modules (Strictly Deferred to Future Days)

The following pure-function business logic modules will reside under `src/lib/` and must remain completely decoupled from React components:

1. **`src/lib/relationshipRules.ts`**:
   - **Responsibility**: Single source of truth for allowed connection rules (`Root -> Rule`, `Rule -> Condition`, `Rule -> Action`, `Condition -> Action`).
   - Prevents invalid connections, self-links, multi-parents, and disallowed type pairings.
2. **`src/lib/cycleDetection.ts`**:
   - **Responsibility**: Pure graph cycle detection algorithms (DFS / topological sort) preventing cycles before edges are committed.
3. **`src/lib/validation.ts`**:
   - **Responsibility**: Comprehensive tree validation engine inspecting root cardinality, single parentage, orphan subtrees, and field completeness.
4. **`src/lib/autoLayout.ts`**:
   - **Responsibility**: Deterministic hierarchical layout engine (via Dagre) computing optimal (x, y) coordinates for nodes and clean routing for edges.
5. **`src/lib/search.ts`**:
   - **Responsibility**: Pure search and filter index matching labels, rule IDs, descriptions, and metadata.
6. **`src/lib/json.ts`**:
   - **Responsibility**: Document import/export serialization and deserialization with strict JSON schema validation (`{"version": 1, "nodes": [], "edges": []}`).
7. **`src/lib/persistence.ts`**:
   - **Responsibility**: LocalStorage manager storing document and settings (excluding transient UI state and undo history).

---

## 7. Future Feature Roadmap

- **Interactive Canvas & Custom Nodes**: React Flow canvas integration with custom handles and status-colored nodes.
- **Drag-and-Drop Node Palette**: Draggable node types from a side panel onto the canvas.
- **Undo / Redo History (Zundo)**: `zundo` middleware partialized to `nodes` and `edges` only. Transient selection will produce 0 undo steps.
- **Subtree Collapse & Expand**: Toggling `node.data.collapsed` to dynamically hide child branches without destroying graph relationships or reporting phantom orphans.
- **Properties Inspector**: Live property editing drawer for rule IDs, descriptions, parameters, and tags.
- **MiniMap & Viewport Navigator**: Visual bird's-eye canvas navigation.
