# Interactive Visual Tree Editor

A production-style interactive frontend prototype for visualizing and editing hierarchical compliance-rule structures.

---

## 1. Project Overview

The **Interactive Visual Tree Editor** is a purpose-built, high-reliability web application engineered for financial, regulatory, and policy compliance workflows. It provides an intuitive, high-performance canvas for modeling complex compliance hierarchies, governance frameworks, and decision trees. Built with strict validation, real-time cycle prevention, relationship grammar enforcement, transactional JSON import/export, and zero-data-loss local persistence.

> **Sample Compliance Template Disclaimer**: Templates including FINRA-2210, SEC-17a-4, and DISC-09 provided in this editor are sample mock structures intended solely for demonstration and prototype purposes. They do not constitute official regulatory advice, legal certification, or audited compliance policies.

---

## 2. Core Features

1. **Interactive Visual Canvas Viewport**
   - Built on `@xyflow/react` (React Flow v12) with smooth pan, zoom (0.2x to 2.0x), grid snapping, interactive background, and bounded zoom controls.
   - Dedicated canvas toolbar for Zoom In, Zoom Out, Fit View, Center Root, and Grid Toggle.

2. **Strictly Typed Node Models**
   - Four distinct node classifications with color-coded visual styling and strict connection handles:
     - **Root**: Policy hierarchy apex (dark slate). Exactly one allowed per valid tree.
     - **Rule**: Policy rule or regulatory standard branch (indigo).
     - **Condition**: Logic evaluation gate or parameter test (amber).
     - **Action**: Leaf enforcement or remediation dispatch (emerald). Cannot have child nodes.

3. **Node Palette & Drag-and-Drop Creation**
   - HTML5 drag-and-drop palette to place nodes directly onto canvas coordinates.
   - Click-to-add fallback with non-overlapping offset placement.
   - Unique UUID generation ensuring zero duplicate node IDs.

4. **Connection Validation & Single-Parent Hierarchy**
   - Centralized relationship rules (`src/lib/relationshipRules.ts`) strictly allowing:
     - `root` &rarr; `rule`
     - `rule` &rarr; `condition`, `rule` &rarr; `action`
     - `condition` &rarr; `action` (Note: Condition &rarr; Condition chaining is not permitted)
     - `action` &rarr; no outgoing connections permitted.
   - Strict single-parent enforcement: nodes reject additional incoming connections.

5. **Cycle Detection & Real-time Graph Validation**
   - Algorithmic DFS cycle detection (`src/lib/cycleDetection.ts`) prevents circular references before edge creation.
   - Visual error feedback when an invalid connection or loop is attempted.

6. **Subtree Operations & Safe Re-parenting**
   - Add Child shortcut with smart spatial positioning.
   - Duplicate Node and Subtree with deep ID regeneration and edge re-mapping.
   - Re-parenting support via reconnection handle dragging.
   - Subtree Collapse/Expand preserving hidden descendant node state without loss.
   - Subtree Copy/Paste via in-memory clipboard.

7. **Safe Node & Edge Deletion**
   - Safe keyboard deletion via `Delete` / `Backspace`.
   - Focus-aware keyboard safety guard (`src/lib/keyboardSafety.ts`): deletion is suppressed when typing in input, textarea, or contentEditable elements.
   - Choice between single-node deletion (re-parenting or orphaning children) and cascade subtree deletion.

8. **Live Properties Inspector Panel**
   - Dedicated slide-over inspector for updating node label, rule ID, severity (`low`, `medium`, `high`, `critical`), lifecycle status (`draft`, `active`, `deprecated`), parameters, tags, and notes.
   - Instant two-way synchronization with document store.

9. **Deterministic Auto-Layout Engine**
   - Powered by `@dagrejs/dagre` top-to-bottom layout algorithm.
   - Guaranteed non-overlapping node positioning and finite coordinates.
   - Benchmarked: 500-node stress graphs layout in under 450ms.
   - 1-step undoable layout operation.

10. **Search & Highlight Engine**
    - High-performance tokenized search across label, rule ID, parameters, tags, and notes.
    - Match scoring, highlighted border glow, match count indicators, and next/previous jump navigation.

