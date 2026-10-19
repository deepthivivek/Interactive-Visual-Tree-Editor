/**
 * Pure Layout and Canvas Productivity Engine (Day 13).
 *
 * Implements:
 * - Alignment of selected nodes along horizontal or vertical axes.
 * - Even distribution of selected nodes.
 * - Bounding box calculation for subtrees or multi-node selections.
 *
 * All operations are pure, immutable, and strictly preserve graph topology.
 */

import type { TreeNode } from '../types/tree';

export type AlignmentAxis = 'top' | 'middle' | 'bottom' | 'left' | 'center' | 'right';
export type DistributionAxis = 'horizontal' | 'vertical';

export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

/**
 * Computes the 2D bounding box of a collection of nodes.
 * Default dimensions (220 x 80) assume typical node size if dimensions not measured yet.
 */
export function computeNodesBoundingBox(
  nodes: readonly TreeNode[],
  targetNodeIds?: Set<string>
): BoundingBox | null {
  const selectedNodes = targetNodeIds
    ? nodes.filter((n) => targetNodeIds.has(n.id))
    : nodes;

  if (selectedNodes.length === 0) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const n of selectedNodes) {
    const x = n.position.x;
    const y = n.position.y;
    const w = (n.measured?.width as number) || (n.width as number) || 220;
    const h = (n.measured?.height as number) || (n.height as number) || 80;

    if (x < minX) minX = x;
    if (x + w > maxX) maxX = x + w;
    if (y < minY) minY = y;
    if (y + h > maxY) maxY = y + h;
  }

  const width = Math.max(0, maxX - minX);
  const height = Math.max(0, maxY - minY);

  return {
    minX,
    maxX,
    minY,
    maxY,
    width,
    height,
    centerX: minX + width / 2,
    centerY: minY + height / 2,
  };
}

/**
 * Aligns selected nodes along a specified axis.
 * Topology and node IDs are 100% preserved.
 */
export function alignNodesPure(
  nodeIds: readonly string[],
  axis: AlignmentAxis,
  nodes: readonly TreeNode[]
): TreeNode[] {
  const targetIdSet = new Set(nodeIds);
  const targetNodes = nodes.filter((n) => targetIdSet.has(n.id));

  if (targetNodes.length <= 1) return [...nodes];

  const bbox = computeNodesBoundingBox(targetNodes);
  if (!bbox) return [...nodes];

  return nodes.map((node) => {
    if (!targetIdSet.has(node.id)) return node;

    const w = (node.measured?.width as number) || (node.width as number) || 220;
    const h = (node.measured?.height as number) || (node.height as number) || 80;

    let nextX = node.position.x;
    let nextY = node.position.y;

    switch (axis) {
      case 'left':
        nextX = bbox.minX;
        break;
      case 'center':
        nextX = Math.round(bbox.centerX - w / 2);
        break;
      case 'right':
        nextX = bbox.maxX - w;
        break;
      case 'top':
        nextY = bbox.minY;
        break;
      case 'middle':
        nextY = Math.round(bbox.centerY - h / 2);
        break;
      case 'bottom':
        nextY = bbox.maxY - h;
        break;
    }

    return {
      ...node,
      position: { x: nextX, y: nextY },
    };
  });
}

/**
 * Distributes selected nodes evenly across an axis.
 */
export function distributeNodesPure(
  nodeIds: readonly string[],
  axis: DistributionAxis,
  nodes: readonly TreeNode[]
): TreeNode[] {
  const targetIdSet = new Set(nodeIds);
  const targetNodes = nodes.filter((n) => targetIdSet.has(n.id));

  if (targetNodes.length <= 2) return [...nodes];

  // Sort nodes along the distribution axis
  const sorted = [...targetNodes].sort((a, b) =>
    axis === 'horizontal' ? a.position.x - b.position.x : a.position.y - b.position.y
  );

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const totalSpan =
    axis === 'horizontal'
      ? last.position.x - first.position.x
      : last.position.y - first.position.y;

  const step = totalSpan / (sorted.length - 1);
  const newPositions = new Map<string, { x: number; y: number }>();

  sorted.forEach((node, idx) => {
    if (axis === 'horizontal') {
      newPositions.set(node.id, {
        x: Math.round(first.position.x + idx * step),
        y: node.position.y,
      });
    } else {
      newPositions.set(node.id, {
        x: node.position.x,
        y: Math.round(first.position.y + idx * step),
      });
    }
  });

  return nodes.map((node) => {
    const updated = newPositions.get(node.id);
    if (updated) {
      return {
        ...node,
        position: updated,
      };
    }
    return node;
  });
}
