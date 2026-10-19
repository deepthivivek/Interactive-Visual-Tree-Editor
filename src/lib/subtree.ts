/**
 * Pure Subtree Operations Engine for Day 12.
 *
 * Implements pure mathematical graph traversal and subtree manipulations:
 * - Subtree traversal & descendant collection
 * - Separate Single-Node Delete vs. Delete Subtree semantics
 * - Graph Invariant Assertion
 * - Tree Document Sanitizer
 *
 * All operations are pure, immutable, and side-effect free.
 */

import type { TreeNode, TreeEdge, TreeDocument, TreeEdgeData } from '../types/tree';
import { isPolicyNodeType } from './nodeFactory';
import {
  isValidParentChildRelationship,
  getRelationshipType,
} from './relationshipRules';
import { generateUniqueEdgeId } from './graphOperations';
import {
  computeSubtreePasteRootPosition,
  offsetSubtreePositions,
} from './placement';

/**
 * Returns the set of node IDs containing `rootId` and all its transitive descendants.
 * Traverses directed parent-to-child edges (`edge.source -> edge.target`).
 * Safe against cycles (uses visited Set).
 */
export function getSubtreeNodeIds(
  rootId: string,
  edges: readonly TreeEdge[]
): Set<string> {
  const result = new Set<string>();
  if (!rootId) return result;

  result.add(rootId);
  const queue: string[] = [rootId];

  // Map source -> targets for fast BFS traversal
  const adj = new Map<string, string[]>();
  for (const edge of edges) {
    if (!edge.source || !edge.target) continue;
    const list = adj.get(edge.source);
    if (list) {
      list.push(edge.target);
    } else {
      adj.set(edge.source, [edge.target]);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = adj.get(current);
    if (children) {
      for (const childId of children) {
        if (!result.has(childId)) {
          result.add(childId);
          queue.push(childId);
        }
      }
    }
  }

  return result;
}

/**
 * Retrieves all TreeNode objects belonging to the subtree rooted at `rootId`.
 */
export function getSubtreeNodes(
  rootId: string,
  nodes: readonly TreeNode[],
  edges: readonly TreeEdge[]
): TreeNode[] {
  const subtreeIds = getSubtreeNodeIds(rootId, edges);
  return nodes.filter((node) => subtreeIds.has(node.id));
}

/**
 * Retrieves all internal TreeEdge objects where both source and target
 * belong to the given set of subtree node IDs.
 */
export function getSubtreeEdges(
  subtreeNodeIds: Set<string>,
  edges: readonly TreeEdge[]
): TreeEdge[] {
  return edges.filter(
    (edge) => subtreeNodeIds.has(edge.source) && subtreeNodeIds.has(edge.target)
  );
}

/**
 * Returns the total count of strict descendants for a given node
 * (i.e. excluding the node itself).
 */
export function getDescendantCount(
  nodeId: string,
  edges: readonly TreeEdge[]
): number {
  if (!nodeId) return 0;
  const ids = getSubtreeNodeIds(nodeId, edges);
  return Math.max(0, ids.size - 1);
}

export interface DeleteSingleNodeResult {
  ok: boolean;
  nodes: TreeNode[];
  edges: TreeEdge[];
  deletedNode?: TreeNode;
  removedEdges?: TreeEdge[];
  reason?: string;
}

/**
 * Pure Single-Node Delete Semantics.
 * Removes ONLY the target node and its directly incident edges.
 * Descendants/children are preserved in the graph as orphans / new subtrees.
 */
export function deleteSingleNodePure(
  nodeId: string,
  nodes: readonly TreeNode[],
  edges: readonly TreeEdge[]
): DeleteSingleNodeResult {
  const targetNode = nodes.find((n) => n.id === nodeId);
  if (!targetNode) {
    return {
      ok: false,
      nodes: [...nodes],
      edges: [...edges],
      reason: 'Node not found',
    };
  }

  const removedEdges = edges.filter(
    (e) => e.source === nodeId || e.target === nodeId
  );
  const nextNodes = nodes.filter((n) => n.id !== nodeId);
  const nextEdges = edges.filter(
    (e) => e.source !== nodeId && e.target !== nodeId
  );

  return {
    ok: true,
    nodes: nextNodes,
    edges: nextEdges,
    deletedNode: targetNode,
    removedEdges,
  };
}

export interface DeleteSubtreeResult {
  ok: boolean;
  nodes: TreeNode[];
  edges: TreeEdge[];
  deletedNodes?: TreeNode[];
  removedEdges?: TreeEdge[];
  reason?: string;
}

/**
 * Pure Delete Subtree Semantics.
 * Removes the target node AND all its transitive descendants.
 * Removes all edges incident to ANY deleted node.
 */
export function deleteSubtreePure(
  rootId: string,
  nodes: readonly TreeNode[],
  edges: readonly TreeEdge[]
): DeleteSubtreeResult {
  const targetNode = nodes.find((n) => n.id === rootId);
  if (!targetNode) {
    return {
      ok: false,
      nodes: [...nodes],
      edges: [...edges],
      reason: 'Subtree root node not found',
    };
  }

  const subtreeIds = getSubtreeNodeIds(rootId, edges);
  const deletedNodes = nodes.filter((n) => subtreeIds.has(n.id));
  const nextNodes = nodes.filter((n) => !subtreeIds.has(n.id));

  const removedEdges = edges.filter(
    (e) => subtreeIds.has(e.source) || subtreeIds.has(e.target)
  );
  const nextEdges = edges.filter(
    (e) => !subtreeIds.has(e.source) && !subtreeIds.has(e.target)
  );

  return {
    ok: true,
    nodes: nextNodes,
    edges: nextEdges,
    deletedNodes,
    removedEdges,
  };
}

export interface MoveSubtreeResult {
  ok: boolean;
  nodes: TreeNode[];
  edges: TreeEdge[];
  message: string;
  reason?: string;
  movedSubtreeRootId?: string;
  newParentId?: string | null;
  removedEdgeId?: string;
  newEdgeId?: string;
}

/**
 * Pure Structural Subtree Movement (Day 13).
 *
 * Reparents an entire subtree under a new parent:
 * - Preserves all subtree node IDs and payloads
 * - Preserves all internal edges and internal hierarchy topology
 * - Removes the former external parent connection
 * - Creates the new valid parent connection
 * - Rejects moving a subtree under itself or its descendants
 * - Rejects invalid hierarchy relationship grammar and cycles
 * - Adjusts subtree layout coordinates relative to new parent
 */
export function moveSubtreeStructurallyPure(
  subtreeRootId: string,
  newParentId: string | null,
  nodes: readonly TreeNode[],
  edges: readonly TreeEdge[]
): MoveSubtreeResult {
  const subtreeRoot = nodes.find((n) => n.id === subtreeRootId);
  if (!subtreeRoot) {
    return {
      ok: false,
      nodes: [...nodes],
      edges: [...edges],
      message: 'Failed to move: subtree root node not found.',
      reason: 'target-not-found',
    };
  }

  // Root node cannot be reparented under another node
  if (subtreeRoot.type === 'root' && newParentId !== null) {
    return {
      ok: false,
      nodes: [...nodes],
      edges: [...edges],
      message: 'Root nodes cannot be moved beneath other parent nodes.',
      reason: 'root-cannot-have-parent',
    };
  }

  const subtreeIds = getSubtreeNodeIds(subtreeRootId, edges);

  // Rejection check: Cannot move beneath itself or any descendant
  if (newParentId && subtreeIds.has(newParentId)) {
    return {
      ok: false,
      nodes: [...nodes],
      edges: [...edges],
      message: 'Cannot move a subtree beneath itself or any of its descendants.',
      reason: 'cycle-or-self-parenting',
    };
  }

  let newParent: TreeNode | undefined;
  if (newParentId) {
    newParent = nodes.find((n) => n.id === newParentId);
    if (!newParent) {
      return {
        ok: false,
        nodes: [...nodes],
        edges: [...edges],
        message: 'Destination parent node not found.',
        reason: 'destination-not-found',
      };
    }

    if (newParent.type === 'action') {
      return {
        ok: false,
        nodes: [...nodes],
        edges: [...edges],
        message: 'Action nodes cannot accept child connections.',
        reason: 'action-cannot-have-children',
      };
    }

    if (!isValidParentChildRelationship(newParent.type, subtreeRoot.type)) {
      return {
        ok: false,
        nodes: [...nodes],
        edges: [...edges],
        message: `Policy rule violation: "${newParent.type}" cannot be parent of "${subtreeRoot.type}".`,
        reason: 'invalid-relationship',
      };
    }
  }

  // 1. Remove existing incoming external edge to subtreeRootId
  const oldParentEdge = edges.find((e) => e.target === subtreeRootId);
  let nextEdges = edges.filter((e) => e.id !== oldParentEdge?.id);
  let newEdgeId: string | undefined;

  // 2. Add new incoming edge from newParentId if provided
  if (newParent) {
    const existingEdgeIds = new Set(nextEdges.map((e) => e.id));
    newEdgeId = generateUniqueEdgeId(newParent.id, subtreeRoot.id, existingEdgeIds);
    const relType = getRelationshipType(newParent.type, subtreeRoot.type);

    const connectingEdge: TreeEdge = {
      id: newEdgeId,
      source: newParent.id,
      target: subtreeRoot.id,
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        relationshipType: relType || undefined,
      },
    };
    nextEdges = [...nextEdges, connectingEdge];
  }

  // 3. Compute relative layout repositioning so subtree rests beneath new parent
  let nextNodes = [...nodes];
  if (newParent) {
    const targetPos = computeSubtreePasteRootPosition(
      subtreeRoot,
      nodes,
      nextEdges,
      { targetParent: newParent }
    );
    const dx = targetPos.x - subtreeRoot.position.x;
    const dy = targetPos.y - subtreeRoot.position.y;

    nextNodes = nodes.map((node) => {
      if (subtreeIds.has(node.id)) {
        return {
          ...node,
          position: {
            x: Math.round(node.position.x + dx),
            y: Math.round(node.position.y + dy),
          },
        };
      }
      return node;
    });
  }

  return {
    ok: true,
    nodes: nextNodes,
    edges: nextEdges,
    message: newParent
      ? `Subtree moved under "${newParent.data.label || newParent.id}".`
      : `Subtree disconnected as standalone hierarchy.`,
    movedSubtreeRootId: subtreeRootId,
    newParentId,
    removedEdgeId: oldParentEdge?.id,
    newEdgeId,
  };
}

