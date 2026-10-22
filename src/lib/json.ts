/**
 * Enterprise-Grade Versioned JSON Import/Export Engine (Day 15).
 *
 * Implements:
 * - Versioned graph document specification (version: 1)
 * - Strict Zod schema validation (Zod v4 compatible)
 * - Safe pre-validation input guards (BOM, UTF-8 byte limits, max node limits)
 * - Complete prototype-pollution protections
 * - Two-phase transactional import: Prepare (pure) -> Commit (store)
 * - Idempotent normalization & runtime field stripping with non-blocking notes
 * - Deterministic, byte-identical serialization (fixed key ordering, 2-space indent, trailing newline)
 * - Centralized relationship rules & cycle detection integration
 * - Granular error catalogue with title, why, and how-to-fix guidance
 * - Non-blocking warnings vs blocking errors separation
 *
 * Pure and side-effect free: zero DOM or React component dependencies.
 */

import { z } from 'zod';
import type { TreeNode, TreeEdge, NodeType, NodeSeverity, NodeStatus } from '../types/tree';
import { isValidParentChildRelationship } from './relationshipRules';
import { findCyclePaths } from './cycleDetection';
import { validateGraph, type ValidationIssue } from './validation';
import { evaluateExportGuard } from './exportGuard';
import { getCanonicalSampleNodes, getCanonicalSampleEdges } from '../store/treeStore';

// ============================================================================
// CONSTANTS & LIMITS
// ============================================================================

export const CURRENT_VERSION = 1;
export const SUPPORTED_VERSIONS: readonly number[] = [1] as const;

/** Maximum encoded UTF-8 byte length allowed for import (5 MiB). */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

/** Maximum node count allowed for import. */
export const MAX_IMPORT_NODES = 5000;

/** Maximum errors to display in user-facing UI summaries before truncating. */
export const MAX_DISPLAY_ERRORS = 20;

// Runtime-only fields that belong to React Flow and should be stripped on export
// and safely cleaned up on import without blocking the user.
export const RUNTIME_NODE_FIELDS = [
  'selected',
  'dragging',
  'measured',
  'width',
  'height',
  'hidden',
  'resizing',
] as const;

export const RUNTIME_EDGE_FIELDS = [
  'selected',
] as const;

// Unsafe keys that must never be merged or evaluated (prototype pollution guards).
export const UNSAFE_KEYS = ['__proto__', 'constructor', 'prototype'] as const;

// ============================================================================
// PURE UTILITIES
// ============================================================================

/**
 * Calculates the exact UTF-8 byte length of a string.
 */
export function getUtf8ByteLength(str: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str).length;
  }
  return Buffer.from(str, 'utf-8').length;
}

/**
 * Formats a Date into a deterministic export filename:
 * `tree-editor-YYYYMMDD-HHmm.json` using UTC components.
 */
export function getExportFilename(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = date.getUTCFullYear();
  const MM = pad(date.getUTCMonth() + 1);
  const dd = pad(date.getUTCDate());
  const hh = pad(date.getUTCHours());
  const mm = pad(date.getUTCMinutes());
  return `tree-editor-${yyyy}${MM}${dd}-${hh}${mm}.json`;
}

// ============================================================================
// TYPES & ERROR CATALOGUE
// ============================================================================

export type ImportStage =
  | 'parse'
  | 'schema'
  | 'version'
  | 'normalize'
  | 'relationships'
  | 'cycles'
  | 'structure';

export type ImportErrorCode =
  | 'INPUT_EMPTY'
  | 'FILE_TOO_LARGE'
  | 'MAX_NODES_EXCEEDED'
  | 'NOT_AN_OBJECT'
  | 'JSON_SYNTAX_ERROR'
  | 'VERSION_MISSING'
  | 'VERSION_INVALID_TYPE'
  | 'VERSION_UNSUPPORTED'
  | 'VERSION_UNSUPPORTED_FUTURE'
  | 'PROTOTYPE_POLLUTION_DETECTED'
  | 'SCHEMA_UNKNOWN_KEY'
  | 'SCHEMA_MISSING_REQUIRED'
  | 'SCHEMA_INVALID_TYPE'
  | 'SCHEMA_VALIDATION_FAILED'
  | 'DUPLICATE_NODE_ID'
  | 'DUPLICATE_EDGE_ID'
  | 'DANGLING_EDGE_ENDPOINT'
  | 'SELF_LOOP'
  | 'DUPLICATE_EDGE'
  | 'INVALID_RELATIONSHIP'
  | 'CYCLE_DETECTED'
  | 'STRUCTURAL_CRITICAL'
  | 'STRUCTURAL_ERROR';

