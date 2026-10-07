import type { TreeNode, TreeEdge, TreeEdgeData } from '../types/tree';
import {
  isValidParentChildRelationship,
  canHaveParent,
  canAcceptChild,
  getAllowedChildTypes,
  getRelationshipType,
} from './relationshipRules';
import { wouldCreateCycle, type EdgeConnectionLike } from './cycleDetection';

/**
 * Standard failure reason codes for connection validation.
 */
export type ConnectionValidationReason =
  | 'malformed'
  | 'missing-node'
  | 'self-link'
  | 'invalid-relationship'
  | 'has-parent'
  | 'duplicate-edge'
  | 'cycle';

/**
 * Representation of a proposed or existing connection candidate.
 */
export interface ConnectionCandidate {
  source?: string | null;
  target?: string | null;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

/**
 * Result returned by the shared connection validation pipeline.
 */
export type ConnectionValidationResult =
  | {
      ok: true;
      relationshipType: NonNullable<TreeEdgeData['relationshipType']>;
    }
  | {
      ok: false;
      reason: ConnectionValidationReason;
      message: string;
    };

export interface ValidateConnectionOptions {
  ignoreEdgeId?: string;
}

/**
 * Single, unified, side-effect-free connection validation pipeline.
 *
 * Enforces:
 * 1. source/target input presence
 * 2. self-link prohibition
 * 3. source & target node existence
 * 4. relationship rules (Root cannot have parent, Action cannot have children, valid type pair)
 * 5. duplicate edge prevention
 * 6. single-parent constraint (each child has at most one parent)
 * 7. cycle prevention
 *
 * @param connection - Proposed connection candidate { source, target }
 * @param nodes - Current graph nodes
 * @param edges - Current graph edges
 * @param options - Optional flags such as ignoreEdgeId during edge reconnection
 */
export function validateConnection(
  connection: ConnectionCandidate | null | undefined,
  nodes: readonly TreeNode[],
  edges: readonly TreeEdge[] | readonly EdgeConnectionLike[],
  options?: ValidateConnectionOptions
): ConnectionValidationResult {
  // 1. Validate input presence
  if (!connection || !connection.source || !connection.target) {
    return {
      ok: false,
      reason: 'malformed',
      message: 'Connection must specify valid source and target node identifiers.',
    };
  }

  const { source, target } = connection;
  const ignoreEdgeId = options?.ignoreEdgeId;

  // 2. Reject self-links immediately
  if (source === target) {
    return {
      ok: false,
      reason: 'self-link',
      message: 'A node cannot connect to itself.',
    };
  }

  // 3. Verify node existence in graph
  const nodeMap = new Map<string, TreeNode>();
  for (const n of nodes) {
    nodeMap.set(n.id, n);
  }

  const sourceNode = nodeMap.get(source);
  const targetNode = nodeMap.get(target);

  if (!sourceNode || !targetNode) {
    return {
      ok: false,
      reason: 'missing-node',
      message: 'Source or target node does not exist in the graph.',
    };
  }

  // 4. Validate relationship policy
  // 4a. Target cannot be Root (Root cannot have a parent)
  if (!canHaveParent(targetNode.type)) {
    return {
      ok: false,
      reason: 'invalid-relationship',
      message: 'Root nodes cannot have a parent.',
    };
  }

  // 4b. Source cannot be Action (Action cannot have children)
  if (!canAcceptChild(sourceNode.type)) {
    return {
      ok: false,
      reason: 'invalid-relationship',
      message: 'Action nodes cannot have children.',
    };
  }

  // 4c. Verify allowed parent-child type pairing
  if (!isValidParentChildRelationship(sourceNode.type, targetNode.type)) {
    const allowed = getAllowedChildTypes(sourceNode.type);
    return {
      ok: false,
      reason: 'invalid-relationship',
      message: `Invalid relationship: ${sourceNode.type} cannot connect to ${targetNode.type}. Allowed children for ${sourceNode.type}: ${allowed.join(', ')}.`,
    };
  }

  // 5. Duplicate edge check
  for (const edge of edges) {
    if (ignoreEdgeId && edge.id === ignoreEdgeId) {
      continue;
    }
    if (edge.source === source && edge.target === target) {
      return {
        ok: false,
        reason: 'duplicate-edge',
        message: 'This connection already exists.',
      };
    }
  }

  // 6. Single-parent hierarchy constraint
  for (const edge of edges) {
    if (ignoreEdgeId && edge.id === ignoreEdgeId) {
      continue;
    }
    if (edge.target === target) {
      return {
        ok: false,
        reason: 'has-parent',
        message: 'This node already has a parent. Each node may have at most one parent in a tree hierarchy.',
      };
    }
  }

  // 7. Cycle detection
  if (wouldCreateCycle(source, target, edges, ignoreEdgeId)) {
    return {
      ok: false,
      reason: 'cycle',
      message: 'This connection would create a cycle.',
    };
  }

  // 8. Success: resolve relationship metadata
  const relType = getRelationshipType(sourceNode.type, targetNode.type) || 'root-rule';

  return {
    ok: true,
    relationshipType: relType,
  };
}
