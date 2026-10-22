/**
 * Pure Subtree Clipboard Engine for Day 12.
 *
 * Implements:
 * - Subtree clipboard snapshot extraction with deep cloning
 * - Strict graph size quota check (MAX_GRAPH_NODES = 500)
 * - Fresh unique ID generation for nodes and internal edges
 * - Edge endpoint remapping
 * - Label incrementing for pasted root (" (Copy)")
 * - Smart placement and internal layout preservation
 * - Attachment to parent with intelligent fallback if relationship is invalid
 *
 * All operations are pure, immutable, and side-effect free.
 */

import type { TreeNode, TreeEdge, TreeEdgeData, NodeType } from '../types/tree';
import { generateUniqueNodeId } from './nodeFactory';
import { generateUniqueEdgeId } from './graphOperations';
import { getSubtreeNodeIds, getSubtreeNodes, getSubtreeEdges } from './subtree';
import {
  computeSubtreePasteRootPosition,
  offsetSubtreePositions,
} from './placement';
import {
  isValidParentChildRelationship,
  getRelationshipType,
} from './relationshipRules';

function getRelationshipReason(parentType: NodeType, childType: NodeType): string {
  if (parentType === 'action') return 'Action nodes cannot accept child nodes.';
  if (childType === 'root') return 'Root nodes cannot have a parent.';
  return `${parentType} nodes cannot connect to ${childType} nodes.`;
}

export const MAX_GRAPH_NODES = 500;

export interface SubtreeClipboardData {
  version: 1;
  rootNodeId: string;
  nodes: TreeNode[];
  edges: TreeEdge[];
  copiedAt: number;
}

/**
 * Creates a standalone, deep-cloned clipboard snapshot of a node and its entire subtree.
 */
export function createSubtreeClipboardSnapshot(
  rootId: string,
  nodes: readonly TreeNode[],
  edges: readonly TreeEdge[]
): {
  ok: boolean;
  data?: SubtreeClipboardData;
  reason?: string;
} {
  const rootNode = nodes.find((n) => n.id === rootId);
  if (!rootNode) {
    return { ok: false, reason: 'Target node does not exist' };
  }

  const subtreeIds = getSubtreeNodeIds(rootId, edges);
  const subtreeNodes = getSubtreeNodes(rootId, nodes, edges);
  const subtreeEdges = getSubtreeEdges(subtreeIds, edges);

  if (subtreeNodes.length > MAX_GRAPH_NODES) {
    return {
      ok: false,
      reason: `Subtree exceeds maximum limit of ${MAX_GRAPH_NODES} nodes`,
    };
  }

  // Deep clone to ensure total detachment from existing graph objects
  const clonedNodes: TreeNode[] = JSON.parse(JSON.stringify(subtreeNodes));
  const clonedEdges: TreeEdge[] = JSON.parse(JSON.stringify(subtreeEdges));

  return {
    ok: true,
    data: {
      version: 1,
      rootNodeId: rootId,
      nodes: clonedNodes,
      edges: clonedEdges,
      copiedAt: Date.now(),
    },
  };
}

export interface PasteSubtreeOptions {
  cursorPosition?: { x: number; y: number };
  defaultOffset?: { x: number; y: number };
}

export interface PasteSubtreeResult {
  ok: boolean;
  nodes: TreeNode[];
  edges: TreeEdge[];
  newRootId?: string;
  newPastedNodeIds?: string[];
  pastedCount?: number;
  attached?: boolean;
  message?: string;
  reason?: string;
}

/**
 * Pure Subtree Paste Execution.
 *
 * Rules:
 * 1. Checks 500-node graph limit.
 * 2. Remaps all node IDs and edge endpoints to brand new unique IDs.
 * 3. Appends " (Copy)" to the root node's label.
 * 4. Positions the pasted subtree preserving internal relative geometry.
 * 5. Attempts parent attachment if targetParentId is specified.
 * 6. Attachment Fallback: If parent attachment violates relationship rules,
 *    pastes as an independent tree without corrupting or failing the graph.
 */
