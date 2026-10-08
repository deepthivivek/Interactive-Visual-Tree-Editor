/**
 * Pure Graph Operations for Day 6 Node Operations.
 *
 * Implements centralized graph mutations and queries:
 * - Add Child
 * - Duplicate Node
 * - Delete Node
 * - Re-parent Node
 * - Disconnect Node
 * - Valid Parent Candidates resolution
 *
 * All operations are pure, immutable, and return typed results with zero side-effects.
 */

import type { TreeNode, TreeEdge, NodeType, TreeEdgeData } from '../types/tree';
import { createDefaultNode, generateUniqueNodeId } from './nodeFactory';
import {
  canAcceptChild,
  isValidParentChildRelationship,
  getRelationshipType,
} from './relationshipRules';
import { validateConnection } from './connectionValidation';
import { wouldCreateCycle } from './cycleDetection';
import { generateDuplicateLabel } from './labelUtils';

/**
 * Standard failure reason codes for Day 6 graph operations.
 */
export type GraphOperationReason =
  | 'missing-node'
  | 'missing-parent'
  | 'invalid-relationship'
  | 'action-cannot-have-children'
  | 'root-cannot-have-parent'
  | 'has-parent'
  | 'duplicate-edge'
  | 'cycle'
  | 'self-link'
  | 'malformed'
  | 'injection-failure';

export interface GraphOperationResult<T = unknown> {
  ok: boolean;
  nodes: TreeNode[];
  edges: TreeEdge[];
  reason?: GraphOperationReason;
  message?: string;
  noop?: boolean;
  data?: T;
}

/**
 * Generates a unique edge ID according to the project convention:
 * `e-${source}-${target}-${uniqueSuffix}`.
 */
export function generateUniqueEdgeId(
  source: string,
  target: string,
  existingEdgeIds: Set<string>
): string {
  let candidate: string;
  let attempts = 0;
  do {
    const uniqueSuffix =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).substring(2, 8);
    candidate = `e-${source}-${target}-${uniqueSuffix}`;
    attempts++;
  } while (existingEdgeIds.has(candidate) && attempts < 100);
  return candidate;
}

/**
 * Returns all incident edges connected to a node (both incoming and outgoing).
 */
export function getNodeIncidentEdges(
  nodeId: string,
  edges: readonly TreeEdge[]
): TreeEdge[] {
  return edges.filter((e) => e.source === nodeId || e.target === nodeId);
}

// ============================================================================
// 1. ADD CHILD
// ============================================================================

export interface AddChildDependencies {
  createNodeFn?: (
    type: NodeType,
    position: { x: number; y: number },
    existingIds: Set<string>
  ) => TreeNode | null;
  createEdgeIdFn?: (
    source: string,
    target: string,
    existingEdgeIds: Set<string>
  ) => string | null;
  validateConnectionFn?: typeof validateConnection;
}

export interface AddChildResultData {
  newChild: TreeNode;
  newEdge: TreeEdge;
}

/**
 * Executes a pure Add Child graph operation with dependency injection support for failure testing.
 *
 * Atomicity guarantee:
 * - If node creation fails, edges preparation fails, or connection validation fails:
 *   returns ok: false, and nodes/edges references remain 100% reference-equal to original inputs.
 */
