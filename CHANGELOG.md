# Changelog

All notable changes to the **Interactive Visual Tree Editor** project are documented in this file.

---

## [Day 20] - 2026-10-27: Final Release Candidate Hardening & Demo Readiness
### Completed
- **Official Task 4 Compliance Verification**: Verified full functional coverage against all 23 core requirements of Task 4.
- **Sample Compliance Template Disclaimers**: Added explicit non-regulatory, non-certified disclaimer badges to all mock templates (FINRA-2210, SEC-17a-4, DISC-09) in UI and documentation.
- **Comprehensive Documentation**:
  - Authored `/README.md` with required production-style description, complete feature inventory, architecture diagram, setup and execution guides, test commands, and demo script.
  - Expanded `/ARCHITECTURE.md` with sections on Subtree Operations, Advanced Search, Transactional JSON v1 Schema, End-to-End Safety, and ADRs.
  - Finalized `/REQUIREMENTS.md` traceability matrix with explicit verification methods, status (`PASS` / `BLOCKED`), and environment limitations.
- **Verification Pipeline**:
  - 100% green test suite: 22 Vitest test files with 440 passing tests.
  - 0 ESLint errors and warnings.
  - 0 TypeScript compiler errors under strict configuration.
  - Clean Next.js 15 production build with optimized static bundle output.

---

## [Day 19] - 2026-10-27: Comprehensive Quality Assurance & Regression Safety
### Completed
- **Full-Graph Diagnostics & Invariant Auditing**: Extended verification of single-parent constraint, cycle detection, orphan isolation, and metadata presence.
- **Edge Reconnection Safety**: Hardened atomic reconnection in `src/lib/connectionValidation.ts` ensuring zero partial mutations on failed handle connections.
- **Stress & Benchmark Verification**: Added performance benchmark suite verifying 500-node Dagre layout execution in under 450ms.
- **Traceability Matrix**: Established initial `REQUIREMENTS.md` mapping all functional requirements to source code and tests.

---

## [Day 18] - 2026-10-27: Accessibility & Keyboard Safety Hardening
### Completed
- **Input Shielding Guard (`src/lib/keyboardSafety.ts`)**: Implemented `isKeyboardEventTargetProtected` to protect `<input>`, `<textarea>`, and `contentEditable` fields from accidental canvas shortcut triggers.
- **ARIA & Contrast Enhancements**: Added appropriate ARIA labels, roles, and focus rings to palette items, modal action buttons, and canvas controls.
- **Screen Reader Navigation**: Formatted inspector form fields and modal dialogs for accessible keyboard tab traversal.

---

## [Day 17] - 2026-10-27: End-to-End Regression & User Workflows
### Completed
- **Context Menu Integration**: Added right-click contextual menus for canvas pane and nodes with automatic viewport edge clamping.
- **Subtree Copy / Paste Pipeline**: Implemented deep-copy with recursive UUID regeneration and internal edge re-mapping (`src/lib/clipboard.ts`).
- **Regression Suites**: Added full workflow tests verifying Create &rarr; Connect &rarr; Edit &rarr; Validate &rarr; Export &rarr; Import &rarr; Undo/Redo cycles.

---

## [Day 16] - 2026-10-27: Local Persistence, Recovery & Autosave
### Completed
- **LocalStorage Integration (`src/lib/persistence.ts`)**: Added autosave with 600ms debounce to `interactive_tree_editor_v1_store`.
- **Storage Quota & Payload Guard**: Implemented 5 MiB ceiling check (`MAX_PERSISTENCE_BYTES`) to prevent browser storage failures.
- **Zero-Data-Loss Corruption Recovery**: Created `PersistenceRecoveryModal` with options to restore template, start empty, or download raw corrupted JSON payload.
- **Clean Session Baseline**: Decoupled temporal undo/redo history from storage; loading persisted state automatically clears undo history.

---

## [Day 15] - 2026-10-27: Transactional JSON v1 Schema & Rollback
### Completed
- **Strict Zod Schema (`src/lib/json.ts`)**: Built schema validator enforcing document `version: 1`, non-empty IDs, and coordinate numbers.
- **Prototype Pollution Defense**: Sanitized payloads against `__proto__` and constructor manipulation.
- **Two-Phase Transactional Import**: Integrated atomic validation; syntax or graph semantic failures trigger immediate rollback with zero document mutation.

---

