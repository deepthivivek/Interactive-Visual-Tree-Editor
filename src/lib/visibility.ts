/**
 * Pure Subtree Visibility & Collapse/Expand Engine for Day 12.
 *
 * Implements:
 * - Subtree visibility calculation without destroying graph topology
 * - Hidden descendant counting for badges (`+3 hidden`)
 * - Pure toggle, collapse-all, and expand-all operations
 * - Search Reveal: automatically uncollapsing ancestor nodes so hidden search hits become visible
 *
 * All functions are pure, immutable, and side-effect free.
 */

import type { TreeNode, TreeEdge } from '../types/tree';
import { getSubtreeNodeIds } from './subtree';

export interface VisibleGraphResult {
  /** Nodes that should be rendered on canvas (marked with hidden: false or filtered) */
  visibleNodes: TreeNode[];
  /** Edges whose source and target are both visible */
  visibleEdges: TreeEdge[];
  /** Set of node IDs currently hidden under collapsed ancestors */
  hiddenNodeIds: Set<string>;
  /** Set of edge IDs currently hidden */
  hiddenEdgeIds: Set<string>;
  /** Map of collapsed node ID -> number of transitive descendants hidden under it */
  hiddenDescendantCounts: Map<string, number>;
  /** Map of node ID -> count of direct child nodes */
  directChildCounts: Map<string, number>;
}

/**
 * Computes which nodes and edges are visible based on each node's `data.collapsed` flag.
 *
 * Invariant: If node A is collapsed, ALL its transitive descendants are hidden.
 * If node B is inside node A's subtree, B and its children are hidden regardless of B's own collapsed state.
 */
export function computeVisibleGraph(
  nodes: readonly TreeNode[],
  edges: readonly TreeEdge[]
): VisibleGraphResult {
  // 1. Build adjacency maps
  const childrenMap = new Map<string, string[]>();
  const directChildCounts = new Map<string, number>();

  for (const edge of edges) {
    if (!edge.source || !edge.target) continue;
    const existing = childrenMap.get(edge.source);
    if (existing) {
      existing.push(edge.target);
    } else {
      childrenMap.set(edge.source, [edge.target]);
    }
  }

  for (const node of nodes) {
    const count = childrenMap.get(node.id)?.length ?? 0;
    directChildCounts.set(node.id, count);
  }

  // 2. Identify all collapsed nodes and their hidden descendants
  const hiddenNodeIds = new Set<string>();
  const hiddenDescendantCounts = new Map<string, number>();

  for (const node of nodes) {
    if (node.data?.collapsed) {
      // Find all strict descendants of this collapsed node
      const subtree = getSubtreeNodeIds(node.id, edges);
      // Exclude the collapsed node itself
      subtree.delete(node.id);

      hiddenDescendantCounts.set(node.id, subtree.size);

      for (const id of subtree) {
        hiddenNodeIds.add(id);
      }
    }
  }

  // 3. Mark nodes with React Flow hidden property
  const visibleNodes: TreeNode[] = [];
  for (const node of nodes) {
    const isHidden = hiddenNodeIds.has(node.id);
    if (!isHidden) {
      visibleNodes.push({
        ...node,
        hidden: false,
      });
    }
  }

  // 4. Filter visible edges
  const hiddenEdgeIds = new Set<string>();
  const visibleEdges: TreeEdge[] = [];

  for (const edge of edges) {
    if (hiddenNodeIds.has(edge.source) || hiddenNodeIds.has(edge.target)) {
      hiddenEdgeIds.add(edge.id);
    } else {
      visibleEdges.push({
        ...edge,
        hidden: false,
      });
    }
  }

  return {
    visibleNodes,
    visibleEdges,
    hiddenNodeIds,
    hiddenEdgeIds,
    hiddenDescendantCounts,
    directChildCounts,
  };
}

/**
 * Pure Toggle Collapse for a single node.
 * Flips `node.data.collapsed`.
 */
export function toggleCollapsePure(
  nodeId: string,
  nodes: readonly TreeNode[]
): {
  nodes: TreeNode[];
  toggled: boolean;
  newState?: boolean;
} {
  const target = nodes.find((n) => n.id === nodeId);
  if (!target) {
    return { nodes: [...nodes], toggled: false };
  }

  const newState = !Boolean(target.data?.collapsed);
  const nextNodes = nodes.map((node) => {
    if (node.id === nodeId) {
      return {
        ...node,
        data: {
          ...node.data,
          collapsed: newState,
        },
      };
    }
    return node;
  });

  return { nodes: nextNodes, toggled: true, newState };
}

/**
 * Pure Expand All: uncollapses every node in the graph.
 */
export function expandAllPure(nodes: readonly TreeNode[]): TreeNode[] {
  return nodes.map((node) => {
    if (node.data?.collapsed) {
      return {
        ...node,
        data: {
          ...node.data,
          collapsed: false,
        },
      };
    }
    return node;
  });
}

/**
 * Pure Collapse All: collapses all nodes that have at least one child.
 */
export function collapseAllPure(
  nodes: readonly TreeNode[],
  edges: readonly TreeEdge[]
): TreeNode[] {
  const parentIds = new Set<string>();
  for (const edge of edges) {
    if (edge.source) {
      parentIds.add(edge.source);
    }
  }

  return nodes.map((node) => {
    const hasChildren = parentIds.has(node.id);
    if (hasChildren && !node.data?.collapsed) {
      return {
        ...node,
        data: {
          ...node.data,
          collapsed: true,
        },
      };
    }
    return node;
  });
}

/**
 * Pure Search Reveal: Uncollapses all ancestor nodes of `targetNodeId`
 * so the target node becomes fully visible in the canvas viewport.
 */
export function revealNodePure(
  targetNodeId: string,
  nodes: readonly TreeNode[],
  edges: readonly TreeEdge[]
): {
  nodes: TreeNode[];
  uncollapsedNodeIds: string[];
} {
  // Collect all ancestor IDs by traversing incoming parent edges (edge.target -> edge.source)
  const ancestorIds = new Set<string>();
  let currentTarget = targetNodeId;

  // Since trees have at most 1 parent per node, walk up parents
  const visited = new Set<string>([targetNodeId]);
  const queue = [targetNodeId];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const edge of edges) {
      if (edge.target === curr && edge.source && !visited.has(edge.source)) {
        visited.add(edge.source);
        ancestorIds.add(edge.source);
        queue.push(edge.source);
      }
    }
  }

  const uncollapsedNodeIds: string[] = [];
  const nextNodes = nodes.map((node) => {
    if (ancestorIds.has(node.id) && node.data?.collapsed) {
      uncollapsedNodeIds.push(node.id);
      return {
        ...node,
        data: {
          ...node.data,
          collapsed: false,
        },
      };
    }
    return node;
  });

  return {
    nodes: nextNodes,
    uncollapsedNodeIds,
  };
}