export function executeAddChild(
  parentId: string,
  childType: NodeType,
  nodes: readonly TreeNode[],
  edges: readonly TreeEdge[],
  deps: AddChildDependencies = {}
): GraphOperationResult<AddChildResultData> {
  const parentNode = nodes.find((n) => n.id === parentId);
  if (!parentNode) {
    return {
      ok: false,
      nodes: nodes as TreeNode[],
      edges: edges as TreeEdge[],
      reason: 'missing-parent',
      message: 'Parent node does not exist in the graph.',
    };
  }

  if (!canAcceptChild(parentNode.type)) {
    return {
      ok: false,
      nodes: nodes as TreeNode[],
      edges: edges as TreeEdge[],
      reason: 'action-cannot-have-children',
      message: 'Action nodes cannot have children.',
    };
  }

  if (!isValidParentChildRelationship(parentNode.type, childType)) {
    return {
      ok: false,
      nodes: nodes as TreeNode[],
      edges: edges as TreeEdge[],
      reason: 'invalid-relationship',
      message: `Invalid relationship: ${parentNode.type} cannot connect to ${childType}.`,
    };
  }

  // Calculate layout position for new child below parent
  const existingChildrenEdges = edges.filter((e) => e.source === parentId);
  const siblingCount = existingChildrenEdges.length;
  const childPosition = {
    x: parentNode.position.x + (siblingCount > 0 ? (siblingCount % 2 === 0 ? 120 : -120) * siblingCount : 0),
    y: parentNode.position.y + 160,
  };

  // 1. Prepare Node
  const existingNodeIds = new Set(nodes.map((n) => n.id));
  const nodeFactory =
    deps.createNodeFn ??
    ((type, pos, ids) => createDefaultNode(type, pos, ids));

  const newChild = nodeFactory(childType, childPosition, existingNodeIds);
  if (!newChild) {
    return {
      ok: false,
      nodes: nodes as TreeNode[],
      edges: edges as TreeEdge[],
      reason: 'injection-failure',
      message: 'Failed to create child node.',
    };
  }

  // 2. Prepare Edge ID
  const existingEdgeIds = new Set(edges.map((e) => e.id));
  const edgeIdGenerator = deps.createEdgeIdFn ?? generateUniqueEdgeId;
  const newEdgeId = edgeIdGenerator(parentId, newChild.id, existingEdgeIds);
  if (!newEdgeId) {
    return {
      ok: false,
      nodes: nodes as TreeNode[],
      edges: edges as TreeEdge[],
      reason: 'injection-failure',
      message: 'Failed to generate unique edge ID.',
    };
  }

  // 3. Validate Proposed Connection
  const validator = deps.validateConnectionFn ?? validateConnection;
  const validation = validator(
    { source: parentId, target: newChild.id },
    [...nodes, newChild],
    edges
  );

  if (!validation.ok) {
    return {
      ok: false,
      nodes: nodes as TreeNode[],
      edges: edges as TreeEdge[],
      reason: validation.reason,
      message: validation.message,
    };
  }

  const relationshipType: NonNullable<TreeEdgeData['relationshipType']> =
    validation.relationshipType ??
    (getRelationshipType(parentNode.type, childType) || 'root-rule');

  const newEdge: TreeEdge = {
    id: newEdgeId,
    source: parentId,
    target: newChild.id,
    type: 'smoothstep',
    data: {
      relationshipType,
    },
  };

  return {
    ok: true,
    nodes: [...nodes, newChild],
    edges: [...edges, newEdge],
    data: {
      newChild,
      newEdge,
    },
  };
}

// ============================================================================
// 2. DUPLICATE NODE
// ============================================================================

export interface DuplicateNodeResultData {
  duplicatedNode: TreeNode;
}

/**
 * Executes a pure Duplicate Node operation.
 *
 * Rules:
 * - Has a unique node ID.
 * - Deep-copies nested parameters and metadata.
 * - Preserves node type, status, severity, and description.
 * - Preserves ruleId unchanged (duplicate ruleIds are evaluated in Day 13).
 * - Has NO copied edges.
 * - Position offset (+30px, +30px).
 * - Label uses suffixing: "X" -> "X (copy)", "X (copy)" -> "X (copy 2)", skipping collisions.
 */
export function executeDuplicateNode(
  nodeId: string,
  nodes: readonly TreeNode[],
  edges: readonly TreeEdge[]
): GraphOperationResult<DuplicateNodeResultData> {
  const original = nodes.find((n) => n.id === nodeId);
  if (!original) {
    return {
      ok: false,
      nodes: nodes as TreeNode[],
      edges: edges as TreeEdge[],
      reason: 'missing-node',
      message: 'Node to duplicate does not exist.',
    };
  }

  const existingNodeIds = new Set(nodes.map((n) => n.id));
  const newId = generateUniqueNodeId(original.type, existingNodeIds);

  const existingLabels = nodes.map((n) => n.data.label);
  const newLabel = generateDuplicateLabel(original.data.label, existingLabels);

  // Deep copy parameters and metadata
  const clonedParameters = original.data.parameters
    ? JSON.parse(JSON.stringify(original.data.parameters))
    : {};
  const clonedMetadata = original.data.metadata
    ? JSON.parse(JSON.stringify(original.data.metadata))
    : {};

  const duplicatedNode: TreeNode = {
    id: newId,
    type: original.type,
    position: {
      x: original.position.x + 30,
      y: original.position.y + 30,
    },
    data: {
      ...original.data,
      label: newLabel,
      ruleId: original.data.ruleId, // Retained unchanged as specified
      parameters: clonedParameters,
      metadata: clonedMetadata,
      collapsed: false,
    },
  };

  return {
    ok: true,
    nodes: [...nodes, duplicatedNode],
    edges: edges as TreeEdge[], // Zero copied edges
    data: {
      duplicatedNode,
    },
  };
}

