import type {
  TreeNode,
  TreeNodeData,
  NodeParameters,
  NodeMetadata,
  NodeSeverity,
  NodeStatus,
} from '../types/tree';

/**
 * Pure helper to immutably update a TreeNode's data payload.
 *
 * @param node - The node to update
 * @param updates - Partial data fields to merge
 * @returns A new TreeNode instance with updated data
 */
export function updateNodeDataPure(
  node: TreeNode,
  updates: Partial<TreeNodeData>
): TreeNode {
  const nextData: TreeNodeData = {
    ...node.data,
    ...updates,
  };

  // If label is being updated, ensure it is a string
  if ('label' in updates) {
    const rawLabel = updates.label;
    if (typeof rawLabel === 'string') {
      nextData.label = rawLabel;
    }
  }

  return {
    ...node,
    data: nextData,
  };
}

/**
 * Pure helper to set or rename a parameter in a NodeParameters dictionary.
 *
 * @param parameters - Current parameters dictionary
 * @param key - The target key name
 * @param value - The parameter value
 * @param oldKey - Optional previous key name if renaming
 */
export function setParameterPure(
  parameters: NodeParameters | undefined,
  key: string,
  value: string | number | boolean,
  oldKey?: string
): NodeParameters {
  const result: NodeParameters = { ...(parameters ?? {}) };

  const trimmedKey = key.trim();
  if (!trimmedKey) {
    return result;
  }

  if (oldKey && oldKey !== trimmedKey && oldKey in result) {
    delete result[oldKey];
  }

  result[trimmedKey] = value;
  return result;
}

/**
 * Pure helper to delete a parameter from a NodeParameters dictionary.
 *
 * @param parameters - Current parameters dictionary
 * @param key - The key to delete
 */
export function deleteParameterPure(
  parameters: NodeParameters | undefined,
  key: string
): NodeParameters {
  const result: NodeParameters = { ...(parameters ?? {}) };
  delete result[key];
  return result;
}

/**
 * Pure helper to set or rename an audit tag in a NodeMetadata dictionary.
 *
 * @param metadata - Current metadata dictionary
 * @param key - The target key name
 * @param value - The metadata value
 * @param oldKey - Optional previous key name if renaming
 */
export function setMetadataPure(
  metadata: NodeMetadata | undefined,
  key: string,
  value: string | number | boolean,
  oldKey?: string
): NodeMetadata {
  const result: NodeMetadata = { ...(metadata ?? {}) };

  const trimmedKey = key.trim();
  if (!trimmedKey) {
    return result;
  }

  if (oldKey && oldKey !== trimmedKey && oldKey in result) {
    delete result[oldKey];
  }

  result[trimmedKey] = value;
  return result;
}

/**
 * Pure helper to delete an entry from a NodeMetadata dictionary.
 *
 * @param metadata - Current metadata dictionary
 * @param key - The key to delete
 */
export function deleteMetadataPure(
  metadata: NodeMetadata | undefined,
  key: string
): NodeMetadata {
  const result: NodeMetadata = { ...(metadata ?? {}) };
  delete result[key];
  return result;
}

/**
 * Pure helper to append a unique tag to a tags array.
 *
 * @param tags - Current tags array
 * @param tag - Tag to append
 */
export function addTagPure(
  tags: string[] | undefined,
  tag: string
): string[] {
  const trimmed = tag.trim();
  if (!trimmed) {
    return tags ? [...tags] : [];
  }

  const current = tags ?? [];
  if (current.includes(trimmed)) {
    return [...current];
  }

  return [...current, trimmed];
}

/**
 * Pure helper to remove a tag from a tags array.
 *
 * @param tags - Current tags array
 * @param tag - Tag to remove
 */
export function removeTagPure(
  tags: string[] | undefined,
  tag: string
): string[] {
  if (!tags) return [];
  return tags.filter((t) => t !== tag);
}

/**
 * Valid severity options.
 */
export const VALID_SEVERITIES: readonly NodeSeverity[] = [
  'info',
  'low',
  'medium',
  'high',
  'critical',
] as const;

/**
 * Valid status options.
 */
export const VALID_STATUSES: readonly NodeStatus[] = [
  'active',
  'draft',
  'in_review',
  'deprecated',
  'archived',
] as const;