## [Day 14] - 2026-10-27: Advanced Diagnostics & Ambient Health
### Completed
- **Ambient Health Badge**: Real-time health chip in foundation viewer indicating Healthy, Warnings, or Errors.
- **Diagnostics Modal (`src/components/tree/GraphDiagnosticsModal.tsx`)**: Deep inspection interface listing rule violations, severity filters, and one-click "Inspect" camera centering.

---

## [Day 13] - 2026-10-27: Advanced Search & Tokenized Highlighting
### Completed
- **Multi-Field Search Engine (`src/lib/search.ts`)**: Tokenized search over label, rule ID, parameters, tags, and notes with priority scoring.
- **Ambient Canvas Highlighting**: Glowing amber aura on matching nodes with next/previous jumper navigation.

---

## [Day 12] - 2026-10-27: Subtree Collapse & Expand
### Completed
- **Visibility Engine (`src/lib/visibility.ts`)**: Prunes collapsed subtrees from React Flow rendering without mutating the underlying graph model.
- **Descendant Badges**: Dynamic `+N` count indicators showing the number of hidden downstream nodes.

---

## [Day 11] - 2026-10-27: MiniMap & Canvas Navigation Controls
### Completed
- **React Flow MiniMap**: Color-coded node mini-map overview with viewport bounds.
- **Canvas Navigation Toolbar**: Fit View, Reset View, Zoom In/Out, and Grid Toggle controls.

---

## [Day 10] - 2026-10-27: Hierarchical Auto-Layout Engine
### Completed
- **Dagre Integration (`src/lib/autoLayout.ts`)**: Deterministic top-to-bottom layout algorithm guaranteeing zero node overlaps.
- **Atomic Undo**: Single-step undo entry restoring all nodes to pre-layout coordinates.

---

## [Day 9] - 2026-10-27: Node Re-parenting & Deletion Safety
### Completed
- **Safe Reconnection**: Live reconnection validation preventing multi-parent assignments and cyclic loops.
- **Cascade Deletion**: Modal choice between deleting single node (with child orphaning/re-parenting) or cascade subtree removal.

---

## [Day 8] - 2026-10-27: Undo / Redo Temporal State
### Completed
- **Zundo Middleware**: Integrated temporal tracking on Zustand store.
- **History Partialization**: Filtered out transient UI states (selections, search query, dialogs) so only genuine document modifications are recorded.

---

## [Day 7] - 2026-10-27: Live Properties Inspector
### Completed
- **Sidebar Inspector**: Real-time property editing for node label, rule ID, severity, lifecycle status, tags, and key-value parameters.
- **Immutable Updates**: State mutations dispatched through `updateNodeData` with instant canvas card reflection.

---

## [Day 6] - 2026-10-27: Add Child & Node Duplication
### Completed
- **Graph Operations (`src/lib/graphOperations.ts`)**: Pure functions for `addChildNode` and `duplicateNode` with automatic offset positioning and edge linking.

---

## [Day 5] - 2026-10-27: Cycle Detection & Validation
### Completed
- **DFS Cycle Detection (`src/lib/cycleDetection.ts`)**: Prevents circular paths across directional compliance edges.
- **Connection Feedback**: Toast notifications and visual cues for rejected edge connections.

---

## [Day 4] - 2026-10-27: Node Palette & Drag-and-Drop
### Completed
- **HTML5 Drag-and-Drop Palette**: Visual card dragging onto React Flow canvas coordinates.
- **Node Factory (`src/lib/nodeFactory.ts`)**: Default metadata and UUID generation for new nodes.

---

## [Day 3] - 2026-10-27: Relationship Rules Enforcement
### Completed
- **Centralized Relationship Rules (`src/lib/relationshipRules.ts`)**: Enforced formal hierarchy rules (`root` &rarr; `rule` &rarr; `condition`/`action`).
- **Single-Parent Constraint**: Prevented multiple incoming edges on all non-root nodes.

---

## [Day 2] - 2026-10-27: Custom Canvas Node Components
### Completed
- **Custom React Flow Nodes (`src/components/tree/CustomNode.tsx`)**: Custom cards with color-coded headers, status pills, handles, and selection states.

---

## [Day 1] - 2026-10-27: Project Initialization & Data Models
### Completed
- **Next.js 15 Foundation**: Set up App Router, TypeScript strict mode, and Tailwind CSS v4.
- **Domain Models (`src/types/tree.ts`)**: Defined typed node definitions for `root`, `rule`, `condition`, and `action`.
- **Zustand Store**: Initialized state management separating document graph state from transient UI state.
