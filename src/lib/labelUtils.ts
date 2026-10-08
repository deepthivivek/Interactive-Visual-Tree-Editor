/**
 * Pure label duplication helper for Day 6 Node Operations.
 *
 * Rules:
 * - "X" -> "X (copy)"
 * - "X (copy)" -> "X (copy 2)"
 * - "X (copy 2)" -> "X (copy 3)"
 * - Strips any generated suffix before calculating the next index.
 * - Skips labels already in use in the graph.
 */

/**
 * Regex matching ` (copy)` or ` (copy <N>)` at the end of a label.
 */
const COPY_SUFFIX_REGEX = /\s*\(copy(?:\s+(\d+))?\)$/;

/**
 * Strips any trailing ` (copy)` or ` (copy N)` suffix to recover the root base label.
 */
export function extractBaseLabel(label: string): string {
  return label.replace(COPY_SUFFIX_REGEX, '').trim();
}

/**
 * Generates the next available duplicate label that does not collide with `existingLabels`.
 *
 * @param originalLabel - The label of the node being duplicated
 * @param existingLabels - Collection of node labels currently in the graph
 */
export function generateDuplicateLabel(
  originalLabel: string,
  existingLabels: Iterable<string>
): string {
  const existingSet = new Set(existingLabels);
  const base = extractBaseLabel(originalLabel);

  // First candidate is "Base (copy)"
  let candidate = `${base} (copy)`;
  if (!existingSet.has(candidate)) {
    return candidate;
  }

  // Next candidates are "Base (copy 2)", "Base (copy 3)", etc.
  let index = 2;
  while (true) {
    candidate = `${base} (copy ${index})`;
    if (!existingSet.has(candidate)) {
      return candidate;
    }
    index++;
  }
}
