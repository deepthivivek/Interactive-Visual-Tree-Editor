import type { Node, Edge } from '@xyflow/react';

/**
 * Node types supported in the visual tree editor.
 * Strict type discrimination for compliance policy trees.
 */
export type NodeType = 'root' | 'rule' | 'condition' | 'action';

/**
 * Node severity level classification.
 */
export type NodeSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

/**
 * Node lifecycle and governance status.
 */
export type NodeStatus = 'draft' | 'active' | 'deprecated' | 'in_review' | 'archived';

/**
 * Typed parameters dictionary for rule execution or evaluation.
 */
export type NodeParameters = Record<string, string | number | boolean>;

/**
 * Typed metadata dictionary for audit and configuration tags.
 */
export type NodeMetadata = Record<string, string | number | boolean>;

/**
 * Core node data payload interface.
 * Matches all required fields: label, ruleId, description, severity,
 * parameters, metadata, tags, status, and collapsed.
 */
export interface TreeNodeData extends Record<string, unknown> {
  label: string;
  ruleId?: string;
  description?: string;
  severity?: NodeSeverity;
  parameters?: NodeParameters;
  metadata?: NodeMetadata;
  tags?: string[];
  status?: NodeStatus;
  collapsed?: boolean;
  [key: string]: unknown;
}

/**
 * Typed React Flow Node for the tree editor.
 */
export type TreeNode = Node<TreeNodeData, NodeType>;

/**
 * Edge metadata payload.
 */
export interface TreeEdgeData extends Record<string, unknown> {
  label?: string;
  relationshipType?: 'root-rule' | 'rule-condition' | 'rule-action' | 'condition-action';
  [key: string]: unknown;
}

/**
 * Typed React Flow Edge for the tree editor.
 */
export type TreeEdge = Edge<TreeEdgeData>;

/**
 * Pure Graph Document structure (for export/import and persistence).
 * Strictly contains only nodes and edges.
 */
export interface TreeDocument {
  version: 1;
  nodes: TreeNode[];
  edges: TreeEdge[];
}

/**
 * Transient UI State (never stored in undo history or document persistence).
 */
export interface TreeUiState {
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  deleteConfirmation: {
    nodeId: string;
    incidentEdgeCount: number;
    isRoot: boolean;
    descendantCount?: number;
  } | null;
  addChildChoiceOpen: boolean;
  statusFeedback: string | null;
  clipboard: import('../lib/clipboard').SubtreeClipboardData | null;
  nodeContextMenu: import('../lib/contextMenu').NodeContextMenuState | null;
  paneContextMenu: import('../lib/contextMenu').PaneContextMenuState | null;
}

/**
 * Combined Store State separating graph document state from transient UI state.
 */
export interface TreeStoreState {
  // Graph / Document State
  nodes: TreeNode[];
  edges: TreeEdge[];

  // Transient UI State
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  deleteConfirmation: {
    nodeId: string;
    incidentEdgeCount: number;
    isRoot: boolean;
    descendantCount?: number;
  } | null;
  addChildChoiceOpen: boolean;
  statusFeedback: string | null;
  focusPulseNodeId: string | null;
  searchQuery: string;
  matchingNodeIds: Set<string>;
  clipboard: import('../lib/clipboard').SubtreeClipboardData | null;
  nodeContextMenu: import('../lib/contextMenu').NodeContextMenuState | null;
  paneContextMenu: import('../lib/contextMenu').PaneContextMenuState | null;

  // Day 13 Advanced Enhancements State
  selectedSubtreeRootId: string | null;
  selectedNodeIds: string[];
  checkpoints: import('../lib/checkpoints').GraphCheckpoint[];
  auditLog: import('../lib/operationAudit').OperationAuditEntry[];

  // Actions
  setNodes: (nodes: TreeNode[]) => void;
  setEdges: (edges: TreeEdge[]) => void;
  setSelectedNodeId: (nodeId: string | null) => void;
  setSelectedEdgeId: (edgeId: string | null) => void;
  clearSelection: () => void;
  setFocusPulseNodeId: (id: string | null) => void;
  setSearchQueryAndMatches: (query: string, matches: Set<string>) => void;
  createNode: (type: NodeType, position: { x: number; y: number }) => TreeNode | null;
  addEdgeConnection: (connection: {
    source?: string | null;
    target?: string | null;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  }) => { ok: boolean; message?: string; reason?: string; edge?: TreeEdge };
  reconnectEdgeConnection: (
    oldEdge: TreeEdge | { id: string } | null | undefined,
    newConnection: {
      source?: string | null;
      target?: string | null;
      sourceHandle?: string | null;
      targetHandle?: string | null;
    } | null | undefined
  ) => { ok: boolean; message?: string; reason?: string; edge?: TreeEdge };
  deleteEdge: (edgeId: string) => boolean;

