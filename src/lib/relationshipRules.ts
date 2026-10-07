import type { NodeType, TreeEdgeData } from '../types/tree';

/**
 * Valid relationship pairings mapping parent NodeType to permitted child NodeTypes.
 * Strict Single Source of Truth for hierarchy grammar:
 * - Root → Rule
 * - Rule → Condition
 * - Rule → Action
 * - Condition → Action
 */
export const ALLOWED_CHILDREN_MAP: Record<NodeType, readonly NodeType[]> = {
  root: ['rule'],
  rule: ['condition', 'action'],
  condition: ['action'],
  action: [],
} as const;

/**
 * Valid relationship pairings mapping child NodeType to permitted parent NodeTypes.
 */
export const ALLOWED_PARENTS_MAP: Record<NodeType, readonly NodeType[]> = {
  root: [],
  rule: ['root'],
  condition: ['rule'],
  action: ['rule', 'condition'],
} as const;

/**
 * Pure check to verify if a directional parent-to-child relationship is permitted.
 *
 * @param parentType - The source node's NodeType
 * @param childType - The target node's NodeType
 */
export function isValidParentChildRelationship(
  parentType: NodeType,
  childType: NodeType
): boolean {
  const allowed = ALLOWED_CHILDREN_MAP[parentType];
  return allowed ? allowed.includes(childType) : false;
}

/**
 * Returns allowed child node types for a given parent node type.
 */
export function getAllowedChildTypes(parentType: NodeType): readonly NodeType[] {
  return ALLOWED_CHILDREN_MAP[parentType] ?? [];
}

/**
 * Returns allowed parent node types for a given child node type.
 */
export function getAllowedParentTypes(childType: NodeType): readonly NodeType[] {
  return ALLOWED_PARENTS_MAP[childType] ?? [];
}

/**
 * Checks if a node type can accept any parent (incoming edge).
 * Root cannot have any parents.
 */
export function canHaveParent(type: NodeType): boolean {
  return type !== 'root' && ALLOWED_PARENTS_MAP[type].length > 0;
}

/**
 * Checks if a node type can have any children (outgoing edge).
 * Action cannot have any children.
 */
export function canAcceptChild(type: NodeType): boolean {
  return type !== 'action' && ALLOWED_CHILDREN_MAP[type].length > 0;
}

/**
 * Resolves the typed relationship identifier matching `TreeEdgeData['relationshipType']`.
 */
export function getRelationshipType(
  parentType: NodeType,
  childType: NodeType
): TreeEdgeData['relationshipType'] | null {
  if (parentType === 'root' && childType === 'rule') return 'root-rule';
  if (parentType === 'rule' && childType === 'condition') return 'rule-condition';
  if (parentType === 'rule' && childType === 'action') return 'rule-action';
  if (parentType === 'condition' && childType === 'action') return 'condition-action';
  return null;
}
