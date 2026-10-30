/**
 * Reliable Local Persistence Engine (Day 16).
 *
 * Implements:
 * - Versioned, namespaced local persistence document schema (`persistenceVersion: 1`).
 * - Complete isolation from transient UI state, history (undo/redo), search, and selection.
 * - Safe pre-validation input guards and prototype pollution protection.
 * - Strict structural integrity validation with dangling edge endpoint detection.
 * - Clear distinction between blocking data corruption vs legitimate incomplete editing states.
 * - Quota exceeded and storage availability error handling.
 * - Pure serialization and deserialization decoupled from React and browser DOM.
 */

import type { TreeNode, TreeEdge, NodeType } from '../types/tree';
import { toDocumentNode, toDocumentEdge, UNSAFE_KEYS } from './json';

// ============================================================================
// CONSTANTS & KEYS
// ============================================================================

export const PERSISTENCE_STORAGE_KEY = 'interactive_tree_editor_v1_store';
export const PERSISTENCE_FORMAT_VERSION = 1;
export const SUPPORTED_PERSISTENCE_VERSIONS: readonly number[] = [1] as const;

/** Maximum encoded UTF-8 byte length allowed for local persistence (5 MiB). */
export const MAX_PERSISTENCE_BYTES = 5 * 1024 * 1024;

export const VALID_NODE_TYPES: readonly NodeType[] = ['root', 'rule', 'condition', 'action'] as const;

// ============================================================================
// TYPES
// ============================================================================

export interface PersistedSettings {
  theme?: string;
  gridVisible?: boolean;
  miniMapVisible?: boolean;
  snapToGrid?: boolean;
}

export const DEFAULT_PERSISTED_SETTINGS: PersistedSettings = {
  theme: 'light',
  gridVisible: true,
  miniMapVisible: true,
  snapToGrid: false,
};

export interface SavedWorkspaceDocument {
  persistenceVersion: 1;
  savedAt: number;
  nodes: TreeNode[];
  edges: TreeEdge[];
  settings?: PersistedSettings;
}

export type PersistenceErrorType =
  | 'NO_DATA'
  | 'CORRUPTED_JSON'
  | 'PROTOTYPE_POLLUTION'
  | 'VERSION_MISSING'
  | 'UNSUPPORTED_VERSION'
  | 'INVALID_STRUCTURE'
  | 'DANGLING_EDGE'
  | 'DUPLICATE_NODE_ID'
  | 'PAYLOAD_TOO_LARGE'
  | 'STORAGE_UNAVAILABLE'
  | 'QUOTA_EXCEEDED'
  | 'WRITE_FAILED';

export type LoadResult =
  | { ok: true; document: SavedWorkspaceDocument; source: 'storage' | 'empty' }
  | { ok: false; errorType: PersistenceErrorType; message: string; rawPayload?: string };

export type SaveResult =
  | { ok: true; savedAt: number; byteLength: number }
  | { ok: false; errorType: PersistenceErrorType; message: string };

// ============================================================================
// STORAGE AVAILABILITY & HELPERS
// ============================================================================

/**
 * Safely tests whether localStorage is available and writable in the current runtime environment.
 */
export function isStorageAvailable(storage?: Storage | null): boolean {
  try {
    const s = storage !== undefined ? (storage ?? undefined) : (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!s) return false;
    const testKey = '__storage_test_key__';
    s.setItem(testKey, '1');
    s.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Calculates UTF-8 byte length of string.
 */
function getByteLength(str: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str).length;
  }
  return Buffer.from(str, 'utf-8').length;
}

// ============================================================================
// SERIALIZATION (PURE)
// ============================================================================

/**
 * Pure serialization of authoritative graph nodes, edges, and settings into
 * the versioned persistence document.
 * Excludes all transient UI state, undo/redo history, selection, search, and inspector state.
 */