export interface ImportError {
  stage: ImportStage;
  code: ImportErrorCode;
  message: string;
  path?: string;
  line?: number;
  column?: number;
}

export interface ErrorCatalogueEntry {
  title: string;
  why: string;
  howToFix: string;
}

export const IMPORT_ERROR_MESSAGES: Record<ImportErrorCode, ErrorCatalogueEntry> = {
  INPUT_EMPTY: {
    title: 'Empty Document',
    why: 'The supplied input contains no data or only whitespace.',
    howToFix: 'Paste or upload a valid JSON tree document containing version, nodes, and edges.',
  },
  FILE_TOO_LARGE: {
    title: 'File Exceeds Size Limit',
    why: 'The file exceeds the maximum 5 MiB size ceiling.',
    howToFix: 'Ensure your JSON file is below 5 MiB by removing extraneous data or splitting workflows.',
  },
  MAX_NODES_EXCEEDED: {
    title: 'Maximum Node Limit Exceeded',
    why: `The document exceeds the limit of ${MAX_IMPORT_NODES} nodes.`,
    howToFix: `Reduce the graph size so it contains at most ${MAX_IMPORT_NODES} nodes.`,
  },
  NOT_AN_OBJECT: {
    title: 'Invalid Root Structure',
    why: 'The top-level JSON value must be a JSON object, not an array or primitive.',
    howToFix: 'Wrap your document in an object with "version", "nodes", and "edges" properties.',
  },
  JSON_SYNTAX_ERROR: {
    title: 'Malformed JSON Syntax',
    why: 'The text could not be parsed as valid JSON due to syntax errors (e.g. trailing commas, unquoted keys).',
    howToFix: 'Validate your JSON using a linter and fix any misplaced brackets or quotes.',
  },
  VERSION_MISSING: {
    title: 'Missing Document Version',
    why: 'The required top-level "version" property was not found.',
    howToFix: 'Add `"version": 1` to the root of the JSON document.',
  },
  VERSION_INVALID_TYPE: {
    title: 'Invalid Version Type',
    why: 'The "version" field must be an integer (e.g. 1), not a string or floating-point number.',
    howToFix: 'Change the version to an integer: `"version": 1`.',
  },
  VERSION_UNSUPPORTED: {
    title: 'Unsupported Version',
    why: 'The document specifies a version number not supported by this editor.',
    howToFix: 'Use document version 1 or run the appropriate migration.',
  },
  VERSION_UNSUPPORTED_FUTURE: {
    title: 'Newer Version Detected',
    why: 'This file was created by a newer version of this editor.',
    howToFix: 'Update your tree editor application to open this file.',
  },
  PROTOTYPE_POLLUTION_DETECTED: {
    title: 'Security Violation: Unsafe Object Keys',
    why: 'The document contains forbidden prototype pollution properties (__proto__, constructor, prototype).',
    howToFix: 'Remove any prototype-polluting properties from the JSON data.',
  },
  SCHEMA_UNKNOWN_KEY: {
    title: 'Unrecognized Property',
    why: 'A node, edge, or document object contains unexpected keys not defined in the schema.',
    howToFix: 'Remove the unrecognized key from the object or move it inside the parameters or metadata map.',
  },
  SCHEMA_MISSING_REQUIRED: {
    title: 'Missing Required Field',
    why: 'A required field such as id, type, position, or label is missing.',
    howToFix: 'Ensure every node has id, type, position (x, y), and data.label.',
  },
  SCHEMA_INVALID_TYPE: {
    title: 'Invalid Field Type',
    why: 'A field value does not conform to its required type schema.',
    howToFix: 'Ensure coordinates are finite numbers and node types match root, rule, condition, or action.',
  },
  SCHEMA_VALIDATION_FAILED: {
    title: 'Schema Validation Error',
    why: 'The document failed strict structural schema validation.',
    howToFix: 'Review the detailed schema issues and correct the values.',
  },
  DUPLICATE_NODE_ID: {
    title: 'Duplicate Node ID',
    why: 'Two or more nodes share the exact same identifier.',
    howToFix: 'Ensure every node in the graph has a unique ID string.',
  },
  DUPLICATE_EDGE_ID: {
    title: 'Duplicate Edge ID',
    why: 'Two or more edges share the exact same identifier.',
    howToFix: 'Ensure every connection edge has a unique ID string.',
  },
  DANGLING_EDGE_ENDPOINT: {
    title: 'Dangling Connection Edge',
    why: 'An edge refers to a source or target node ID that does not exist in the nodes array.',
    howToFix: 'Verify all edge source and target IDs reference existing nodes.',
  },
  SELF_LOOP: {
    title: 'Self-Connection Loop',
    why: 'An edge connects a node directly to itself.',
    howToFix: 'Remove the self-connecting edge; a node cannot be its own child.',
  },
  DUPLICATE_EDGE: {
    title: 'Duplicate Edge Connection',
    why: 'Multiple edges exist between the exact same source and target nodes.',
    howToFix: 'Remove redundant edges so at most one connection connects any two nodes.',
  },
  INVALID_RELATIONSHIP: {
    title: 'Invalid Hierarchical Relationship',
    why: 'An edge connects two node types that violate hierarchical policy grammar (e.g. Action having children).',
    howToFix: 'Follow allowed relationships: Root->Rule, Rule->Condition, Rule->Action, Condition->Action.',
  },
  CYCLE_DETECTED: {
    title: 'Circular Dependency (Cycle)',
    why: 'The connections form a closed directed loop, violating acyclic tree structure.',
    howToFix: 'Remove or reverse the edge that completes the cycle.',
  },
  STRUCTURAL_CRITICAL: {
    title: 'Critical Structural Error',
    why: 'The graph contains fatal structural flaws (e.g. missing root, multiple roots, or empty tree).',
    howToFix: 'Ensure the tree has exactly one Root node at the top of the hierarchy.',
  },
  STRUCTURAL_ERROR: {
    title: 'Structural Validation Error',
    why: 'The graph violates strict tree integrity invariants.',
    howToFix: 'Check the validation panel for specific remediation actions.',
  },
};