export function pasteSubtreePure(
  clipboard: SubtreeClipboardData,
  targetParentId: string | null,
  nodes: readonly TreeNode[],
  edges: readonly TreeEdge[],
  options: PasteSubtreeOptions = {}
): PasteSubtreeResult {
  if (!clipboard || !Array.isArray(clipboard.nodes) || clipboard.nodes.length === 0) {
    return {
      ok: false,
      nodes: [...nodes],
      edges: [...edges],
      reason: 'Clipboard is empty',
      message: 'No subtree in clipboard to paste.',
    };
  }

  // 1. Quota Enforcement: Limit graph to MAX_GRAPH_NODES
  const incomingCount = clipboard.nodes.length;
  if (nodes.length + incomingCount > MAX_GRAPH_NODES) {
    return {
      ok: false,
      nodes: [...nodes],
      edges: [...edges],
      reason: 'quota-exceeded',
      message: `Cannot paste: Graph limit of ${MAX_GRAPH_NODES} nodes would be exceeded (${nodes.length} existing + ${incomingCount} incoming).`,
    };
  }

  const existingNodeIds = new Set(nodes.map((n) => n.id));
  const existingEdgeIds = new Set(edges.map((e) => e.id));

  // 2. ID Remapping dictionary
  const idMap = new Map<string, string>();
  for (const node of clipboard.nodes) {
    const newId = generateUniqueNodeId(node.type, existingNodeIds);
    existingNodeIds.add(newId);
    idMap.set(node.id, newId);
  }

  const oldRootNode =
    clipboard.nodes.find((n) => n.id === clipboard.rootNodeId) ?? clipboard.nodes[0];
  const newRootId = idMap.get(oldRootNode.id)!;

  // 3. Compute New Root Position & Relative Subtree Coordinates
  const targetParent = targetParentId
    ? nodes.find((n) => n.id === targetParentId)
    : undefined;

  const placementRootPos = computeSubtreePasteRootPosition(
    oldRootNode,
    nodes,
    edges,
    {
      targetParent,
      cursorPosition: options.cursorPosition,
      defaultOffset: options.defaultOffset,
    }
  );

  const deltaX = placementRootPos.x - oldRootNode.position.x;
  const deltaY = placementRootPos.y - oldRootNode.position.y;

  // 4. Construct New Nodes with remapped IDs and positions
  const newNodes: TreeNode[] = clipboard.nodes.map((node) => {
    const isRoot = node.id === oldRootNode.id;
    const remappedId = idMap.get(node.id)!;

    const label = isRoot
      ? `${node.data.label || 'Node'} (Copy)`
      : node.data.label;

    return {
      ...node,
      id: remappedId,
      position: {
        x: Math.round(node.position.x + deltaX),
        y: Math.round(node.position.y + deltaY),
      },
      data: {
        ...node.data,
        label,
        // Reset collapse state on pasted copy for immediate visibility
        collapsed: false,
      },
      selected: false,
    };
  });

  // 5. Construct New Internal Edges with remapped source and target
  const newEdges: TreeEdge[] = [];
  for (const edge of clipboard.edges) {
    const newSource = idMap.get(edge.source);
    const newTarget = idMap.get(edge.target);

    if (newSource && newTarget) {
      const newEdgeId = generateUniqueEdgeId(newSource, newTarget, existingEdgeIds);
      existingEdgeIds.add(newEdgeId);

      newEdges.push({
        ...edge,
        id: newEdgeId,
        source: newSource,
        target: newTarget,
        data: edge.data ? { ...edge.data } : undefined,
      });
    }
  }

  // 6. Attachment Logic & Fallback
  let attached = false;
  let connectingEdge: TreeEdge | null = null;
  let feedbackMessage = `Subtree pasted (${incomingCount} node${incomingCount > 1 ? 's' : ''}).`;

  if (targetParent) {
    const newRoot = newNodes.find((n) => n.id === newRootId)!;
    const isRelationshipValid = isValidParentChildRelationship(targetParent.type, newRoot.type);

    if (isRelationshipValid) {
      const edgeId = generateUniqueEdgeId(targetParent.id, newRootId, existingEdgeIds);
      existingEdgeIds.add(edgeId);

      const relType = getRelationshipType(targetParent.type, newRoot.type);
      connectingEdge = {
        id: edgeId,
        source: targetParent.id,
        target: newRootId,
        sourceHandle: 'bottom',
        targetHandle: 'top',
        data: {
          relationshipType: relType as TreeEdgeData['relationshipType'],
        },
      };
      attached = true;
      feedbackMessage = `Subtree attached to "${targetParent.data.label || targetParent.id}" (${incomingCount} node${incomingCount > 1 ? 's' : ''}).`;
    } else {
      const reason = getRelationshipReason(targetParent.type, newRoot.type);
      feedbackMessage = `Pasted as independent tree: ${reason}`;
    }
  }

  const finalEdges = connectingEdge
    ? [...edges, ...newEdges, connectingEdge]
    : [...edges, ...newEdges];

  return {
    ok: true,
    nodes: [...nodes, ...newNodes],
    edges: finalEdges,
    newRootId,
    newPastedNodeIds: newNodes.map((n) => n.id),
    pastedCount: incomingCount,
    attached,
    message: feedbackMessage,
  };
}
