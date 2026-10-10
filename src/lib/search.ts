import type { TreeNode, TreeNodeData } from '../types/tree';
import { getNodeTypeConfig } from './nodeTypeConfig';

export interface SearchableField {
  fieldType: 'ruleId' | 'id' | 'label' | 'type' | 'tag' | 'description' | 'metadata' | 'parameters';
  text: string;
}

export const SEARCH_FIELD_WEIGHTS = {
  exactRuleId: 1000,
  exactId: 900,
  startsWithIdOrRuleId: 800,
  exactLabel: 700,
  startsWithLabel: 600,
  containsIdOrRuleIdOrLabel: 500,
  typeOrDisplayLabel: 400,
  tag: 300,
  description: 200,
  metadataOrParameters: 100,
} as const;

export interface HighlightSegment {
  text: string;
  match: boolean;
}

export interface SearchResultItem {
  node: TreeNode;
  score: number;
  matchedFields: string[];
  snippet?: string;
  primaryMatchText: string;
}

export interface SearchDropdownState {
  query: string;
  isOpen: boolean;
  activeIndex: number;
}

export type SearchAction =
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'clear' }
  | { type: 'queryChanged'; query: string; resultCount: number }
  | { type: 'next'; resultCount: number }
  | { type: 'previous'; resultCount: number }
  | { type: 'select'; index?: number }
  | { type: 'reconcile'; resultCount: number };

/**
 * Normalizes query string: trim, collapse spaces, NFC unicode normalize, lowercase, max 200 chars.
 */
export function normalizeQuery(query: string): string {
  if (typeof query !== 'string') return '';
  return query
    .trim()
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .slice(0, 200);
}

/**
 * Tokenizes normalized query into unique or ordered non-empty terms.
 */
export function tokenizeQuery(query: string): string[] {
  const norm = normalizeQuery(query);
  if (!norm) return [];
  return norm.split(' ').filter(Boolean);
}

/**
 * Extracts all searchable fields safely from a tree node.
 */
export function extractSearchableFields(node: TreeNode): SearchableField[] {
  if (!node) return [];
  const fields: SearchableField[] = [];
  const nodeData = node.data as TreeNodeData;

  if (node.id != null) {
    fields.push({ fieldType: 'id', text: String(node.id) });
  }
  if (nodeData?.ruleId != null) {
    fields.push({ fieldType: 'ruleId', text: String(nodeData.ruleId) });
  }
  if (nodeData?.label != null) {
    fields.push({ fieldType: 'label', text: String(nodeData.label) });
  }
  if (node.type != null) {
    fields.push({ fieldType: 'type', text: String(node.type) });
    const config = getNodeTypeConfig(node.type);
    if (config?.displayLabel) {
      fields.push({ fieldType: 'type', text: String(config.displayLabel) });
    }
    if (config?.badgeLabel) {
      fields.push({ fieldType: 'type', text: String(config.badgeLabel) });
    }
  }
  if (nodeData?.description != null) {
    fields.push({ fieldType: 'description', text: String(nodeData.description) });
  }
  if (Array.isArray(nodeData?.tags)) {
    for (const tag of nodeData.tags) {
      if (tag != null && (typeof tag === 'string' || typeof tag === 'number' || typeof tag === 'boolean')) {
        fields.push({ fieldType: 'tag', text: String(tag) });
      }
    }
  }
  if (nodeData?.metadata && typeof nodeData.metadata === 'object') {
    for (const [k, v] of Object.entries(nodeData.metadata)) {
      if (k != null) {
        fields.push({ fieldType: 'metadata', text: String(k) });
      }
      if (v != null && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')) {
        fields.push({ fieldType: 'metadata', text: String(v) });
      }
    }
  }
  if (nodeData?.parameters && typeof nodeData.parameters === 'object') {
    for (const [k, v] of Object.entries(nodeData.parameters)) {
      if (k != null) {
        fields.push({ fieldType: 'parameters', text: String(k) });
      }
      if (v != null && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')) {
        fields.push({ fieldType: 'parameters', text: String(v) });
      }
    }
  }

  return fields;
}

/**
 * Generates highlight segments for text given query terms.
 * Case-insensitive, safe literal matching without regex.
 */