export interface ImportedGraph {
  version: 1;
  nodes: TreeNode[];
  edges: TreeEdge[];
}

export type ImportResult =
  | {
      ok: true;
      graph: ImportedGraph;
      notes: string[];
      warnings: ValidationIssue[];
    }
  | {
      ok: false;
      errors: ImportError[];
    };

// ============================================================================
// STRICT ZOD SCHEMAS
// ============================================================================

const ZodNodePosition = z
  .object({
    x: z.number().refine(Number.isFinite, { message: 'Position x must be a finite number' }),
    y: z.number().refine(Number.isFinite, { message: 'Position y must be a finite number' }),
  })
  .strict();

const ZodNodeData = z
  .object({
    label: z.string().min(1, 'Label cannot be empty'),
    ruleId: z.string().optional(),
    description: z.string().optional(),
    severity: z.enum(['info', 'low', 'medium', 'high', 'critical']).optional(),
    status: z.enum(['draft', 'active', 'deprecated', 'in_review', 'archived']).optional(),
    parameters: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
      .optional(),
    metadata: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
      .optional(),
    tags: z.array(z.string()).optional(),
    collapsed: z.boolean().optional(),
  })
  .strict();

export const ZodDocumentNode = z
  .object({
    id: z.string().min(1, 'Node ID cannot be empty'),
    type: z.enum(['root', 'rule', 'condition', 'action']),
    position: ZodNodePosition,
    data: ZodNodeData,
  })
  .strict();

