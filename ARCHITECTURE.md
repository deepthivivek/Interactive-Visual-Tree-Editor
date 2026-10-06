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

## 6. Directory Structure

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
│   │   │   ├── TreeHeader.tsx                 # Header with title and toolbar controls
│   │   │   ├── NodePaletteSidebar.tsx         # Left sidebar: static node palette
│   │   │   ├── TreeCanvasArea.tsx             # Center workspace: hierarchical tree canvas preview
│   │   │   ├── TreeCanvas.tsx                 # React Flow interactive canvas with navigation toolbar
│   │   │   ├── CustomNode.tsx                 # Reusable data-driven custom node component
│   │   │   ├── PropertiesInspectorSidebar.tsx # Right sidebar: read-only inspector / empty state
│   │   │   ├── TreeWorkspace.tsx              # Three-zone enterprise layout container
│   │   │   └── TreeFoundationViewer.tsx       # Retained foundation diagnostic component
│   │   └── ui/
│   │       └── badge.tsx          # Reusable type/severity/status badge
│   ├── lib/
│   │   └── nodeTypeConfig.ts      # Shared framework-independent node presentation metadata
│   ├── store/
│   │   └── treeStore.ts           # Zustand store with document vs transient separation
│   ├── types/
│   │   └── tree.ts                # TypeScript strict interfaces and types
│   └── tests/
│       ├── treeStore.test.ts      # Unit tests for tree model and state separation
│       └── nodeTypeConfig.test.ts # Unit tests for shared node presentation configuration
├── vitest.config.mjs              # Vitest runner configuration
├── REQUIREMENTS.md                # Requirements traceability matrix
├── CHANGELOG.md                   # Chronological development log
└── ARCHITECTURE.md                # Architecture and design documentation
```

---

## 6. Planned Modules (Strictly Deferred to Future Days)

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
