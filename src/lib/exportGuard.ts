/**
 * Export Guard Engine (Day 14).
 * Validates graph structure and completeness prior to JSON export,
 * preventing export of severely invalid or broken graphs unless explicitly overridden.
 */

import type { TreeNode, TreeEdge } from '../types/tree';
import { validateGraph, type ValidationResult } from './validation';

export interface ExportGuardResult {
  allowed: boolean;
  validation: ValidationResult;
  reason?: string;
}

export function evaluateExportGuard(
  nodes: readonly TreeNode[],
  edges: readonly TreeEdge[],
  options: { allowWarnings?: boolean; strict?: boolean } = {}
): ExportGuardResult {
  const validation = validateGraph(nodes, edges);

  if (nodes.length === 0) {
    return {
      allowed: false,
      validation,
      reason: 'Cannot export an empty graph.',
    };
  }

  // If there are critical errors (e.g. empty graph, multiple roots, or structural failure)
  const hasCritical = validation.errors.some(
    (e) => e.severity === 'CRITICAL' || e.type === 'EMPTY_GRAPH' || e.type === 'MISSING_ROOT'
  );

  if (hasCritical) {
    return {
      allowed: false,
      validation,
      reason: 'Export blocked: Graph contains critical structural errors (missing root, empty graph, or circular dependencies).',
    };
  }

  if (options.strict && validation.errors.length > 0) {
    return {
      allowed: false,
      validation,
      reason: 'Export blocked in strict mode due to validation errors.',
    };
  }

  return {
    allowed: true,
    validation,
  };
}