  // Day 6 Node Operations
  addChild: (
    parentId: string,
    childType: NodeType
  ) => { ok: boolean; newChild?: TreeNode; newEdge?: TreeEdge; message?: string; reason?: string };
  duplicateNode: (
    nodeId: string
  ) => { ok: boolean; duplicatedNode?: TreeNode; message?: string; reason?: string };
  requestDeleteNode: (nodeId: string) => void;
  confirmDeleteNode: (mode?: 'single' | 'subtree') => boolean;
  cancelDeleteNode: () => void;
  reparentNode: (
    nodeId: string,
    newParentId: string | null
  ) => { ok: boolean; message?: string; reason?: string; noop?: boolean };
  disconnectNode: (nodeId: string) => boolean;
  setAddChildChoiceOpen: (open: boolean) => void;
  setStatusFeedback: (message: string | null) => void;

  // Day 7 Node Property Editing Actions
  updateNodeData: (nodeId: string, updates: Partial<TreeNodeData>) => boolean;
  updateNodeParameter: (
    nodeId: string,
    key: string,
    value: string | number | boolean,
    oldKey?: string
  ) => boolean;
  deleteNodeParameter: (nodeId: string, key: string) => boolean;
  addNodeTag: (nodeId: string, tag: string) => boolean;
  removeNodeTag: (nodeId: string, tag: string) => boolean;
  updateNodeMetadata: (
    nodeId: string,
    key: string,
    value: string | number | boolean,
    oldKey?: string
  ) => boolean;
  deleteNodeMetadata: (nodeId: string, key: string) => boolean;

  // Day 8 History, Drag Transactions & Batch Operations
  startNodeDrag: () => void;
  stopNodeDrag: () => void;
  cancelNodeDrag: () => void;
  applyGraphBatch: (batch: { nodes?: TreeNode[]; edges?: TreeEdge[] }) => boolean;
  deleteSubtree: (nodeId: string) => boolean;
  reconcileSelection: () => void;
  undo: (steps?: number) => void;
  redo: (steps?: number) => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  getHistoryDepth: () => { past: number; future: number };

  loadSampleTree: () => void;
  resetToSampleData: () => void;

  // Day 10 Hierarchical Auto-Layout
  applyAutoLayout: (options?: import('../lib/autoLayout').LayoutOptions) => {
    ok: boolean;
    movedCount?: number;
    noop?: boolean;
    message?: string;
    reason?: string;
    metrics?: import('../lib/autoLayout').AutoLayoutMetrics;
  };

  // Day 12 Subtree Operations, Clipboard, Collapse/Expand, & Context Menu Actions
  copySubtree: (rootId?: string) => boolean;
  pasteSubtree: (
    targetParentId?: string | null,
    options?: { cursorPosition?: { x: number; y: number } }
  ) => { ok: boolean; message: string; pastedCount?: number; newRootId?: string };
  duplicateSubtree: (rootId?: string) => {
    ok: boolean;
    message: string;
    duplicatedRootId?: string;
  };
  toggleNodeCollapse: (nodeId: string) => boolean;
  expandAllSubtrees: () => void;
  collapseAllSubtrees: () => void;
  revealNode: (nodeId: string) => void;
  deleteSingleNode: (nodeId: string) => boolean;
  setNodeContextMenu: (menu: import('../lib/contextMenu').NodeContextMenuState | null) => void;
  setPaneContextMenu: (menu: import('../lib/contextMenu').PaneContextMenuState | null) => void;
  closeAllContextMenus: () => void;

  // Day 13 Advanced Subtree Selection, Movement, Checkpoints, & Productivity
  setSelectedSubtreeRootId: (nodeId: string | null) => void;
  moveSubtreeStructurally: (
    subtreeRootId: string,
    newParentId: string | null
  ) => { ok: boolean; message: string; reason?: string };
  moveSubtreeLayout: (
    subtreeRootId: string,
    dx: number,
    dy: number
  ) => { ok: boolean; movedCount: number; message: string };
  alignSelectedNodes: (
    nodeIds: string[],
    axis: import('../lib/layoutProductivity').AlignmentAxis
  ) => boolean;
  distributeSelectedNodes: (
    nodeIds: string[],
    axis: import('../lib/layoutProductivity').DistributionAxis
  ) => boolean;
  createCheckpoint: (name: string, description?: string) => import('../lib/checkpoints').GraphCheckpoint;
  restoreCheckpoint: (checkpointId: string) => boolean;
  deleteCheckpoint: (checkpointId: string) => boolean;
  appendAuditEntry: (
    operationType: string,
    status: 'confirmed' | 'rejected' | 'cancelled',
    affectedNodeIds: string[],
    affectedEdgeIds: string[],
    options?: {
      validationSummaryBefore?: string;
      validationSummaryAfter?: string;
      notes?: string;
    }
  ) => void;
  setSelectedNodeIds: (nodeIds: Set<string> | string[]) => void;
  toggleNodeSelection: (nodeId: string, additive?: boolean) => void;
  copySelectedNodes: () => boolean;
  deleteSelectedNodes: () => boolean;
}