export function serializeWorkspace(
  nodes: readonly TreeNode[],
  edges: readonly TreeEdge[],
  settings?: PersistedSettings,
  savedAt = Date.now()
): string {
  const cleanNodes = nodes.map((n) => toDocumentNode(n) as unknown as TreeNode);
  const cleanEdges = edges.map((e) => toDocumentEdge(e) as unknown as TreeEdge);

  const document: SavedWorkspaceDocument = {
    persistenceVersion: 1,
    savedAt,
    nodes: cleanNodes,
    edges: cleanEdges,
  };

  if (settings && Object.keys(settings).length > 0) {
    document.settings = { ...settings };
  }

  return JSON.stringify(document);
}

// ============================================================================
// VALIDATION & DESERIALIZATION (PURE)
// ============================================================================

/**
 * Strictly validates a parsed JSON object against the SavedWorkspaceDocument specification.
 * Distinguishes blocking data corruption from legitimate incomplete editing states.
 */
export function validateWorkspaceDocument(
  parsed: unknown
): { ok: true; document: SavedWorkspaceDocument } | { ok: false; errorType: PersistenceErrorType; message: string } {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      ok: false,
      errorType: 'INVALID_STRUCTURE',
      message: 'Persisted payload must be a JSON object.',
    };
  }

  const raw = parsed as Record<string, unknown>;

  // 1. Version check
  if (!('persistenceVersion' in raw)) {
    return {
      ok: false,
      errorType: 'VERSION_MISSING',
      message: 'Persisted document is missing "persistenceVersion".',
    };
  }

  if (typeof raw.persistenceVersion !== 'number' || !Number.isInteger(raw.persistenceVersion)) {
    return {
      ok: false,
      errorType: 'UNSUPPORTED_VERSION',
      message: 'Persisted document version must be an integer.',
    };
  }

  if (!SUPPORTED_PERSISTENCE_VERSIONS.includes(raw.persistenceVersion as 1)) {
    return {
      ok: false,
      errorType: 'UNSUPPORTED_VERSION',
      message: `Persisted document version ${raw.persistenceVersion} is not supported. Supported versions: ${SUPPORTED_PERSISTENCE_VERSIONS.join(', ')}.`,
    };
  }

  // 2. Nodes structure check
  if (!Array.isArray(raw.nodes)) {
    return {
      ok: false,
      errorType: 'INVALID_STRUCTURE',
      message: 'Persisted document "nodes" must be an array.',
    };
  }

  // 3. Edges structure check
  if (!Array.isArray(raw.edges)) {
    return {
      ok: false,
      errorType: 'INVALID_STRUCTURE',
      message: 'Persisted document "edges" must be an array.',
    };
  }

  // 4. Validate nodes and collect ID set
  const nodeIdSet = new Set<string>();
  const validatedNodes: TreeNode[] = [];

  for (let i = 0; i < raw.nodes.length; i++) {
    const item = raw.nodes[i];
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      return {
        ok: false,
        errorType: 'INVALID_STRUCTURE',
        message: `Node at index ${i} is not a valid object.`,
      };
    }

    const n = item as Record<string, unknown>;

    if (typeof n.id !== 'string' || n.id.trim() === '') {
      return {
        ok: false,
        errorType: 'INVALID_STRUCTURE',
        message: `Node at index ${i} has a missing or invalid ID.`,
      };
    }

    if (nodeIdSet.has(n.id)) {
      return {
        ok: false,
        errorType: 'DUPLICATE_NODE_ID',
        message: `Duplicate node ID "${n.id}" found in persisted document.`,
      };
    }
    nodeIdSet.add(n.id);

    if (typeof n.type !== 'string' || !VALID_NODE_TYPES.includes(n.type as NodeType)) {
      return {
        ok: false,
        errorType: 'INVALID_STRUCTURE',
        message: `Node "${n.id}" has an invalid node type "${String(n.type)}".`,
      };
    }

    if (
      typeof n.position !== 'object' ||
      n.position === null ||
      typeof (n.position as Record<string, unknown>).x !== 'number' ||
      !Number.isFinite((n.position as Record<string, unknown>).x) ||
      typeof (n.position as Record<string, unknown>).y !== 'number' ||
      !Number.isFinite((n.position as Record<string, unknown>).y)
    ) {
      return {
        ok: false,
        errorType: 'INVALID_STRUCTURE',
        message: `Node "${n.id}" has invalid or non-finite position coordinates.`,
      };
    }

    if (typeof n.data !== 'object' || n.data === null || Array.isArray(n.data)) {
      return {
        ok: false,
        errorType: 'INVALID_STRUCTURE',
        message: `Node "${n.id}" is missing data payload.`,
      };
    }

    const dataObj = n.data as Record<string, unknown>;
    if (typeof dataObj.label !== 'string' || dataObj.label.trim() === '') {
      return {
        ok: false,
        errorType: 'INVALID_STRUCTURE',
        message: `Node "${n.id}" has a missing or empty label.`,
      };
    }

    // Clean node construction
    validatedNodes.push(toDocumentNode(item as TreeNode) as unknown as TreeNode);
  }

  // 5. Validate edges and reference integrity (reject dangling edges)
  const validatedEdges: TreeEdge[] = [];
  const edgeIdSet = new Set<string>();

  for (let i = 0; i < raw.edges.length; i++) {
    const item = raw.edges[i];
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      return {
        ok: false,
        errorType: 'INVALID_STRUCTURE',
        message: `Edge at index ${i} is not a valid object.`,
      };
    }

    const e = item as Record<string, unknown>;

    if (typeof e.id !== 'string' || e.id.trim() === '') {
      return {
        ok: false,
        errorType: 'INVALID_STRUCTURE',
        message: `Edge at index ${i} has a missing or invalid ID.`,
      };
    }

    if (edgeIdSet.has(e.id)) {
      return {
        ok: false,
        errorType: 'INVALID_STRUCTURE',
        message: `Duplicate edge ID "${e.id}" detected in persisted document.`,
      };
    }
    edgeIdSet.add(e.id);

    if (typeof e.source !== 'string' || !nodeIdSet.has(e.source)) {
      return {
        ok: false,
        errorType: 'DANGLING_EDGE',
        message: `Edge "${e.id}" references non-existent source node "${String(e.source)}".`,
      };
    }

    if (typeof e.target !== 'string' || !nodeIdSet.has(e.target)) {
      return {
        ok: false,
        errorType: 'DANGLING_EDGE',
        message: `Edge "${e.id}" references non-existent target node "${String(e.target)}".`,
      };
    }

    validatedEdges.push(toDocumentEdge(item as TreeEdge) as unknown as TreeEdge);
  }

  // 6. Settings validation (optional)
  let validatedSettings: PersistedSettings | undefined;
  if (raw.settings && typeof raw.settings === 'object' && !Array.isArray(raw.settings)) {
    const s = raw.settings as Record<string, unknown>;
    validatedSettings = {};
    if (typeof s.theme === 'string') validatedSettings.theme = s.theme;
    if (typeof s.gridVisible === 'boolean') validatedSettings.gridVisible = s.gridVisible;
    if (typeof s.miniMapVisible === 'boolean') validatedSettings.miniMapVisible = s.miniMapVisible;
    if (typeof s.snapToGrid === 'boolean') validatedSettings.snapToGrid = s.snapToGrid;
  }

  const savedAt = typeof raw.savedAt === 'number' && Number.isFinite(raw.savedAt) ? raw.savedAt : Date.now();

  return {
    ok: true,
    document: {
      persistenceVersion: 1,
      savedAt,
      nodes: validatedNodes,
      edges: validatedEdges,
      settings: validatedSettings,
    },
  };
}

