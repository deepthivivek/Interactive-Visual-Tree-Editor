/**
 * Pure Placement Engine for Day 12.
 *
 * Computes non-overlapping, deterministic positions for pasted nodes and subtrees:
 * - Child-attachment placement (below parent, offset from existing siblings)
 * - Canvas pane placement (at cursor position or offset from source)
 * - Relative coordinate preservation for all downstream descendant nodes
 * - Finite integer coordinate clamping
 */

import type { TreeNode, TreeEdge } from '../types/tree';

export interface PlacementOptions {
  /** Target parent node if pasting as child */
  targetParent?: TreeNode;
  /** Canvas viewport flow coordinates (e.g. from pane context menu) */
  cursorPosition?: { x: number; y: number };
  /** Fallback offset from original root position */
  defaultOffset?: { x: number; y: number };
}

/**
 * Ensures coordinates are safe, finite integers.
 */
export function clampToSafeCoordinate(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.round(value);
}

/**
 * Shifts an array of nodes by (deltaX, deltaY) immutably,
 * preserving internal geometric spacing.
 */
export function offsetSubtreePositions(
  nodes: readonly TreeNode[],
  deltaX: number,
  deltaY: number
): TreeNode[] {
  const dx = clampToSafeCoordinate(deltaX);
  const dy = clampToSafeCoordinate(deltaY);

  return nodes.map((node) => ({
    ...node,
    position: {
      x: clampToSafeCoordinate(node.position.x + dx),
      y: clampToSafeCoordinate(node.position.y + dy),
    },
  }));
}

/**
 * Computes the root position for pasting a subtree.
 */
export function computeSubtreePasteRootPosition(
  originalRoot: TreeNode,
  existingNodes: readonly TreeNode[],
  existingEdges: readonly TreeEdge[],
  options: PlacementOptions = {}
): { x: number; y: number } {
  // Case 1: Pasting as child of targetParent
  if (options.targetParent) {
    const parent = options.targetParent;
    const verticalGap = 160;
    const horizontalSpacing = 240;

    // Find siblings (other existing children of targetParent)
    const siblingIds = new Set<string>();
    for (const edge of existingEdges) {
      if (edge.source === parent.id && edge.target) {
        siblingIds.add(edge.target);
      }
    }

    const siblings = existingNodes.filter((n) => siblingIds.has(n.id));

    if (siblings.length === 0) {
      // First child: center directly below parent
      return {
        x: clampToSafeCoordinate(parent.position.x),
        y: clampToSafeCoordinate(parent.position.y + verticalGap),
      };
    } else {
      // Additional child: place to the right of the rightmost sibling
      const maxX = Math.max(...siblings.map((s) => s.position.x));
      return {
        x: clampToSafeCoordinate(maxX + horizontalSpacing),
        y: clampToSafeCoordinate(parent.position.y + verticalGap),
      };
    }
  }

  // Case 2: Pasting at explicit cursor / flow position
  if (
    options.cursorPosition &&
    Number.isFinite(options.cursorPosition.x) &&
    Number.isFinite(options.cursorPosition.y)
  ) {
    return {
      x: clampToSafeCoordinate(options.cursorPosition.x),
      y: clampToSafeCoordinate(options.cursorPosition.y),
    };
  }

  // Case 3: Canvas paste without cursor -> offset from original root
  const offsetX = options.defaultOffset?.x ?? 50;
  const offsetY = options.defaultOffset?.y ?? 50;

  let candidateX = originalRoot.position.x + offsetX;
  let candidateY = originalRoot.position.y + offsetY;

  // Collision avoidance check: if a node already exists within 20px, offset further
  const hasCollision = (x: number, y: number) =>
    existingNodes.some(
      (n) => Math.abs(n.position.x - x) < 30 && Math.abs(n.position.y - y) < 30
    );

  let attempts = 0;
  while (hasCollision(candidateX, candidateY) && attempts < 10) {
    candidateX += 40;
    candidateY += 40;
    attempts++;
  }

  return {
    x: clampToSafeCoordinate(candidateX),
    y: clampToSafeCoordinate(candidateY),
  };
}