export const ZodDocumentEdge = z
  .object({
    id: z.string().min(1, 'Edge ID cannot be empty'),
    source: z.string().min(1, 'Edge source cannot be empty'),
    target: z.string().min(1, 'Edge target cannot be empty'),
    sourceHandle: z.string().optional(),
    targetHandle: z.string().optional(),
    data: z
      .object({
        label: z.string().optional(),
        relationshipType: z
          .enum(['root-rule', 'rule-condition', 'rule-action', 'condition-action'])
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const ZodDocument = z
  .object({
    version: z.literal(1),
    nodes: z.array(ZodDocumentNode),
    edges: z.array(ZodDocumentEdge),
  })
  .strict();

// ============================================================================
// MIGRATION REGISTRY
// ============================================================================

export type MigrationFn = (doc: unknown) => {
  ok: boolean;
  document?: unknown;
  error?: string;
};

export const MIGRATION_REGISTRY: Record<number, MigrationFn> = {
  1: (doc: unknown) => ({ ok: true, document: doc }),
};

// ============================================================================
// SERIALIZATION & DETERMINISTIC EXPORT
// ============================================================================

/**
 * Normalizes a single live TreeNode into the canonical document schema node,
 * stripping all React Flow runtime properties (`selected`, `dragging`, `measured`, etc.)
 * while maintaining strict field order.
 */
export function toDocumentNode(node: TreeNode): Record<string, unknown> {
  const data: Record<string, unknown> = {
    label: node.data?.label ?? 'Node',
  };

  if (node.data?.ruleId !== undefined) data.ruleId = node.data.ruleId;
  if (node.data?.description !== undefined) data.description = node.data.description;
  if (node.data?.severity !== undefined) data.severity = node.data.severity;
  if (node.data?.status !== undefined) data.status = node.data.status;

  if (node.data?.parameters && Object.keys(node.data.parameters).length > 0) {
    const cleanParams: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node.data.parameters)) {
      if (!UNSAFE_KEYS.includes(k as (typeof UNSAFE_KEYS)[number])) {
        cleanParams[k] = v;
      }
    }
    data.parameters = cleanParams;
  }

  if (node.data?.metadata && Object.keys(node.data.metadata).length > 0) {
    const cleanMeta: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node.data.metadata)) {
      if (!UNSAFE_KEYS.includes(k as (typeof UNSAFE_KEYS)[number])) {
        cleanMeta[k] = v;
      }
    }
    data.metadata = cleanMeta;
  }

  if (Array.isArray(node.data?.tags) && node.data.tags.length > 0) {
    data.tags = [...node.data.tags];
  }

  if (typeof node.data?.collapsed === 'boolean') {
    data.collapsed = node.data.collapsed;
  }

  return {
    id: node.id,
    type: node.type,
    position: {
      x: Number.isFinite(node.position.x) ? Math.round(node.position.x) : 0,
      y: Number.isFinite(node.position.y) ? Math.round(node.position.y) : 0,
    },
    data,
  };
}

/**
 * Normalizes a live TreeEdge into the canonical document schema edge,
 * stripping runtime fields and keeping strict field order.
 */
export function toDocumentEdge(edge: TreeEdge): Record<string, unknown> {
  const docEdge: Record<string, unknown> = {
    id: edge.id,
    source: edge.source,
    target: edge.target,
  };

  if (edge.sourceHandle) docEdge.sourceHandle = edge.sourceHandle;
  if (edge.targetHandle) docEdge.targetHandle = edge.targetHandle;

  if (edge.data) {
    const cleanData: Record<string, unknown> = {};
    if (edge.data.label) cleanData.label = edge.data.label;
    if (edge.data.relationshipType) cleanData.relationshipType = edge.data.relationshipType;
    if (Object.keys(cleanData).length > 0) {
      docEdge.data = cleanData;
    }
  }

  return docEdge;
}

/**
 * Deterministically serializes a graph into a canonical JSON string.
 *
 * Requirements:
 * - Version is 1
 * - Nodes and edges in store order (no sorting)
 * - Fixed object-key order
 * - Exactly two-space indentation
 * - Exactly one trailing newline
 * - Excludes all runtime fields (selected, dragging, measured, etc.)
 * - Zero mutations to live input arrays or node objects
 */
export function exportGraph(nodes: readonly TreeNode[], edges: readonly TreeEdge[]): string {
  const document = {
    version: CURRENT_VERSION,
    nodes: nodes.map(toDocumentNode),
    edges: edges.map(toDocumentEdge),
  };

  return JSON.stringify(document, null, 2) + '\n';
}

// ============================================================================
// NORMALIZATION
// ============================================================================

/**
 * Recursively scans an object for unsafe prototype pollution keys.
 */
function containsUnsafeKeys(val: unknown): boolean {
  if (!val || typeof val !== 'object') return false;
  if (Array.isArray(val)) {
    return val.some(containsUnsafeKeys);
  }
  const keys = Object.getOwnPropertyNames(val);
  for (const k of keys) {
    if (UNSAFE_KEYS.includes(k as (typeof UNSAFE_KEYS)[number])) {
      return true;
    }
    if (containsUnsafeKeys((val as Record<string, unknown>)[k])) {
      return true;
    }
  }
  return false;
}

/**
 * Pure normalization of a raw document object.
 * Strips runtime fields, applies defaults safely, and records non-blocking notes.
 * Guarantees idempotence: normalize(normalize(doc)) deep equals normalize(doc).
 */