// ============================================================================
// 3. DELETE NODE
// ============================================================================

export interface DeleteNodeResultData {
  deletedNode: TreeNode;
  removedEdges: TreeEdge[];
}

/**
 * Executes confirmed or immediate node deletion.
 *
 * Rules:
 * - Removes the target node and all incident edges atomically.
 * - Does NOT delete descendants (descendants survive as orphans).
 * - Root deletion may leave zero roots.
 */
export function executeDeleteNode(
  nodeId: string,
  nodes: readonly TreeNode[],
  edges: readonly TreeEdge[]
): GraphOperationResult<DeleteNodeResultData> {
  const targetNode = nodes.find((n) => n.id === nodeId);
  if (!targetNode) {
    return {
      ok: false,
      nodes: nodes as TreeNode[],
      edges: edges as TreeEdge[],
      reason: 'missing-node',
      message: 'Node to delete does not exist.',
    };
  }

  const removedEdges = edges.filter((e) => e.source === nodeId || e.target === nodeId);
  const nextNodes = nodes.filter((n) => n.id !== nodeId);
  const nextEdges = edges.filter((e) => e.source !== nodeId && e.target !== nodeId);

  return {
    ok: true,
    nodes: nextNodes,
    edges: nextEdges,
    data: {
      deletedNode: targetNode,
      removedEdges,
    },
  };
}

// ============================================================================
// 4. RE-PARENT NODE & DISCONNECT
// ============================================================================

export interface ReparentNodeResultData {
  newEdge?: TreeEdge;
  removedEdge?: TreeEdge;
}

/**
 * Pure re-parenting execution.
 *
 * Rules:
 * - If newParentId === null: Disconnects current parent (if any). If already disconnected, no-op.
 * - If newParentId === currentParent: No-op.
 * - Root cannot have a parent.
 * - Action cannot have children.
 * - Replaces current parent edge atomically while preserving the node and descendants.
 * - Generates replacement edge ID conforming to `e-${source}-${target}-${uniqueSuffix}`.
 */