export interface MoveSubtreeLayoutResult {
  ok: boolean;
  nodes: TreeNode[];
  movedCount: number;
  reason?: string;
}

/**
 * Pure Visual Subtree Layout Movement (Day 13).
 *
 * Shifts the (x, y) coordinates of every node in the subtree by (dx, dy).
 * Strictly preserves graph topology: zero edges added or removed.
 */
export function moveSubtreeLayoutPure(
  subtreeRootId: string,
  dx: number,
  dy: number,
  nodes: readonly TreeNode[],
  edges: readonly TreeEdge[]
): MoveSubtreeLayoutResult {
  const targetNode = nodes.find((n) => n.id === subtreeRootId);
  if (!targetNode) {
    return {
      ok: false,
      nodes: [...nodes],
      movedCount: 0,
      reason: 'Subtree root node not found',
    };
  }

  const subtreeIds = getSubtreeNodeIds(subtreeRootId, edges);
  const nextNodes = nodes.map((node) => {
    if (subtreeIds.has(node.id)) {
      return {
        ...node,
        position: {
          x: Math.round(node.position.x + dx),
          y: Math.round(node.position.y + dy),
        },
      };
    }
    return node;
  });

  return {
    ok: true,
    nodes: nextNodes,
    movedCount: subtreeIds.size,
  };
}