export function getHighlightSegments(text: string, terms: string[]): HighlightSegment[] {
  if (!text || typeof text !== 'string') {
    return [{ text: text || '', match: false }];
  }
  const validTerms = (terms || [])
    .map((t) => (typeof t === 'string' ? t.trim().toLowerCase() : ''))
    .filter(Boolean);

  if (validTerms.length === 0) {
    return [{ text, match: false }];
  }

  const lowerText = text.toLowerCase();
  const intervals: [number, number][] = [];

  for (const term of validTerms) {
    let pos = 0;
    while (pos < lowerText.length) {
      const idx = lowerText.indexOf(term, pos);
      if (idx === -1) break;
      intervals.push([idx, idx + term.length]);
      pos = idx + 1;
    }
  }

  if (intervals.length === 0) {
    return [{ text, match: false }];
  }

  // Sort intervals by start, then end descending
  intervals.sort((a, b) => a[0] - b[0] || b[1] - a[1]);

  // Merge overlapping or adjacent intervals
  const merged: [number, number][] = [];
  let current = intervals[0];
  for (let i = 1; i < intervals.length; i++) {
    const next = intervals[i];
    if (next[0] <= current[1]) {
      current[1] = Math.max(current[1], next[1]);
    } else {
      merged.push(current);
      current = next;
    }
  }
  merged.push(current);

  const segments: HighlightSegment[] = [];
  let lastIdx = 0;

  for (const [start, end] of merged) {
    if (start > lastIdx) {
      segments.push({ text: text.slice(lastIdx, start), match: false });
    }
    if (end > start) {
      segments.push({ text: text.slice(start, end), match: true });
    }
    lastIdx = Math.max(lastIdx, end);
  }

  if (lastIdx < text.length) {
    segments.push({ text: text.slice(lastIdx), match: false });
  }

  return segments;
}

/**
 * Generates a snippet window around the first matching term in text.
 */