export function normalizeDocument(raw: Record<string, unknown>): {
  normalized: Record<string, unknown>;
  notes: string[];
} {
  const notes: string[] = [];

  const rawNodes = Array.isArray(raw.nodes) ? raw.nodes : [];
  const rawEdges = Array.isArray(raw.edges) ? raw.edges : [];

  const cleanNodes = rawNodes.map((n: unknown) => {
    if (!n || typeof n !== 'object' || Array.isArray(n)) return n;
    const nodeObj = { ...(n as Record<string, unknown>) };

    // Strip recognized runtime fields
    for (const rf of RUNTIME_NODE_FIELDS) {
      if (rf in nodeObj) {
        delete nodeObj[rf];
        notes.push(`Stripped runtime property "${rf}" from node "${nodeObj.id ?? 'unknown'}".`);
      }
    }

    if (nodeObj.position && typeof nodeObj.position === 'object' && !Array.isArray(nodeObj.position)) {
      const pos = nodeObj.position as Record<string, unknown>;
      nodeObj.position = {
        x: typeof pos.x === 'number' && Number.isFinite(pos.x) ? Math.round(pos.x) : 0,
        y: typeof pos.y === 'number' && Number.isFinite(pos.y) ? Math.round(pos.y) : 0,
      };
    }

    if (nodeObj.data && typeof nodeObj.data === 'object' && !Array.isArray(nodeObj.data)) {
      const data = { ...(nodeObj.data as Record<string, unknown>) };
      if (typeof data.collapsed !== 'boolean') {
        data.collapsed = false;
      }
      nodeObj.data = data;
    }

    return nodeObj;
  });

  const cleanEdges = rawEdges.map((e: unknown) => {
    if (!e || typeof e !== 'object' || Array.isArray(e)) return e;
    const edgeObj = { ...(e as Record<string, unknown>) };

    for (const rf of RUNTIME_EDGE_FIELDS) {
      if (rf in edgeObj) {
        delete edgeObj[rf];
        notes.push(`Stripped runtime property "${rf}" from edge "${edgeObj.id ?? 'unknown'}".`);
      }
    }

    return edgeObj;
  });

  const normalized = {
    version: raw.version ?? CURRENT_VERSION,
    nodes: cleanNodes,
    edges: cleanEdges,
  };

  return { normalized, notes };
}

// ============================================================================
// IMPORT PIPELINE (PREPARE PHASE)
// ============================================================================

/**
 * Executes Phase 1 (Prepare) of the import pipeline.
 *
 * Stages:
 * 1. Input emptiness check
 * 2. BOM stripping
 * 3. Byte size limit check
 * 4. Safe JSON parsing with syntax error mapping
 * 5. Top-level object verification
 * 6. Version verification & Migration registry dispatch
 * 7. Node count limit check
 * 8. Prototype-pollution security check
 * 9. Pre-normalization and runtime field stripping
 * 10. Strict Zod schema validation
 * 11. Graph identifier and reference integrity check
 * 12. Centralized relationship rules enforcement
 * 13. Cycle detection
 * 14. Structural validation via validateGraph (distinguishing blocking errors from warnings)
 *
 * Guarantees:
 * - 100% pure and immutable: zero mutations to the active store or input arguments.
 * - If any blocking error occurs, returns `{ ok: false, errors }` with actionable next steps.
 * - Non-blocking warnings are returned cleanly without blocking import.
 */