/**
 * Deserializes and validates a raw JSON string into a SavedWorkspaceDocument.
 * Protects against prototype pollution and syntax errors.
 */
export function deserializeWorkspace(rawJson: string): LoadResult {
  if (!rawJson || rawJson.trim() === '') {
    return {
      ok: false,
      errorType: 'NO_DATA',
      message: 'Persisted payload is empty.',
    };
  }

  if (getByteLength(rawJson) > MAX_PERSISTENCE_BYTES) {
    return {
      ok: false,
      errorType: 'PAYLOAD_TOO_LARGE',
      message: 'Persisted document exceeds the maximum 5 MiB storage limit.',
      rawPayload: rawJson.slice(0, 500),
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson, (key, value) => {
      if (UNSAFE_KEYS.includes(key as (typeof UNSAFE_KEYS)[number])) {
        throw new Error(`PROTOTYPE_POLLUTION: Forbidden key "${key}"`);
      }
      return value;
    });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes('PROTOTYPE_POLLUTION')) {
      return {
        ok: false,
        errorType: 'PROTOTYPE_POLLUTION',
        message: 'Security Violation: Persisted payload contains prototype pollution properties.',
        rawPayload: rawJson,
      };
    }
    return {
      ok: false,
      errorType: 'CORRUPTED_JSON',
      message: `Failed to parse saved document JSON: ${msg}`,
      rawPayload: rawJson,
    };
  }

  const validation = validateWorkspaceDocument(parsed);
  if (!validation.ok) {
    return {
      ok: false,
      errorType: validation.errorType,
      message: validation.message,
      rawPayload: rawJson,
    };
  }

  return {
    ok: true,
    document: validation.document,
    source: 'storage',
  };
}

