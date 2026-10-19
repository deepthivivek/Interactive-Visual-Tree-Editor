/**
 * Pure Named Checkpoints and Recovery Module (Day 13).
 *
 * Allows users to capture named graph state snapshots, compare differences,
 * and restore checkpoints atomically.
 *
 * Principles:
 * - Pure & non-destructive: creates immutable deep-cloned snapshots.
 * - Decoupled: checkpoint metadata is strictly kept outside the graph JSON schema.
 * - Undoable: restoring a checkpoint applies an atomic graph update recorded by Zundo.
 * - No backend persistence required: operates in-memory with optional local cache.
 */

import type { TreeNode, TreeEdge } from '../types/tree';

export interface GraphCheckpoint {
  id: string;
  name: string;
  createdAt: number;
  nodeCount: number;
  edgeCount: number;
  nodes: TreeNode[];
  edges: TreeEdge[];
  description?: string;
}

export interface CheckpointDiff {
  nodeCountDelta: number;
  edgeCountDelta: number;
  nodesAdded: string[];
  nodesRemoved: string[];
  edgesAdded: string[];
  edgesRemoved: string[];
  summary: string;
}

/**
 * Creates an immutable named checkpoint from the current graph state.
 */
export function createCheckpointPure(
  name: string,
  nodes: readonly TreeNode[],
  edges: readonly TreeEdge[],
  description?: string
): GraphCheckpoint {
  const cleanName = name.trim() || `Checkpoint ${new Date().toLocaleTimeString()}`;
  const id = `cp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  return {
    id,
    name: cleanName,
    createdAt: Date.now(),
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodes: JSON.parse(JSON.stringify(nodes)),
    edges: JSON.parse(JSON.stringify(edges)),
    description: description?.trim() || undefined,
  };
}

/**
 * Computes difference between the current graph and a target checkpoint.
 */
export function computeCheckpointDiff(
  currentNodes: readonly TreeNode[],
  currentEdges: readonly TreeEdge[],
  checkpoint: GraphCheckpoint
): CheckpointDiff {
  const currNodeIds = new Set(currentNodes.map((n) => n.id));
  const cpNodeIds = new Set(checkpoint.nodes.map((n) => n.id));

  const currEdgeIds = new Set(currentEdges.map((e) => e.id));
  const cpEdgeIds = new Set(checkpoint.edges.map((e) => e.id));

  const nodesAdded: string[] = [];
  const nodesRemoved: string[] = [];

  for (const n of checkpoint.nodes) {
    if (!currNodeIds.has(n.id)) {
      nodesAdded.push(n.id);
    }
  }

  for (const n of currentNodes) {
    if (!cpNodeIds.has(n.id)) {
      nodesRemoved.push(n.id);
    }
  }

  const edgesAdded: string[] = [];
  const edgesRemoved: string[] = [];

  for (const e of checkpoint.edges) {
    if (!currEdgeIds.has(e.id)) {
      edgesAdded.push(e.id);
    }
  }

  for (const e of currentEdges) {
    if (!cpEdgeIds.has(e.id)) {
      edgesRemoved.push(e.id);
    }
  }

  const nodeCountDelta = checkpoint.nodeCount - currentNodes.length;
  const edgeCountDelta = checkpoint.edgeCount - currentEdges.length;

  const parts: string[] = [];
  if (nodeCountDelta !== 0) {
    parts.push(`${nodeCountDelta > 0 ? '+' : ''}${nodeCountDelta} node(s)`);
  }
  if (edgeCountDelta !== 0) {
    parts.push(`${edgeCountDelta > 0 ? '+' : ''}${edgeCountDelta} edge(s)`);
  }

  const summary =
    parts.length > 0
      ? `Restoring will change ${parts.join(', ')}.`
      : 'Checkpoint matches current graph node and edge counts.';

  return {
    nodeCountDelta,
    edgeCountDelta,
    nodesAdded,
    nodesRemoved,
    edgesAdded,
    edgesRemoved,
    summary,
  };
}