export function executeReparentNode(
  nodeId: string,
  newParentId: string | null,
  nodes: readonly TreeNode[],
  edges: readonly TreeEdge[]
): GraphOperationResult<ReparentNodeResultData> {
  const childNode = nodes.find((n) => n.id === nodeId);
  if (!childNode) {
    return {
      ok: false,
      nodes: nodes as TreeNode[],
      edges: edges as TreeEdge[],
      reason: 'missing-node',
      message: 'Child node does not exist in graph.',
    };
  }

  if (childNode.type === 'root') {
    return {
      ok: false,
      nodes: nodes as TreeNode[],
      edges: edges as TreeEdge[],
      reason: 'root-cannot-have-parent',
      message: 'Root nodes cannot have a parent.',
    };
  }

  const currentParentEdge = edges.find((e) => e.target === nodeId);

  // CASE 1: Disconnect (newParentId === null)
  if (newParentId === null) {
    if (!currentParentEdge) {
      // Already disconnected: no-op
      return {
        ok: true,
        noop: true,
        nodes: nodes as TreeNode[],
        edges: edges as TreeEdge[],
      };
    }

    const nextEdges = edges.filter((e) => e.id !== currentParentEdge.id);
    return {
      ok: true,
      noop: false,
      nodes: nodes as TreeNode[],
      edges: nextEdges,
      data: {
        removedEdge: currentParentEdge,
      },
    };
  }

  // CASE 2: Selecting current parent is a no-op
  if (currentParentEdge && currentParentEdge.source === newParentId) {
    return {
      ok: true,
      noop: true,
      nodes: nodes as TreeNode[],
      edges: edges as TreeEdge[],
    };
  }

  const newParentNode = nodes.find((n) => n.id === newParentId);
  if (!newParentNode) {
    return {
      ok: false,
      nodes: nodes as TreeNode[],
      edges: edges as TreeEdge[],
      reason: 'missing-parent',
      message: 'Selected parent node does not exist.',
    };
  }

  // Validate proposed replacement connection, ignoring the existing parent edge
  const validation = validateConnection(
    { source: newParentId, target: nodeId },
    nodes,
    edges,
    { ignoreEdgeId: currentParentEdge?.id }
  );

  if (!validation.ok) {
    return {
      ok: false,
      nodes: nodes as TreeNode[],
      edges: edges as TreeEdge[],
      reason: validation.reason,
      message: validation.message,
    };
  }

  const existingEdgeIds = new Set(edges.map((e) => e.id));
  if (currentParentEdge) {
    existingEdgeIds.delete(currentParentEdge.id);
  }
  const newEdgeId = generateUniqueEdgeId(newParentId, nodeId, existingEdgeIds);

  const newEdge: TreeEdge = {
    id: newEdgeId,
    source: newParentId,
    target: nodeId,
    type: 'smoothstep',
    data: {
      relationshipType: validation.relationshipType,
    },
  };

  let nextEdges: TreeEdge[];
  if (currentParentEdge) {
    // Replace old parent edge atomically
    nextEdges = edges.map((e) => (e.id === currentParentEdge.id ? newEdge : e));
  } else {
    // Node was previously an orphan/disconnected child: append new edge
    nextEdges = [...edges, newEdge];
  }

  return {
    ok: true,
    noop: false,
    nodes: nodes as TreeNode[],
    edges: nextEdges,
    data: {
      newEdge,
      removedEdge: currentParentEdge,
    },
  };
}

// ============================================================================
// 5. VALID PARENT CANDIDATES
// ============================================================================

const TYPE_SORT_ORDER: Record<NodeType, number> = {
  root: 0,
  rule: 1,
  condition: 2,
  action: 3,
};

/**
 * Resolves and sorts all valid parent candidates for a selected node.
 *
 * Rules:
 * - Root nodes have zero valid parents (returns []).
 * - Excludes self-parenting.
 * - Excludes candidates violating relationship rules.
 * - Excludes candidates that would introduce a cycle (ignoring current parent edge).
 * - Sorted by Type (Root -> Rule -> Condition -> Action), then label, then ID.
 */
export function getValidParentCandidates(
  selectedNode: TreeNode | null | undefined,
  nodes: readonly TreeNode[],
  edges: readonly TreeEdge[]
): TreeNode[] {
  if (!selectedNode || selectedNode.type === 'root') {
    return [];
  }

  const currentParentEdge = edges.find((e) => e.target === selectedNode.id);

  const candidates = nodes.filter((candidate) => {
    // Exclude self
    if (candidate.id === selectedNode.id) {
      return false;
    }

    // Action cannot have children
    if (!canAcceptChild(candidate.type)) {
      return false;
    }

    // Relationship grammar
    if (!isValidParentChildRelationship(candidate.type, selectedNode.type)) {
      return false;
    }

    // Cycle prevention: adding candidate -> selectedNode would cycle if selectedNode reaches candidate
    if (wouldCreateCycle(candidate.id, selectedNode.id, edges, currentParentEdge?.id)) {
      return false;
    }

    return true;
  });

  // Sort by Root, Rule, Condition, Action, then label, then ID
  return candidates.sort((a, b) => {
    const typeDiff = TYPE_SORT_ORDER[a.type] - TYPE_SORT_ORDER[b.type];
    if (typeDiff !== 0) return typeDiff;

    const labelDiff = a.data.label.localeCompare(b.data.label);
    if (labelDiff !== 0) return labelDiff;

    return a.id.localeCompare(b.id);
  });
}