export interface GraphInvariantCheckResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates fundamental compliance tree graph invariants:
 * 1. Unique node IDs
 * 2. Unique edge IDs
 * 3. Every edge source and target exists in nodes
 * 4. No self-loops (source !== target)
 * 5. Single-parent invariant: at most 1 incoming edge per target node
 * 6. Root nodes have 0 incoming edges
 * 7. Edges obey allowed parent-child policy relationships
 */
export function assertGraphInvariants(
  nodes: readonly TreeNode[],
  edges: readonly TreeEdge[]
): GraphInvariantCheckResult {
  const errors: string[] = [];
  const nodeMap = new Map<string, TreeNode>();

  for (const node of nodes) {
    if (!node.id) {
      errors.push('Encountered node without an ID');
      continue;
    }
    if (nodeMap.has(node.id)) {
      errors.push(`Duplicate node ID detected: "${node.id}"`);
    } else {
      nodeMap.set(node.id, node);
    }
  }

  const edgeIds = new Set<string>();
  const incomingParentCount = new Map<string, number>();

  for (const edge of edges) {
    if (!edge.id) {
      errors.push('Encountered edge without an ID');
      continue;
    }
    if (edgeIds.has(edge.id)) {
      errors.push(`Duplicate edge ID detected: "${edge.id}"`);
    } else {
      edgeIds.add(edge.id);
    }

    if (edge.source === edge.target) {
      errors.push(`Self-loop detected on node "${edge.source}"`);
    }

    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);

    if (!sourceNode) {
      errors.push(`Edge "${edge.id}" references non-existent source "${edge.source}"`);
    }
    if (!targetNode) {
      errors.push(`Edge "${edge.id}" references non-existent target "${edge.target}"`);
    }

    if (sourceNode && targetNode) {
      // Check single-parent rule
      const inCount = (incomingParentCount.get(edge.target) ?? 0) + 1;
      incomingParentCount.set(edge.target, inCount);
      if (inCount > 1) {
        errors.push(
          `Single-parent violation: Node "${targetNode.data.label || targetNode.id}" has ${inCount} incoming parent edges`
        );
      }

      // Check root has no parents
      if (targetNode.type === 'root') {
        errors.push(`Root node "${targetNode.id}" cannot have an incoming parent edge`);
      }

      // Check relationship validity
      if (!isValidParentChildRelationship(sourceNode.type, targetNode.type)) {
        errors.push(
          `Invalid relationship: "${sourceNode.type}" cannot be parent of "${targetNode.type}" (edge: "${edge.id}")`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Pure Tree Document Sanitizer.
 * Validates, normalizes, and strips unrecognized or malformed properties
 * from raw JSON inputs, conforming to the version 1 schema.
 */
export function sanitizeTreeDocument(raw: unknown): {
  ok: boolean;
  document?: TreeDocument;
  errors?: string[];
} {
  const errors: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return { ok: false, errors: ['Document payload must be an object'] };
  }

  const obj = raw as Record<string, unknown>;

  if (obj.version !== 1) {
    errors.push('Document version must be 1');
  }

  if (!Array.isArray(obj.nodes)) {
    errors.push('Document must include a "nodes" array');
  }

  if (!Array.isArray(obj.edges)) {
    errors.push('Document must include an "edges" array');
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const rawNodes = obj.nodes as unknown[];
  const rawEdges = obj.edges as unknown[];

  const cleanNodes: TreeNode[] = [];
  const seenNodeIds = new Set<string>();

  for (let i = 0; i < rawNodes.length; i++) {
    const item = rawNodes[i];
    if (!item || typeof item !== 'object') {
      errors.push(`Node at index ${i} is not an object`);
      continue;
    }
    const nodeObj = item as Record<string, unknown>;
    const id = typeof nodeObj.id === 'string' && nodeObj.id.trim() ? nodeObj.id.trim() : null;
    if (!id) {
      errors.push(`Node at index ${i} is missing a valid string ID`);
      continue;
    }
    if (seenNodeIds.has(id)) {
      errors.push(`Duplicate node ID at index ${i}: "${id}"`);
      continue;
    }
    seenNodeIds.add(id);

    const type = isPolicyNodeType(nodeObj.type) ? nodeObj.type : 'rule';
    const posObj = (nodeObj.position && typeof nodeObj.position === 'object'
      ? nodeObj.position
      : {}) as Record<string, unknown>;
    const x = typeof posObj.x === 'number' && Number.isFinite(posObj.x) ? Math.round(posObj.x) : 0;
    const y = typeof posObj.y === 'number' && Number.isFinite(posObj.y) ? Math.round(posObj.y) : 0;

    const dataObj = (nodeObj.data && typeof nodeObj.data === 'object'
      ? nodeObj.data
      : {}) as Record<string, unknown>;
    const label =
      typeof dataObj.label === 'string' && dataObj.label.trim()
        ? dataObj.label.trim()
        : 'Untitled Node';

    cleanNodes.push({
      id,
      type,
      position: { x, y },
      data: {
        label,
        ruleId: typeof dataObj.ruleId === 'string' ? dataObj.ruleId : undefined,
        description: typeof dataObj.description === 'string' ? dataObj.description : undefined,
        severity:
          typeof dataObj.severity === 'string' &&
          ['info', 'low', 'medium', 'high', 'critical'].includes(dataObj.severity)
            ? (dataObj.severity as TreeNode['data']['severity'])
            : undefined,
        status:
          typeof dataObj.status === 'string' &&
          ['draft', 'active', 'deprecated', 'in_review', 'archived'].includes(dataObj.status)
            ? (dataObj.status as TreeNode['data']['status'])
            : undefined,
        collapsed: Boolean(dataObj.collapsed),
        parameters:
          dataObj.parameters && typeof dataObj.parameters === 'object'
            ? (dataObj.parameters as Record<string, string | number | boolean>)
            : undefined,
        metadata:
          dataObj.metadata && typeof dataObj.metadata === 'object'
            ? (dataObj.metadata as Record<string, string | number | boolean>)
            : undefined,
        tags: Array.isArray(dataObj.tags)
          ? dataObj.tags.filter((t): t is string => typeof t === 'string')
          : undefined,
      },
    });
  }

  const cleanEdges: TreeEdge[] = [];
  const seenEdgeIds = new Set<string>();

  for (let i = 0; i < rawEdges.length; i++) {
    const item = rawEdges[i];
    if (!item || typeof item !== 'object') {
      errors.push(`Edge at index ${i} is not an object`);
      continue;
    }
    const edgeObj = item as Record<string, unknown>;
    const id = typeof edgeObj.id === 'string' && edgeObj.id.trim() ? edgeObj.id.trim() : null;
    const source = typeof edgeObj.source === 'string' ? edgeObj.source : null;
    const target = typeof edgeObj.target === 'string' ? edgeObj.target : null;

    if (!id || !source || !target) {
      errors.push(`Edge at index ${i} is missing id, source, or target`);
      continue;
    }

    if (seenEdgeIds.has(id)) {
      errors.push(`Duplicate edge ID at index ${i}: "${id}"`);
      continue;
    }
    seenEdgeIds.add(id);

    if (!seenNodeIds.has(source) || !seenNodeIds.has(target)) {
      errors.push(`Edge "${id}" connects unknown node(s): "${source}" -> "${target}"`);
      continue;
    }

    const dataObj = (edgeObj.data && typeof edgeObj.data === 'object'
      ? edgeObj.data
      : {}) as Record<string, unknown>;

    cleanEdges.push({
      id,
      source,
      target,
      sourceHandle: typeof edgeObj.sourceHandle === 'string' ? edgeObj.sourceHandle : undefined,
      targetHandle: typeof edgeObj.targetHandle === 'string' ? edgeObj.targetHandle : undefined,
      data: {
        relationshipType:
          typeof dataObj.relationshipType === 'string'
            ? (dataObj.relationshipType as TreeEdgeData['relationshipType'])
            : undefined,
      },
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    document: {
      version: 1,
      nodes: cleanNodes,
      edges: cleanEdges,
    },
  };
}