export function prepareGraphImport(rawInput: string): ImportResult {
  const errors: ImportError[] = [];
  const notes: string[] = [];

  // Stage 1: Empty or whitespace-only input check
  if (!rawInput || rawInput.trim() === '') {
    return {
      ok: false,
      errors: [
        {
          stage: 'parse',
          code: 'INPUT_EMPTY',
          message: 'The input is empty or contains only whitespace.',
        },
      ],
    };
  }

  // Stage 2: Leading BOM stripping
  let processedInput = rawInput;
  if (processedInput.charCodeAt(0) === 0xfeff) {
    processedInput = processedInput.slice(1);
    notes.push('Stripped leading Unicode Byte Order Mark (BOM).');
  }

  // Stage 3: Encoded byte length check
  const byteLength = getUtf8ByteLength(processedInput);
  if (byteLength > MAX_IMPORT_BYTES) {
    return {
      ok: false,
      errors: [
        {
          stage: 'parse',
          code: 'FILE_TOO_LARGE',
          message: `File size (${(byteLength / (1024 * 1024)).toFixed(2)} MiB) exceeds the maximum allowed limit of 5 MiB.`,
        },
      ],
    };
  }

  // Stage 4: JSON Syntax parsing & Prototype Pollution check via reviver
  let parsed: unknown;
  try {
    parsed = JSON.parse(processedInput, (key, value) => {
      if (UNSAFE_KEYS.includes(key as (typeof UNSAFE_KEYS)[number])) {
        throw new Error(`PROTOTYPE_POLLUTION_DETECTED: Forbidden key "${key}"`);
      }
      return value;
    });
  } catch (err) {
    const syntaxErr = err as Error;
    if (syntaxErr.message.includes('PROTOTYPE_POLLUTION_DETECTED')) {
      return {
        ok: false,
        errors: [
          {
            stage: 'schema',
            code: 'PROTOTYPE_POLLUTION_DETECTED',
            message: 'Document contains forbidden prototype property (__proto__, constructor, or prototype).',
          },
        ],
      };
    }
    let line: number | undefined;
    let column: number | undefined;

    // Attempt to extract line and column numbers from SyntaxError message
    const lineColMatch = syntaxErr.message.match(/line (\d+) column (\d+)/i);
    if (lineColMatch) {
      line = parseInt(lineColMatch[1], 10);
      column = parseInt(lineColMatch[2], 10);
    } else {
      const posMatch = syntaxErr.message.match(/position (\d+)/i);
      if (posMatch) {
        const charPos = parseInt(posMatch[1], 10);
        const prefix = processedInput.slice(0, charPos);
        const lines = prefix.split('\n');
        line = lines.length;
        column = lines[lines.length - 1].length + 1;
      }
    }

    return {
      ok: false,
      errors: [
        {
          stage: 'parse',
          code: 'JSON_SYNTAX_ERROR',
          message: `Malformed JSON: ${syntaxErr.message}`,
          line,
          column,
        },
      ],
    };
  }

  // Stage 5: Top-level object verification
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      ok: false,
      errors: [
        {
          stage: 'schema',
          code: 'NOT_AN_OBJECT',
          message: 'Top-level JSON value must be an object containing version, nodes, and edges.',
        },
      ],
    };
  }

  const rawObj = parsed as Record<string, unknown>;

  // Stage 6: Version checking & Migration
  if (!('version' in rawObj)) {
    return {
      ok: false,
      errors: [
        {
          stage: 'version',
          code: 'VERSION_MISSING',
          message: 'Document is missing the required "version" property.',
          path: 'version',
        },
      ],
    };
  }

  if (typeof rawObj.version !== 'number' || !Number.isInteger(rawObj.version)) {
    return {
      ok: false,
      errors: [
        {
          stage: 'version',
          code: 'VERSION_INVALID_TYPE',
          message: `Document "version" must be an integer, but received ${typeof rawObj.version} (${JSON.stringify(rawObj.version)}).`,
          path: 'version',
        },
      ],
    };
  }

  const sourceVersion = rawObj.version;

  if (sourceVersion > CURRENT_VERSION) {
    return {
      ok: false,
      errors: [
        {
          stage: 'version',
          code: 'VERSION_UNSUPPORTED_FUTURE',
          message: `This file was created by a newer version of this editor (version ${sourceVersion}). Current supported version is ${CURRENT_VERSION}.`,
          path: 'version',
        },
      ],
    };
  }

  if (!SUPPORTED_VERSIONS.includes(sourceVersion)) {
    return {
      ok: false,
      errors: [
        {
          stage: 'version',
          code: 'VERSION_UNSUPPORTED',
          message: `Document version ${sourceVersion} is not supported. Supported versions: ${SUPPORTED_VERSIONS.join(', ')}.`,
          path: 'version',
        },
      ],
    };
  }

  // Dispatch migration
  const migrationFn = MIGRATION_REGISTRY[sourceVersion];
  if (!migrationFn) {
    return {
      ok: false,
      errors: [
        {
          stage: 'version',
          code: 'VERSION_UNSUPPORTED',
          message: `No migration found for version ${sourceVersion}.`,
          path: 'version',
        },
      ],
    };
  }

  const migrationRes = migrationFn(rawObj);
  if (!migrationRes.ok || !migrationRes.document) {
    return {
      ok: false,
      errors: [
        {
          stage: 'version',
          code: 'VERSION_UNSUPPORTED',
          message: migrationRes.error ?? `Migration from version ${sourceVersion} failed.`,
        },
      ],
    };
  }

  const migratedDoc = migrationRes.document as Record<string, unknown>;

  // Stage 7: Node count ceiling check
  if (Array.isArray(migratedDoc.nodes) && migratedDoc.nodes.length > MAX_IMPORT_NODES) {
    return {
      ok: false,
      errors: [
        {
          stage: 'normalize',
          code: 'MAX_NODES_EXCEEDED',
          message: `Document contains ${migratedDoc.nodes.length} nodes, which exceeds the limit of ${MAX_IMPORT_NODES} nodes.`,
          path: 'nodes',
        },
      ],
    };
  }

  // Stage 8: Prototype pollution protection
  if (containsUnsafeKeys(migratedDoc)) {
    return {
      ok: false,
      errors: [
        {
          stage: 'schema',
          code: 'PROTOTYPE_POLLUTION_DETECTED',
          message: 'Document contains forbidden prototype property (__proto__, constructor, or prototype).',
        },
      ],
    };
  }

  // Stage 9: Normalization (strip runtime fields, apply schema defaults)
  const { normalized, notes: normNotes } = normalizeDocument(migratedDoc);
  notes.push(...normNotes);

  // Stage 10: Strict Zod schema validation
  const parseResult = ZodDocument.safeParse(normalized);
  if (!parseResult.success) {
    for (const issue of parseResult.error.issues) {
      const pathStr = issue.path.join('.');
      let code: ImportErrorCode = 'SCHEMA_VALIDATION_FAILED';

      if (issue.code === 'unrecognized_keys') {
        const keys = (issue as unknown as { keys?: string[] }).keys ?? [];
        if (keys.some((k) => UNSAFE_KEYS.includes(k as (typeof UNSAFE_KEYS)[number]))) {
          code = 'PROTOTYPE_POLLUTION_DETECTED';
          errors.push({
            stage: 'schema',
            code,
            message: `Forbidden prototype pollution key "${keys.join(', ')}" detected at ${pathStr || 'root'}.`,
            path: pathStr || 'root',
          });
          continue;
        }

        code = 'SCHEMA_UNKNOWN_KEY';
        errors.push({
          stage: 'schema',
          code,
          message: `Unrecognized key "${keys.join(', ')}" found at ${pathStr || 'root'}.`,
          path: pathStr || 'root',
        });
        continue;
      }

      if (issue.code === 'invalid_type') {
        code = 'SCHEMA_INVALID_TYPE';
      }

      errors.push({
        stage: 'schema',
        code,
        message: issue.message,
        path: pathStr,
      });
    }

    return { ok: false, errors };
  }

  const validDoc = parseResult.data;
  const nodes: TreeNode[] = validDoc.nodes as TreeNode[];
  const edges: TreeEdge[] = validDoc.edges as TreeEdge[];

  // Stage 11: Graph Identifiers & Reference Integrity
  const nodeIdSet = new Set<string>();
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (nodeIdSet.has(n.id)) {
      errors.push({
        stage: 'structure',
        code: 'DUPLICATE_NODE_ID',
        message: `Duplicate node ID "${n.id}" found at index ${i}.`,
        path: `nodes[${i}].id`,
      });
    } else {
      nodeIdSet.add(n.id);
    }
  }

  const edgeIdSet = new Set<string>();
  const edgePairSet = new Set<string>();

  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    if (edgeIdSet.has(e.id)) {
      errors.push({
        stage: 'structure',
        code: 'DUPLICATE_EDGE_ID',
        message: `Duplicate edge ID "${e.id}" found at index ${i}.`,
        path: `edges[${i}].id`,
      });
    } else {
      edgeIdSet.add(e.id);
    }

    if (!nodeIdSet.has(e.source)) {
      errors.push({
        stage: 'structure',
        code: 'DANGLING_EDGE_ENDPOINT',
        message: `Edge "${e.id}" references non-existent source node "${e.source}".`,
        path: `edges[${i}].source`,
      });
    }

    if (!nodeIdSet.has(e.target)) {
      errors.push({
        stage: 'structure',
        code: 'DANGLING_EDGE_ENDPOINT',
        message: `Edge "${e.id}" references non-existent target node "${e.target}".`,
        path: `edges[${i}].target`,
      });
    }

    if (e.source === e.target) {
      errors.push({
        stage: 'structure',
        code: 'SELF_LOOP',
        message: `Edge "${e.id}" creates an invalid self-loop connection on node "${e.source}".`,
        path: `edges[${i}]`,
      });
    }

    const pairKey = `${e.source}->${e.target}`;
    if (edgePairSet.has(pairKey)) {
      errors.push({
        stage: 'structure',
        code: 'DUPLICATE_EDGE',
        message: `Duplicate connection exists from node "${e.source}" to node "${e.target}".`,
        path: `edges[${i}]`,
      });
    } else {
      edgePairSet.add(pairKey);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // Stage 12: Centralized Relationship Rules
  const nodeMap = new Map<string, TreeNode>(nodes.map((n) => [n.id, n]));
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    const sourceNode = nodeMap.get(e.source);
    const targetNode = nodeMap.get(e.target);

    if (sourceNode && targetNode) {
      if (!isValidParentChildRelationship(sourceNode.type, targetNode.type)) {
        errors.push({
          stage: 'relationships',
          code: 'INVALID_RELATIONSHIP',
          message: `Invalid relationship: ${sourceNode.type} node "${sourceNode.id}" cannot connect to ${targetNode.type} node "${targetNode.id}".`,
          path: `edges[${i}]`,
        });
      }
    }
  }

  // Stage 13: Cycle Detection
  const cyclePaths = findCyclePaths(edges);
  if (cyclePaths.length > 0) {
    for (const cycle of cyclePaths) {
      errors.push({
        stage: 'cycles',
        code: 'CYCLE_DETECTED',
        message: `Circular dependency detected: ${cycle.path.join(' -> ')}.`,
      });
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // Stage 14: Structural Validation (distinguishing blocking errors vs non-blocking warnings)
  const validationResult = validateGraph(nodes, edges);
  const warnings: ValidationIssue[] = [];

  for (const issue of validationResult.errors) {
    if (issue.severity === 'CRITICAL') {
      errors.push({
        stage: 'structure',
        code: 'STRUCTURAL_CRITICAL',
        message: issue.message,
        path: issue.nodeIds.length > 0 ? issue.nodeIds.join(', ') : undefined,
      });
    } else if (issue.severity === 'ERROR') {
      errors.push({
        stage: 'structure',
        code: 'STRUCTURAL_ERROR',
        message: issue.message,
        path: issue.nodeIds.length > 0 ? issue.nodeIds.join(', ') : undefined,
      });
    } else if (issue.severity === 'WARNING') {
      warnings.push(issue);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    graph: {
      version: 1,
      nodes,
      edges,
    },
    notes,
    warnings,
  };
}

// ============================================================================
// EXAMPLES (MOCK COMPLIANCE TEMPLATES)
// ============================================================================

/**
 * Valid sample compliance tree document fixture (pure, deterministic).
 */
export function getValidExampleDocument(): string {
  const nodes = getCanonicalSampleNodes();
  const edges = getCanonicalSampleEdges();
  return exportGraph(nodes, edges);
}

/**
 * Deliberately broken example fixture demonstrating actionable import errors.
 */
export function getBrokenExampleDocument(): string {
  const brokenDoc = {
    version: 1,
    nodes: [
      {
        id: 'root-broken-01',
        type: 'root',
        position: { x: 300, y: 50 },
        data: {
          label: 'Broken Framework Root (Mock)',
          severity: 'info',
          status: 'active',
        },
      },
      {
        id: 'action-invalid-parent',
        type: 'action',
        position: { x: 300, y: 220 },
        data: {
          label: 'Enforce Sanctions Action',
          severity: 'critical',
          status: 'active',
        },
      },
      {
        id: 'rule-illegal-child',
        type: 'rule',
        position: { x: 300, y: 380 },
        data: {
          label: 'Illegal Rule Child under Action',
          severity: 'high',
          status: 'draft',
        },
      },
    ],
    edges: [
      // Error 1: Root cannot connect directly to Action
      {
        id: 'e-broken-1',
        source: 'root-broken-01',
        target: 'action-invalid-parent',
      },
      // Error 2: Action cannot have Rule child (action-cannot-have-children)
      {
        id: 'e-broken-2',
        source: 'action-invalid-parent',
        target: 'rule-illegal-child',
      },
      // Error 3: Cycle back from rule to root
      {
        id: 'e-broken-3',
        source: 'rule-illegal-child',
        target: 'root-broken-01',
      },
    ],
  };

  return JSON.stringify(brokenDoc, null, 2) + '\n';
}
