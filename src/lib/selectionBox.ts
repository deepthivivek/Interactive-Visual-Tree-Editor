/**
 * Pure Drag-Box Multi-Selection Geometry & Hit Testing Engine (Day 13).
 *
 * Computes whether nodes fall inside a canvas selection rectangle (rubber-band box),
 * taking into account node dimensions and flow coordinates.
 *
 * Pure, read-only, side-effect free.
 */

import type { TreeNode } from '../types/tree';

export interface SelectionBox {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

/**
 * Normalizes start and end coordinates into standard top-left/bottom-right bounding box format.
 */
export function normalizeBox(box: SelectionBox): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const x = Math.min(box.startX, box.endX);
  const y = Math.min(box.startY, box.endY);
  const width = Math.abs(box.endX - box.startX);
  const height = Math.abs(box.endY - box.startY);
  return { x, y, width, height };
}

/**
 * Determines which nodes intersect or are fully contained within a canvas selection box.
 * Assumed standard node dimensions: width = 220, height = 80.
 */
export function findNodesInSelectionBox(
  box: SelectionBox,
  nodes: readonly TreeNode[]
): string[] {
  const norm = normalizeBox(box);
  // Ignore tiny accidental clicks (threshold 5px)
  if (norm.width < 5 && norm.height < 5) {
    return [];
  }

  const boxMinX = norm.x;
  const boxMaxX = norm.x + norm.width;
  const boxMinY = norm.y;
  const boxMaxY = norm.y + norm.height;

  const matchedIds: string[] = [];

  for (const node of nodes) {
    const nx = node.position.x;
    const ny = node.position.y;
    const nw = (node.measured?.width as number) || (node.width as number) || 220;
    const nh = (node.measured?.height as number) || (node.height as number) || 80;

    const nMaxX = nx + nw;
    const nMaxY = ny + nh;

    // Check 2D bounding box intersection (AABB overlap)
    const isIntersecting =
      nx < boxMaxX &&
      nMaxX > boxMinX &&
      ny < boxMaxY &&
      nMaxY > boxMinY;

    if (isIntersecting) {
      matchedIds.push(node.id);
    }
  }

  return matchedIds;
}