11. **MiniMap & Ambient Navigation**
    - Dynamic MiniMap with node-type color-coding for orientation on large diagrams.
    - Viewport frame indicator and quick pan navigation.

12. **Deep Structural Graph Diagnostics**
    - Ambient health badge in header (`Healthy`, `X Warnings`, `X Errors`).
    - Dedicated diagnostics modal auditing: missing root, multiple roots, cycles, orphan nodes, invalid relationships, and missing metadata.
    - One-click "Inspect" jump to focus and pulse erroneous nodes on canvas.

13. **Transactional JSON v1 Import / Export**
    - Strict Zod schema validation (`src/lib/json.ts`) adhering to document format `version: 1`.
    - Prototype pollution protection (`__proto__`, `constructor` sanitization).
    - Two-phase transactional import: structural and schema errors abort cleanly with full rollback.

14. **Local Persistence Engine & Recovery**
    - Autosave with 600ms debounce to browser `localStorage` (`interactive_tree_editor_v1_store`).
    - 5 MiB UTF-8 byte payload ceiling preventing quota crashes.
    - Non-destructive corruption recovery modal: offers template reset, start blank canvas (`nodes: []`, `edges: []`), or raw JSON download.
    - Strict history isolation: undo/redo stacks are cleared on load, ensuring a fresh session baseline.

---

## 3. Technology Stack

- **Framework**: Next.js 15+ (App Router)
- **Language**: TypeScript 5 (Strict Mode, zero `any` types)
- **Styling**: Tailwind CSS v4
- **Graph Canvas**: React Flow (`@xyflow/react` v12)
- **State Management**: Zustand v5
- **Temporal History (Undo/Redo)**: Zundo v2
- **Graph Layout**: Dagre (`@dagrejs/dagre`)
- **Schema Validation**: Zod v4
- **Icons**: Lucide React
- **Animations**: Motion (`motion/react`)
- **Unit & Integration Testing**: Vitest 3

---

## 4. Architecture & State Separation

The application enforces a strict separation between **Graph Document State** and **Transient UI State**:

```
+--------------------------------------------------------------------------+
|                        Zustand Store Architecture                        |
|                                                                          |
|  +------------------------------------+  +----------------------------+  |
|  |       Graph Document State         |  |     Transient UI State     |  |
|  |     (Persisted & Undo Tracked)     |  |    (Ephemeral & Unsaved)   |  |
|  +------------------------------------+  +----------------------------+  |
|  | - nodes: TreeNode[]                |  | - selectedNodeId           |  |
|  | - edges: TreeEdge[]                |  | - selectedEdgeId           |  |
|  |                                    |  | - searchQuery              |  |
|  |                                    |  | - inspectorOpen            |  |
|  |                                    |  | - clipboard                |  |
|  |                                    |  | - contextMenu              |  |
|  |                                    |  | - deleteConfirmation       |  |
|  |                                    |  | - focusPulseNodeId         |  |
|  +------------------------------------+  +----------------------------+  |
+--------------------------------------------------------------------------+
```

- **Document State**: Only `nodes` and `edges` mutate the document. Undo/redo history is partialized exclusively to document state.
- **Transient UI State**: Selections, hover states, searches, dialog states, and context menus never trigger undo history or invoke storage writes.
- **Pure Graph Operations**: All graph transformations (`addNode`, `removeNode`, `connectNodes`, `reparentNode`, `autoLayout`) reside in pure helper functions under `src/lib/`.

---

## 5. Project Directory Structure