export function getSnippet(text: string, terms: string[], maxLen = 80): string {
  if (!text || typeof text !== 'string') return '';
  const validTerms = (terms || [])
    .map((t) => (typeof t === 'string' ? t.trim().toLowerCase() : ''))
    .filter(Boolean);

  if (validTerms.length === 0 || text.length <= maxLen) {
    return text;
  }

  const lowerText = text.toLowerCase();
  let firstIdx = -1;
  let matchLen = 0;

  for (const term of validTerms) {
    const idx = lowerText.indexOf(term);
    if (idx !== -1 && (firstIdx === -1 || idx < firstIdx)) {
      firstIdx = idx;
      matchLen = term.length;
    }
  }

  if (firstIdx === -1) {
    return text.slice(0, Math.max(0, maxLen - 3)) + '...';
  }

  const targetHalf = Math.floor((maxLen - matchLen) / 2);
  let start = Math.max(0, firstIdx - targetHalf);
  let end = Math.min(text.length, start + maxLen);

  if (end === text.length) {
    start = Math.max(0, end - maxLen);
  }

  let snippet = text.slice(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';

  return snippet;
}

/**
 * Generates a stable signature string representing searchable fields of nodes.
 */
export function getSearchSignature(nodes: readonly TreeNode[]): string {
  if (!Array.isArray(nodes)) return '';
  const summaries = nodes.map((n) => {
    const data = n.data as TreeNodeData;
    return {
      id: n.id,
      type: n.type,
      label: data?.label ?? '',
      ruleId: data?.ruleId ?? '',
      description: data?.description ?? '',
      tags: Array.isArray(data?.tags) ? [...data.tags].sort() : [],
      metadata: data?.metadata && typeof data.metadata === 'object'
        ? Object.entries(data.metadata).sort(([a], [b]) => a.localeCompare(b))
        : [],
      parameters: data?.parameters && typeof data.parameters === 'object'
        ? Object.entries(data.parameters).sort(([a], [b]) => a.localeCompare(b))
        : [],
    };
  });
  summaries.sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify(summaries);
}

/**
 * Inexpensive check to determine if node identities, types, and data object references are unchanged.
 */
export function areNodeDataReferencesEqual(
  prevNodes: readonly TreeNode[],
  nextNodes: readonly TreeNode[]
): boolean {
  if (prevNodes === nextNodes) return true;
  if (!Array.isArray(prevNodes) || !Array.isArray(nextNodes)) return false;
  if (prevNodes.length !== nextNodes.length) return false;

  for (let i = 0; i < prevNodes.length; i++) {
    const prev = prevNodes[i];
    const next = nextNodes[i];
    if (prev.id !== next.id || prev.type !== next.type || prev.data !== next.data) {
      return false;
    }
  }
  return true;
}

let lastQuery = '';
let lastSignature = '';
let lastResults: SearchResultItem[] = [];
let lastNodesRaw: readonly TreeNode[] = [];
let hasCachedBaseline = false;

/**
 * Resets the search cache baseline. Useful for deterministic isolated tests.
 */
export function resetSearchCache(): void {
  lastQuery = '';
  lastSignature = '';
  lastResults = [];
  lastNodesRaw = [];
  hasCachedBaseline = false;
}

/**
 * Returns cached search results, preserving array reference when query and searchable fields are unchanged.
 * Uses an inexpensive node identity, type, and data reference check to avoid full signature extraction during node dragging.
 */
export function getCachedSearchNodes(nodes: readonly TreeNode[], query: string): SearchResultItem[] {
  const normQuery = normalizeQuery(query);

  // 1. Inexpensive reference-based check: if query is identical and node IDs, types, and data references are unchanged
  // (e.g. position-only drag or selection update), reuse previously computed search results without computing signature.
  if (hasCachedBaseline && normQuery === lastQuery && areNodeDataReferencesEqual(lastNodesRaw, nodes)) {
    if (nodes !== lastNodesRaw) {
      const nodeMap = new Map(nodes.map((n) => [n.id, n]));
      for (const item of lastResults) {
        const latest = nodeMap.get(item.node.id);
        if (latest) {
          item.node = latest;
        }
      }
      lastNodesRaw = nodes;
    }
    return lastResults;
  }

  // 2. Data reference changed or initial compute: fall back to field-level signature
  const signature = getSearchSignature(nodes);
  if (hasCachedBaseline && normQuery === lastQuery && signature === lastSignature) {
    if (nodes !== lastNodesRaw) {
      const nodeMap = new Map(nodes.map((n) => [n.id, n]));
      for (const item of lastResults) {
        const latest = nodeMap.get(item.node.id);
        if (latest) {
          item.node = latest;
        }
      }
      lastNodesRaw = nodes;
    }
    return lastResults;
  }

  // 3. Searchable fields or query actually changed: recompute search results
  const newResults = searchNodes(nodes as TreeNode[], query);
  lastQuery = normQuery;
  lastSignature = signature;
  lastResults = newResults;
  lastNodesRaw = nodes;
  hasCachedBaseline = true;
  return newResults;
}

/**
 * Pure dropdown reducer.
 */
export function searchDropdownReducer(
  state: SearchDropdownState,
  action: SearchAction
): SearchDropdownState {
  switch (action.type) {
    case 'open':
      return { ...state, isOpen: true };
    case 'close':
      return { ...state, isOpen: false };
    case 'clear':
      return { query: '', isOpen: false, activeIndex: -1 };
    case 'queryChanged': {
      const query = action.query;
      const isOpen = query.trim().length > 0 && action.resultCount > 0;
      const activeIndex = action.resultCount > 0 ? 0 : -1;
      return { query, isOpen, activeIndex };
    }
    case 'next': {
      if (action.resultCount <= 0) return { ...state, activeIndex: -1 };
      const nextIdx = (state.activeIndex + 1) % action.resultCount;
      return { ...state, activeIndex: nextIdx, isOpen: true };
    }
    case 'previous': {
      if (action.resultCount <= 0) return { ...state, activeIndex: -1 };
      const prevIdx = (state.activeIndex - 1 + action.resultCount) % action.resultCount;
      return { ...state, activeIndex: prevIdx, isOpen: true };
    }
    case 'select': {
      return { ...state, isOpen: false };
    }
    case 'reconcile': {
      const count = action.resultCount;
      if (count <= 0) {
        return { ...state, activeIndex: -1, isOpen: false };
      }
      let activeIndex = state.activeIndex;
      if (activeIndex >= count) {
        activeIndex = count - 1;
      }
      if (activeIndex < 0 && count > 0 && state.query.trim().length > 0) {
        activeIndex = 0;
      }
      return { ...state, activeIndex };
    }
    default:
      return state;
  }
}

export type FocusTargetInsets =
  | number
  | {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };

/**
 * Computes viewport focus target for selecting a node.
 * Uses final usable viewport dimensions (accounting for right-side inset such as open inspector).
 */
export function computeFocusTarget(
  node: TreeNode,
  viewport: { x: number; y: number; zoom: number },
  screenWidth: number,
  screenHeight: number,
  targetZoom = 1,
  insets?: FocusTargetInsets
): { x: number; y: number; zoom: number } {
  const nodeX = node.position?.x ?? 0;
  const nodeY = node.position?.y ?? 0;
  const nodeWidth = node.measured?.width ?? 215;
  const nodeHeight = node.measured?.height ?? 100;

  const zoom = Math.min(1.5, Math.max(0.2, targetZoom));

  let rightInset = 0;
  let leftInset = 0;
  let topInset = 0;
  let bottomInset = 0;

  if (typeof insets === 'number') {
    rightInset = Math.max(0, insets);
  } else if (insets && typeof insets === 'object') {
    rightInset = Math.max(0, insets.right ?? 0);
    leftInset = Math.max(0, insets.left ?? 0);
    topInset = Math.max(0, insets.top ?? 0);
    bottomInset = Math.max(0, insets.bottom ?? 0);
  }

  // Calculate usable viewport dimensions
  const usableWidth = Math.max(100, screenWidth - leftInset - rightInset);
  const usableHeight = Math.max(100, screenHeight - topInset - bottomInset);

  const centerX = nodeX + nodeWidth / 2;
  const centerY = nodeY + nodeHeight / 2;

  // Center point of the usable area on screen
  const targetScreenCenterX = leftInset + usableWidth / 2;
  const targetScreenCenterY = topInset + usableHeight / 2;

  // Viewport offset required so node center coincides with target screen center
  const x = targetScreenCenterX - centerX * zoom;
  const y = targetScreenCenterY - centerY * zoom;

  return { x, y, zoom };
}

export interface SlashShortcutTargetInfo {
  tagName?: string;
  isContentEditable?: boolean;
  isInProtectedArea?: boolean;
}

/**
 * Determines whether the slash shortcut (/) is eligible to activate search.
 * Supports both DOM HTMLElement and pure SlashShortcutTargetInfo plain objects.
 */
export function isSlashShortcutEligible(
  target: HTMLElement | null | SlashShortcutTargetInfo
): boolean {
  if (!target) return true;
  if ('tagName' in target && typeof (target as HTMLElement).closest === 'function') {
    const el = target as HTMLElement;
    const tagName = el.tagName?.toLowerCase();
    if (['input', 'textarea', 'select'].includes(tagName)) {
      return false;
    }
    if (el.isContentEditable) {
      return false;
    }
    if (el.closest?.('.nokey')) {
      return false;
    }
    return true;
  }

  const info = target as SlashShortcutTargetInfo;
  const tag = info.tagName?.toLowerCase();
  if (tag && ['input', 'textarea', 'select'].includes(tag)) {
    return false;
  }
  if (info.isContentEditable) {
    return false;
  }
  if (info.isInProtectedArea) {
    return false;
  }
  return true;
}

export type SearchKeyDecision =
  | { action: 'none' }
  | { action: 'open' }
  | { action: 'close' }
  | { action: 'clear' }
  | { action: 'blur' }
  | { action: 'select'; index: number }
  | { action: 'next' }
  | { action: 'previous' };

export interface ResolveSearchKeyParams {
  key: string;
  isComposing?: boolean;
  isOpen: boolean;
  hasQuery: boolean;
  activeIndex: number;
  resultCount: number;
}

/**
 * Pure helper determining search keyboard interaction decisions.
 * Independent of React and browser APIs.
 */
export function resolveSearchKeyDecision(params: ResolveSearchKeyParams): SearchKeyDecision {
  const { key, isComposing, isOpen, hasQuery, activeIndex, resultCount } = params;

  // IME composition guard: when user is composing through IME, leave search untouched
  if (isComposing) {
    return { action: 'none' };
  }

  if (key === 'Escape') {
    if (isOpen) {
      return { action: 'close' };
    }
    if (hasQuery) {
      return { action: 'clear' };
    }
    return { action: 'blur' };
  }

  if (key === 'Enter') {
    if (isOpen && activeIndex >= 0 && activeIndex < resultCount) {
      return { action: 'select', index: activeIndex };
    }
    return { action: 'none' };
  }

  if (key === 'ArrowDown') {
    if (!isOpen && hasQuery) {
      return { action: 'open' };
    }
    return { action: 'next' };
  }

  if (key === 'ArrowUp') {
    return { action: 'previous' };
  }

  if (key === 'Tab') {
    if (isOpen) {
      return { action: 'close' };
    }
    return { action: 'none' };
  }

  return { action: 'none' };
}

/**
 * Executes advanced ranked search on nodes given query string.
 */
export function searchNodes(nodes: TreeNode[], query: string): SearchResultItem[] {
  const terms = tokenizeQuery(query);
  if (!Array.isArray(nodes) || nodes.length === 0 || terms.length === 0) {
    return [];
  }

  const results: SearchResultItem[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const fields = extractSearchableFields(node);
    let nodeTotalScore = 0;
    let matched = true;
    const matchedFieldTypes = new Set<string>();
    let primaryText = (node.data as TreeNodeData)?.label || node.id;

    for (const term of terms) {
      let bestTermWeight = 0;
      let bestFieldText = '';

      for (const field of fields) {
        const textLower = field.text.toLowerCase();
        let w = 0;

        if (textLower === term) {
          if (field.fieldType === 'ruleId') w = SEARCH_FIELD_WEIGHTS.exactRuleId;
          else if (field.fieldType === 'id') w = SEARCH_FIELD_WEIGHTS.exactId;
          else if (field.fieldType === 'label') w = SEARCH_FIELD_WEIGHTS.exactLabel;
          else if (field.fieldType === 'type') w = SEARCH_FIELD_WEIGHTS.typeOrDisplayLabel;
          else if (field.fieldType === 'tag') w = SEARCH_FIELD_WEIGHTS.tag;
          else if (field.fieldType === 'description') w = SEARCH_FIELD_WEIGHTS.description;
          else w = SEARCH_FIELD_WEIGHTS.metadataOrParameters;
        } else if (textLower.startsWith(term)) {
          if (field.fieldType === 'id' || field.fieldType === 'ruleId') w = SEARCH_FIELD_WEIGHTS.startsWithIdOrRuleId;
          else if (field.fieldType === 'label') w = SEARCH_FIELD_WEIGHTS.startsWithLabel;
          else if (field.fieldType === 'type') w = SEARCH_FIELD_WEIGHTS.typeOrDisplayLabel;
          else if (field.fieldType === 'tag') w = SEARCH_FIELD_WEIGHTS.tag;
          else if (field.fieldType === 'description') w = SEARCH_FIELD_WEIGHTS.description;
          else w = SEARCH_FIELD_WEIGHTS.metadataOrParameters;
        } else if (textLower.includes(term)) {
          if (field.fieldType === 'id' || field.fieldType === 'ruleId' || field.fieldType === 'label') {
            w = SEARCH_FIELD_WEIGHTS.containsIdOrRuleIdOrLabel;
          } else if (field.fieldType === 'type') w = SEARCH_FIELD_WEIGHTS.typeOrDisplayLabel;
          else if (field.fieldType === 'tag') w = SEARCH_FIELD_WEIGHTS.tag;
          else if (field.fieldType === 'description') w = SEARCH_FIELD_WEIGHTS.description;
          else w = SEARCH_FIELD_WEIGHTS.metadataOrParameters;
        }

        if (w > bestTermWeight) {
          bestTermWeight = w;
          bestFieldText = field.text;
          matchedFieldTypes.add(field.fieldType);
        }
      }

      if (bestTermWeight === 0) {
        matched = false;
        break;
      }
      nodeTotalScore += bestTermWeight;
      if (!primaryText && bestFieldText) {
        primaryText = bestFieldText;
      }
    }

    if (matched && nodeTotalScore > 0) {
      const description = (node.data as TreeNodeData)?.description;
      const descriptionMatched = matchedFieldTypes.has('description');
      const snippet = descriptionMatched && description ? getSnippet(description, terms) : undefined;

      results.push({
        node,
        score: nodeTotalScore,
        matchedFields: Array.from(matchedFieldTypes),
        snippet,
        primaryMatchText: primaryText,
      });
    }
  }

  results.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const idxA = nodes.indexOf(a.node);
    const idxB = nodes.indexOf(b.node);
    return idxA - idxB;
  });

  return results;
}
