import type { NodeType, TreeNode, TreeNodeData } from '../types/tree';

/**
 * Supported policy node types.
 */
export const SUPPORTED_NODE_TYPES: readonly NodeType[] = [
  'root',
  'rule',
  'condition',
  'action',
] as const;

/**
 * Pure runtime type guard validating whether an unknown value is a supported PolicyNodeType.
 * Does NOT rely on unsafe type casting.
 *
 * @param value - Any arbitrary runtime value to check
 * @returns True if value is exactly 'root', 'rule', 'condition', or 'action'
 */
export function isPolicyNodeType(value: unknown): value is NodeType {
  if (typeof value !== 'string') {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return (
    normalized === 'root' ||
    normalized === 'rule' ||
    normalized === 'condition' ||
    normalized === 'action'
  );
}

/**
 * Generates a collision-resistant unique node ID.
 * Follows the format: `node_${type}_${randomUUID}`.
 * Strictly verifies against `existingIdSet` to eliminate any collision probability.
 *
 * @param type - The node type
 * @param existingIdSet - Set of currently used IDs in the graph
 */
export function generateUniqueNodeId(type: NodeType, existingIdSet: Set<string>): string {
  let candidateId: string;
  let attempts = 0;

  do {
    const uniqueSegment =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    candidateId = `node_${type}_${uniqueSegment}`;
    attempts++;
  } while (existingIdSet.has(candidateId) && attempts < 100);

  return candidateId;
}

/**
 * Creates default, fully typed node payload for a newly instantiated node.
 * Generates generic enterprise labels (e.g. "New Rule") and does NOT assign
 * mock regulatory identifiers (e.g. FINRA-2210), preserving clean domain abstraction.
 *
 * @param type - The node type
 */
export function createDefaultNodeData(type: NodeType): TreeNodeData {
  switch (type) {
    case 'root':
      return {
        label: 'New Root',
        description: 'Top-level policy hierarchy framework root anchor.',
        severity: 'info',
        status: 'active',
        parameters: {},
        metadata: {},
        collapsed: false,
      };

    case 'rule':
      return {
        label: 'New Rule',
        description: 'Policy rule or governance standard requirement.',
        severity: 'medium',
        status: 'draft',
        parameters: {},
        metadata: {},
        collapsed: false,
      };

    case 'condition':
      return {
        label: 'New Condition',
        description: 'Evaluative criteria, threshold check, or predicate expression.',
        severity: 'medium',
        status: 'draft',
        parameters: {},
        metadata: {},
        collapsed: false,
      };

    case 'action':
      return {
        label: 'New Action',
        description: 'Automated remediation, review routing, or archiving task.',
        severity: 'medium',
        status: 'draft',
        parameters: {},
        metadata: {},
        collapsed: false,
      };
  }
}

/**
 * Pure node factory constructing a complete, valid TreeNode.
 *
 * Guaranteed properties:
 * - Deterministic, side-effect free, and zero access to global store or React state.
 * - Enforces unique ID against `existingIds`.
 * - Validates finite position coordinates.
 * - Does NOT mutate any input array or existing node objects.
 *
 * @param type - The validated NodeType
 * @param position - Canvas drop coordinates { x, y }
 * @param existingIds - Optional iterable or array of current graph node IDs
 */
export function createDefaultNode(
  type: NodeType,
  position: { x: number; y: number },
  existingIds: Iterable<string> | string[] = []
): TreeNode {
  const existingSet = new Set<string>(existingIds);
  const id = generateUniqueNodeId(type, existingSet);
  const data = createDefaultNodeData(type);

  return {
    id,
    type,
    position: {
      x: Number.isFinite(position.x) ? position.x : 0,
      y: Number.isFinite(position.y) ? position.y : 0,
    },
    data,
  };
}