```
├── src/
│   ├── app/
│   │   ├── layout.tsx                     # Root application layout
│   │   ├── page.tsx                       # Landing page redirect to /tree-editor
│   │   └── tree-editor/
│   │       └── page.tsx                   # Main Tree Editor application page
│   ├── components/
│   │   └── tree/
│   │       ├── CustomNode.tsx             # Custom React Flow node component
│   │       ├── GraphDiagnosticsModal.tsx  # Deep graph audit & diagnostics dialog
│   │       ├── JsonImportExportModal.tsx  # Zod-validated JSON modal
│   │       ├── NodePalette.tsx            # Left palette for adding nodes
│   │       ├── PersistenceRecoveryModal.tsx # Safe storage recovery modal
│   │       ├── PropertiesInspectorSidebar.tsx # Right sidebar inspector
│   │       ├── ResetConfirmationModal.tsx # Confirmation for template resets
│   │       ├── TreeCanvas.tsx             # Core canvas viewport
│   │       ├── TreeCanvasArea.tsx         # Canvas wrapper with toolbar & minimap
│   │       ├── TreeContextMenu.tsx        # Context menu for nodes & pane
│   │       ├── TreeFoundationViewer.tsx   # Top navigation & action toolbar
│   │       └── TreeSearchBar.tsx          # Real-time search & match jumper
│   ├── lib/
│   │   ├── autoLayout.ts                  # Dagre hierarchical layout engine
│   │   ├── clipboard.ts                   # Subtree deep-copy & ID remapping
│   │   ├── connectionValidation.ts        # Live connection & handle rules
│   │   ├── contextMenu.ts                 # Menu position and action handlers
│   │   ├── cycleDetection.ts              # DFS cycle detection algorithm
│   │   ├── graphOperations.ts             # Pure node operations (add, dup, reparent)
│   │   ├── json.ts                        # Strict Zod schema & JSON parser
│   │   ├── keyboardSafety.ts              # Input focus detection & safety guard
│   │   ├── nodeFactory.ts                 # Typed node creation factory
│   │   ├── nodePropertyOperations.ts      # Immutable property updates
│   │   ├── nodeTypeConfig.ts              # Styling & handle configuration
│   │   ├── persistence.ts                 # Storage serialization & recovery
│   │   ├── relationshipRules.ts           # Centralized graph relationship policy
│   │   ├── search.ts                      # Tokenized search & relevance scoring
│   │   ├── subtree.ts                     # Descendant traversal & cascade delete
│   │   ├── validation.ts                  # Full structural graph auditor
│   │   └── visibility.ts                  # Subtree collapse & expand engine
│   ├── store/
│   │   └── treeStore.ts                   # Zustand store with Zundo temporal history
│   ├── tests/                             # 22 Vitest test suites (440 tests)
│   └── types/
│       └── tree.ts                        # TypeScript domain model types
├── ARCHITECTURE.md                        # Deep system architecture & design rationale
├── REQUIREMENTS.md                        # Task 4 traceability matrix & status
├── CHANGELOG.md                           # Milestone & release changelog
├── package.json                           # Dependencies and test scripts
└── tsconfig.json                          # Strict TypeScript configuration
```

---

## 6. Setup & Execution

### Prerequisites
- Node.js 20+ installed
- npm 10+ installed

