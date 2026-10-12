/**
 * Pure Hierarchical Auto-Layout Engine (Day 10).
 *
 * Implements deterministic top-to-bottom layout using @dagrejs/dagre.
 *
 * Principles:
 * - Pure, deterministic, and idempotent layout calculation.
 * - Zero mutations on input nodes, edges, or node data payloads.
 * - Changes node positions ONLY; preserves IDs, types, data, selection, and edges.
 * - Safe against graph anomalies: cycles, self-loops, disconnected components,
 *   multiple roots, and missing edge endpoints.
 * - Never mutates, removes, or silently repairs the real graph.
 * - Rejects layout if input contains invalid dimensions or non-finite output coordinates.
 * - Returns detailed geometric metrics (ranks, max nodes per rank, bounding boxes, overlaps).
 */

import dagre, { graphlib } from '@dagrejs/dagre';
import type { TreeNode, TreeEdge } from '../types/tree';

export type LayoutDirection = 'TB' | 'LR' | 'BT' | 'RL';

export interface LayoutOptions {
  direction?: LayoutDirection;
  nodeWidth?: number;
  nodeHeight?: number;
  nodeSep?: number;
  rankSep?: number;
  marginX?: number;
  marginY?: number;
}

/**
 * Deterministic default layout parameters.
 * Compact 220px width aligns with CustomNode UI dimensions.
 */
export const LAYOUT_DEFAULTS = {
  direction: 'TB' as LayoutDirection,
  nodeWidth: 220,
  nodeHeight: 80,
  nodeSep: 50,
  rankSep: 80,
  marginX: 50,
  marginY: 50,
} as const;