// ============================================================================
// LOCAL STORAGE ADAPTERS
// ============================================================================

/**
 * Loads and validates the persisted workspace from localStorage.
 */
export function loadPersistedWorkspace(storage?: Storage | null): LoadResult {
  const s = storage !== undefined ? (storage ?? undefined) : (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!s) {
    return {
      ok: false,
      errorType: 'STORAGE_UNAVAILABLE',
      message: 'Browser storage is unavailable in this environment.',
    };
  }

  let raw: string | null;
  try {
    raw = s.getItem(PERSISTENCE_STORAGE_KEY);
  } catch (err) {
    return {
      ok: false,
      errorType: 'STORAGE_UNAVAILABLE',
      message: `Failed to access localStorage: ${(err as Error).message}`,
    };
  }

  if (raw === null || raw.trim() === '') {
    return {
      ok: false,
      errorType: 'NO_DATA',
      message: 'No saved workspace exists in localStorage.',
    };
  }

  return deserializeWorkspace(raw);
}

/**
 * Atomically serializes and saves the workspace document to localStorage.
 * If serialization fails, the existing saved payload is never touched.
 */
export function savePersistedWorkspace(
  nodes: readonly TreeNode[],
  edges: readonly TreeEdge[],
  settings?: PersistedSettings,
  storage?: Storage | null
): SaveResult {
  const s = storage !== undefined ? (storage ?? undefined) : (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!s) {
    return {
      ok: false,
      errorType: 'STORAGE_UNAVAILABLE',
      message: 'Browser storage is unavailable.',
    };
  }

  // 1. Serialize complete new payload first in memory
  let serialized: string;
  const savedAt = Date.now();
  try {
    serialized = serializeWorkspace(nodes, edges, settings, savedAt);
  } catch (err) {
    return {
      ok: false,
      errorType: 'WRITE_FAILED',
      message: `Failed to serialize workspace document: ${(err as Error).message}`,
    };
  }

  // 2. Validate payload size
  const byteLength = getByteLength(serialized);
  if (byteLength > MAX_PERSISTENCE_BYTES) {
    return {
      ok: false,
      errorType: 'PAYLOAD_TOO_LARGE',
      message: `Document size (${(byteLength / (1024 * 1024)).toFixed(2)} MiB) exceeds the 5 MiB ceiling.`,
    };
  }

  // 3. Write to storage
  try {
    s.setItem(PERSISTENCE_STORAGE_KEY, serialized);
    return {
      ok: true,
      savedAt,
      byteLength,
    };
  } catch (err) {
    const error = err as Error;
    const isQuota =
      error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      error.message.includes('quota');

    return {
      ok: false,
      errorType: isQuota ? 'QUOTA_EXCEEDED' : 'WRITE_FAILED',
      message: isQuota
        ? 'Browser storage quota exceeded. Unable to save latest changes.'
        : `Storage write failed: ${error.message}`,
    };
  }
}

/**
 * Clears the persisted document key from localStorage.
 */
export function clearPersistedWorkspace(storage?: Storage | null): boolean {
  try {
    const s = storage !== undefined ? (storage ?? undefined) : (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!s) return false;
    s.removeItem(PERSISTENCE_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
