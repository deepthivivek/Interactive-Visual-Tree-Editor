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
export type NodeStatus = 'draft' | 'active' | 'deprecated' | 'in_review';

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
 * parameters, metadata, status, and collapsed.
 */
export interface TreeNodeData extends Record<string, unknown> {
  label: string;
  ruleId?: string;
  description?: string;
  severity?: NodeSeverity;
  parameters?: NodeParameters;
  metadata?: NodeMetadata;
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

  // Actions
  setNodes: (nodes: TreeNode[]) => void;
  setEdges: (edges: TreeEdge[]) => void;
  setSelectedNodeId: (nodeId: string | null) => void;
  setSelectedEdgeId: (edgeId: string | null) => void;
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
  loadSampleTree: () => void;
  resetToSampleData: () => void;
}