export interface AutoLayoutBoundingBox {
  width: number;
  height: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface AutoLayoutMetrics {
  nodeCount: number;
  movedCount: number;
  ranksCount: number;
  maxNodesPerRank: number;
  overlapCount: number;
  boundingBox: AutoLayoutBoundingBox;
}

export type AutoLayoutResult =
  | {
      ok: true;
      positions: Record<string, { x: number; y: number }>;
      metrics: AutoLayoutMetrics;
      hasMoved: boolean;
    }
  | {
      ok: false;
      reason: string;
    };

/**
 * Resolves width and height for a node, preferring valid measured dimensions
 * from React Flow, falling back to node properties, and finally to defaults.
 */
export function resolveNodeDimensions(
  node: TreeNode,
  fallbackOptions?: { nodeWidth?: number; nodeHeight?: number }
): { width: number; height: number; valid: boolean } {
  let width = fallbackOptions?.nodeWidth ?? LAYOUT_DEFAULTS.nodeWidth;
  if (
    typeof node.measured?.width === 'number' &&
    Number.isFinite(node.measured.width) &&
    node.measured.width > 0
  ) {
    width = node.measured.width;
  } else if (
    typeof node.width === 'number' &&
    Number.isFinite(node.width) &&
    node.width > 0
  ) {
    width = node.width;
  }

  let height = fallbackOptions?.nodeHeight ?? LAYOUT_DEFAULTS.nodeHeight;
  if (
    typeof node.measured?.height === 'number' &&
    Number.isFinite(node.measured.height) &&
    node.measured.height > 0
  ) {
    height = node.measured.height;
  } else if (
    typeof node.height === 'number' &&
    Number.isFinite(node.height) &&
    node.height > 0
  ) {
    height = node.height;
  }

  // Reject explicitly negative, zero, or non-finite dimensions
  if (
    (typeof node.width === 'number' && (!Number.isFinite(node.width) || node.width <= 0)) ||
    (typeof node.height === 'number' && (!Number.isFinite(node.height) || node.height <= 0)) ||
    (typeof node.measured?.width === 'number' &&
      (!Number.isFinite(node.measured.width) || node.measured.width <= 0)) ||
    (typeof node.measured?.height === 'number' &&
      (!Number.isFinite(node.measured.height) || node.measured.height <= 0))
  ) {
    return { width, height, valid: false };
  }

  const valid = Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0;
  return { width, height, valid };
}

/**
 * Pure, deterministic hierarchical auto-layout function.
 *
 * Computes top-to-bottom layout coordinates without mutating any inputs.
 * Center coordinates computed by Dagre are translated to top-left React Flow coordinates
 * and rounded to integer values.
 */
export function calculateAutoLayout(
  nodes: readonly TreeNode[],
  edges: readonly TreeEdge[],
  options?: LayoutOptions
): AutoLayoutResult {
  // 1. Validation: duplicate node IDs
  const seenIds = new Set<string>();
  for (const node of nodes) {
    if (seenIds.has(node.id)) {
      return {
        ok: false,
        reason: `Duplicate node ID "${node.id}" detected in layout input`,
      };
    }
    seenIds.add(node.id);
  }

  // 2. Safe handling of empty graph: no-op with 0 metrics
  if (nodes.length === 0) {
    return {
      ok: true,
      positions: {},
      hasMoved: false,
      metrics: {
        nodeCount: 0,
        movedCount: 0,
        ranksCount: 0,
        maxNodesPerRank: 0,
        overlapCount: 0,
        boundingBox: { width: 0, height: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 },
      },
    };
  }

  // 3. Resolve and validate dimensions for all nodes
  const nodeDimensions = new Map<string, { width: number; height: number }>();
  for (const node of nodes) {
    const { width, height, valid } = resolveNodeDimensions(node, options);
    if (!valid) {
      return {
        ok: false,
        reason: `Invalid node dimensions detected for node "${node.id}" (width: ${width}, height: ${height})`,
      };
    }
    nodeDimensions.set(node.id, { width, height });
  }

  // 4. Construct fresh isolated temporary Dagre Graph
  const g = new graphlib.Graph({ multigraph: true, directed: true });
  g.setGraph({
    rankdir: options?.direction ?? LAYOUT_DEFAULTS.direction,
    nodesep: options?.nodeSep ?? LAYOUT_DEFAULTS.nodeSep,
    ranksep: options?.rankSep ?? LAYOUT_DEFAULTS.rankSep,
    marginx: options?.marginX ?? LAYOUT_DEFAULTS.marginX,
    marginy: options?.marginY ?? LAYOUT_DEFAULTS.marginY,
    acyclicer: 'greedy',
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes in original array order
  for (const node of nodes) {
    const dim = nodeDimensions.get(node.id)!;
    g.setNode(node.id, { width: dim.width, height: dim.height });
  }

  // Add edges in original array order
  // Skip invalid temporary layout inputs (missing endpoints and self-loops)
  // without mutating or altering the real edges.
  for (const edge of edges) {
    if (edge.source === edge.target) {
      // Self-loops: skip in layout calculation
      continue;
    }
    if (!seenIds.has(edge.source) || !seenIds.has(edge.target)) {
      // Missing endpoints: skip in layout calculation
      continue;
    }
    // Handle parallel edges safely via edge ID or index as multigraph edge name
    const edgeName = edge.id || `e-${edge.source}-${edge.target}-${g.edgeCount()}`;
    g.setEdge(edge.source, edge.target, {}, edgeName);
  }

  // 5. Run layout calculation synchronously
  try {
    dagre.layout(g);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      reason: `Dagre layout calculation failed: ${msg}`,
    };
  }

  // 6. Extract coordinates, convert center -> top-left, and round to integer
  const positions: Record<string, { x: number; y: number }> = {};
  let movedCount = 0;

  for (const node of nodes) {
    const dagreNode = g.node(node.id);
    if (
      !dagreNode ||
      typeof dagreNode.x !== 'number' ||
      typeof dagreNode.y !== 'number' ||
      !Number.isFinite(dagreNode.x) ||
      !Number.isFinite(dagreNode.y)
    ) {
      return {
        ok: false,
        reason: `Non-finite coordinate produced by layout engine for node "${node.id}"`,
      };
    }

    const dim = nodeDimensions.get(node.id)!;
    const leftX = Math.round(dagreNode.x - dim.width / 2);
    const topY = Math.round(dagreNode.y - dim.height / 2);

    if (!Number.isFinite(leftX) || !Number.isFinite(topY)) {
      return {
        ok: false,
        reason: `Non-finite calculated coordinate for node "${node.id}"`,
      };
    }

    positions[node.id] = { x: leftX, y: topY };
    if (leftX !== node.position.x || topY !== node.position.y) {
      movedCount++;
    }
  }

  // 7. Calculate diagnostic metrics (bounding box, ranks, overlaps)
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const rankMap = new Map<number, number>();

  for (const node of nodes) {
    const pos = positions[node.id];
    const dim = nodeDimensions.get(node.id)!;

    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + dim.width);
    maxY = Math.max(maxY, pos.y + dim.height);

    const dagreNode = g.node(node.id);
    const rank = typeof dagreNode?.rank === 'number' ? dagreNode.rank : pos.y;
    rankMap.set(rank, (rankMap.get(rank) ?? 0) + 1);
  }

  let maxNodesPerRank = 0;
  for (const count of rankMap.values()) {
    if (count > maxNodesPerRank) {
      maxNodesPerRank = count;
    }
  }

  // Geometric bounding-box overlap count (pairwise distinct node pairs)
  let overlapCount = 0;
  for (let i = 0; i < nodes.length; i++) {
    const nodeA = nodes[i];
    const posA = positions[nodeA.id];
    const dimA = nodeDimensions.get(nodeA.id)!;
    const leftA = posA.x;
    const rightA = posA.x + dimA.width;
    const topA = posA.y;
    const bottomA = posA.y + dimA.height;

    for (let j = i + 1; j < nodes.length; j++) {
      const nodeB = nodes[j];
      const posB = positions[nodeB.id];
      const dimB = nodeDimensions.get(nodeB.id)!;
      const leftB = posB.x;
      const rightB = posB.x + dimB.width;
      const topB = posB.y;
      const bottomB = posB.y + dimB.height;

      // Strict geometric intersection
      if (leftA < rightB && rightA > leftB && topA < bottomB && bottomA > topB) {
        overlapCount++;
      }
    }
  }

  const boundingBox: AutoLayoutBoundingBox = {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };

  const metrics: AutoLayoutMetrics = {
    nodeCount: nodes.length,
    movedCount,
    ranksCount: rankMap.size,
    maxNodesPerRank,
    overlapCount,
    boundingBox,
  };

  return {
    ok: true,
    positions,
    metrics,
    hasMoved: movedCount > 0,
  };
}

/**
 * Convenient alias for calculateAutoLayout.
 */
export const autoLayout = calculateAutoLayout;