### Development Server
```bash
npm install
npm run dev
```
Open [http://localhost:3000/tree-editor](http://localhost:3000/tree-editor) in your browser.

### Production Build
```bash
npm run build
npm start
```

---

## 7. Quality Checks & Verification

Run the complete verification pipeline with:

```bash
# 1. Run Vitest Unit & Integration Test Suite (440 tests)
npm test

# 2. Run ESLint Static Analysis
npm run lint

# 3. Run Strict TypeScript Compilation Check
npx tsc --noEmit

# 4. Run Production Build Verification
npm run build
```

**Quality Status**:
- **Vitest Tests**: 22 test files, 440 tests passing (0 failures).
- **ESLint**: 0 errors, 0 warnings.
- **TypeScript**: 0 type errors under `strict: true`.
- **Production Build**: Clean Next.js 15 production build.

---

## 8. JSON Document Format (`version: 1`)

The editor exports and imports structured JSON adhering strictly to `version: 1`:

```json
{
  "version": 1,
  "metadata": {
    "title": "AML Compliance Hierarchy",
    "description": "Rule structure for anti-money laundering monitoring",
    "exportedAt": "2026-10-27T20:00:00.000Z",
    "nodeCount": 4,
    "edgeCount": 3
  },
  "nodes": [
    {
      "id": "root-1",
      "type": "root",
      "position": { "x": 400, "y": 80 },
      "data": {
        "label": "Global AML Policy",
        "nodeType": "root",
        "status": "active",
        "severity": "critical",
        "tags": ["governance", "aml"],
        "parameters": {},
        "notes": "Master apex policy root"
      }
    }
  ],
  "edges": [
    {
      "id": "edge-root-rule",
      "source": "root-1",
      "target": "rule-1",
      "type": "smoothstep"
    }
  ]
}
```

---

## 9. Keyboard Shortcuts & Accessibility

| Shortcut | Scope | Action |
| :--- | :--- | :--- |
| `Delete` / `Backspace` | Canvas | Delete selected node or edge (protected when typing) |
| `Ctrl+Z` / `Cmd+Z` | Global | Undo last document mutation |
| `Ctrl+Y` / `Cmd+Shift+Z` | Global | Redo last reverted mutation |
| `Ctrl+F` / `Cmd+F` | Global | Focus search input bar |
| `Escape` | Global | Close dialogs, clear selection, dismiss context menu |
| `Ctrl+C` / `Cmd+C` | Selected Node | Copy node and subtree to in-memory clipboard |
| `Ctrl+V` / `Cmd+V` | Canvas | Paste copied subtree with fresh IDs |
| `Right Click` | Canvas / Node | Open contextual action menu |

---

## 10. Deployment URLs

- **AI Studio Dev Runtime**: `https://ais-dev-qv7ywvzxrnrtnaqdxkl2ss-309657514252.asia-southeast1.run.app`
- **AI Studio Shared Preview**: `https://ais-pre-qv7ywvzxrnrtnaqdxkl2ss-309657514252.asia-southeast1.run.app`
- **Vercel Production Deployment**: *BLOCKED / PENDING* (No external Vercel account or token configured in this environment. Deployment instructions are provided for manual release).

---

## 11. Demonstration & Walkthrough

### 2-Minute Reviewer Flow
1. **Load Canonical Template**: Click **Reset to Template** to load the canonical FINRA-2210 / SEC-17a-4 / DISC-09 mock policy structure.
2. **Explore Hierarchy**: Pan across the canvas and observe color-coded node levels (Root, Rule, Condition, Action).
3. **Inspect & Edit**: Select the `FINRA-2210` node. In the right Inspector, change severity to `Critical` and status to `Active`. Note instant visual tag update.
4. **Enforce Grammar**: Drag a connection from an `Action` node to any other node. Observe immediate rejection with warning toast (Actions cannot have children).
5. **Cycle Prevention**: Attempt to connect a child back to its parent. Observe cycle rejection.
6. **Auto-Layout**: Click **Auto-Layout** in the toolbar. Graph instantly arranges into a clean hierarchical tree.
7. **Subtree Collapse**: Click the collapse badge on `FINRA-2210`. Descendant condition and action nodes hide smoothly while preserving data. Click expand to restore.
8. **Export & Validate**: Click **JSON** &rarr; **Export**. Review pristine v1 schema with metadata.
9. **Diagnostics**: Open **Diagnostics** modal to review real-time graph audit (0 errors, 100% compliant).

---

## 12. Known Limitations & Scope Boundaries

1. **Client-Side Prototype**: All graph operations, persistence, and validations execute in the browser client. There is no remote multi-user backend database.
2. **Storage Quota**: Browser `localStorage` is subject to a 5 MiB ceiling. Graphs exceeding ~1,500 nodes should be saved using JSON Export rather than local persistence.
3. **Headless Verification**: Visual DOM rendering, CSS animations, and physical touch interactions were validated via automated test suites rather than live browser drivers.

---

## 13. Days 21–30 Plan & Submission Buffer (Plan-Only)

In accordance with the official project specification, Days 21–30 are reserved for testing, review, documentation, media assets, and submission preparation rather than introducing new product features:

- **Day 21**: Comprehensive QA and defect repair pass based on test suite findings.
- **Day 22**: Mentor and peer feedback review and ergonomic UX polish.
- **Day 23**: WCAG 2.1 AA accessibility audit, screen reader verification, and responsive layout testing.
- **Day 24**: End-to-end User Acceptance Testing (UAT) against all original Task 4 rubrics.
- **Day 25**: Documentation completion, high-resolution screenshots, and system architecture diagrams.
- **Day 26**: 2–3 minute demonstration video recording and walkthrough slide preparation.
- **Day 27**: Cross-browser verification across modern evergreen browsers (Chrome, Firefox, Safari, Edge).
- **Day 28**: Production deployment verification and clean GitHub repository release checks.
- **Day 29**: Final submission bundle validation and deliverables packaging.
- **Day 30**: Submission buffer day for final sanity checks prior to official project evaluation.
