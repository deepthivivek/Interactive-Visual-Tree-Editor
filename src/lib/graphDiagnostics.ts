import type { TreeNode, TreeEdge, NodeType } from '../types/tree';
import {
  isValidParentChildRelationship,
  getAllowedChildTypes,
} from './relationshipRules';
import { hasAnyCycle } from './cycleDetection';

/**
 * Diagnostic issue severity level.
 */
export type DiagnosticSeverity = 'error' | 'warning' | 'info';

/**
 * Diagnostic issue category.
 */
export type DiagnosticCategory =
  | 'hierarchy'
  | 'connection'
  | 'orphaned'
  | 'metadata'
  | 'cycle';

/**
 * Individual graph diagnostic issue item.
 */
export interface GraphDiagnosticIssue {
  id: string;
  severity: DiagnosticSeverity;
  category: DiagnosticCategory;
  title: string;
  description: string;
  nodeId?: string;
  edgeId?: string;
  fixSuggestion?: string;
}

/**
 * Overall graph structural health metrics.
 */
export interface GraphStructuralMetrics {
  nodeCount: number;
  edgeCount: number;
  rootCount: number;
  ruleCount: number;
  conditionCount: number;
  actionCount: number;
  leafCount: number;
  maxDepth: number;
  orphanedCount: number;
}

/**
 * Result of pure graph diagnostics execution.
 */
export interface GraphDiagnosticsResult {
  status: 'healthy' | 'warning' | 'error';
  errorCount: number;
  warningCount: number;
  infoCount: number;
  totalIssues: number;
  issues: GraphDiagnosticIssue[];
  metrics: GraphStructuralMetrics;
  timestamp: number;
}

/**
 * Pure function to compute maximum depth and node levels in a directed graph.
 */
function computeTreeMetrics(nodes: TreeNode[], edges: TreeEdge[]): {
  maxDepth: number;
  leafCount: number;
  incomingMap: Map<string, string[]>;
  outgoingMap: Map<string, string[]>;
} {
  const incomingMap = new Map<string, string[]>();
  const outgoingMap = new Map<string, string[]>();

  for (const node of nodes) {
    incomingMap.set(node.id, []);
    outgoingMap.set(node.id, []);
  }

  for (const edge of edges) {
    if (incomingMap.has(edge.target)) {
      incomingMap.get(edge.target)!.push(edge.source);
    }
    if (outgoingMap.has(edge.source)) {
      outgoingMap.get(edge.source)!.push(edge.target);
    }
  }

  // Find root nodes (type === 'root' or zero incoming edges)
  const rootIds = nodes
    .filter((n) => n.type === 'root' || (incomingMap.get(n.id)?.length === 0 && (outgoingMap.get(n.id)?.length ?? 0) > 0))
    .map((n) => n.id);

  let maxDepth = 0;
  let leafCount = 0;

  for (const node of nodes) {
    const out = outgoingMap.get(node.id) || [];
    if (out.length === 0) {
      leafCount++;
    }
  }

  // BFS / DFS to measure depth from roots
  const visited = new Set<string>();
  const queue: Array<{ id: string; depth: number }> = rootIds.map((id) => ({ id, depth: 1 }));

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    if (depth > maxDepth) {
      maxDepth = depth;
    }

    const children = outgoingMap.get(id) || [];
    for (const childId of children) {
      if (!visited.has(childId)) {
        queue.push({ id: childId, depth: depth + 1 });
      }
    }
  }

  return { maxDepth, leafCount, incomingMap, outgoingMap };
}

/**
 * Pure engine that performs comprehensive graph diagnostics on a tree model.
 * Does not mutate nodes, edges, or DOM.
 */
export function runGraphDiagnostics(
  nodes: TreeNode[],
  edges: TreeEdge[]
): GraphDiagnosticsResult {
  const issues: GraphDiagnosticIssue[] = [];

  const nodeMap = new Map<string, TreeNode>();
  let rootCount = 0;
  let ruleCount = 0;
  let conditionCount = 0;
  let actionCount = 0;

  for (const node of nodes) {
    nodeMap.set(node.id, node);
    if (node.type === 'root') rootCount++;
    else if (node.type === 'rule') ruleCount++;
    else if (node.type === 'condition') conditionCount++;
    else if (node.type === 'action') actionCount++;
  }

  const { maxDepth, leafCount, incomingMap, outgoingMap } = computeTreeMetrics(nodes, edges);

  // 1. Root Node Count Diagnostics
  if (nodes.length === 0) {
    issues.push({
      id: 'empty-graph',
      severity: 'info',
      category: 'hierarchy',
      title: 'Empty Graph',
      description: 'The canvas contains no nodes. Add a Root Policy node to begin.',
      fixSuggestion: 'Drag a Root Policy node from the palette onto the canvas.',
    });
  } else if (rootCount === 0) {
    issues.push({
      id: 'missing-root',
      severity: 'error',
      category: 'hierarchy',
      title: 'Missing Root Policy Node',
      description: 'The graph does not contain any Root node. Every compliance policy tree requires exactly one Root.',
      fixSuggestion: 'Drag a Root Policy node onto the canvas and connect it to top-level rules.',
    });
  } else if (rootCount > 1) {
    issues.push({
      id: 'multiple-roots',
      severity: 'warning',
      category: 'hierarchy',
      title: 'Multiple Root Nodes Detected',
      description: `Found ${rootCount} Root nodes. Policy trees typically follow a single unified hierarchy under one Root.`,
      fixSuggestion: 'Consolidate multiple policy trees or remove superfluous root nodes.',
    });
  }

  // 2. Cycle Detection
  if (hasAnyCycle(edges)) {
    issues.push({
      id: 'detected-cycle',
      severity: 'error',
      category: 'cycle',
      title: 'Directed Cycle Detected',
      description: 'A circular dependency was found in the graph. Compliance trees must be acyclic hierarchies.',
      fixSuggestion: 'Remove or reconnect the loop edge causing the circular reference.',
    });
  }

  // 3. Edge & Connection Diagnostics
  const edgeTargetCounts = new Map<string, number>();

  for (const edge of edges) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);

    // Missing endpoints
    if (!sourceNode || !targetNode) {
      issues.push({
        id: `broken-edge-${edge.id}`,
        severity: 'error',
        category: 'connection',
        title: 'Broken Connection Reference',
        description: `Edge "${edge.id}" references non-existent node endpoints (source: "${edge.source}", target: "${edge.target}").`,
        edgeId: edge.id,
        fixSuggestion: 'Delete the orphaned edge.',
      });
      continue;
    }

    // Self-loops
    if (edge.source === edge.target) {
      issues.push({
        id: `self-loop-${edge.id}`,
        severity: 'error',
        category: 'connection',
        title: 'Self-Loop Detected',
        description: `Node "${sourceNode.data.label || sourceNode.id}" connects directly to itself.`,
        nodeId: sourceNode.id,
        edgeId: edge.id,
        fixSuggestion: 'Delete this self-referencing edge.',
      });
      continue;
    }

    // Relationship Rules Check
    const isValid = isValidParentChildRelationship(
      sourceNode.type as NodeType,
      targetNode.type as NodeType
    );
    if (!isValid) {
      const allowed = getAllowedChildTypes(sourceNode.type as NodeType);
      const allowedDesc = allowed.length > 0 ? allowed.join(', ') : 'none';
      issues.push({
        id: `invalid-relationship-${edge.id}`,
        severity: 'error',
        category: 'connection',
        title: `Invalid Connection: ${sourceNode.type} → ${targetNode.type}`,
        description: `Cannot connect "${sourceNode.data.label || sourceNode.id}" (${sourceNode.type}) to "${targetNode.data.label || targetNode.id}" (${targetNode.type}). Allowed child types: ${allowedDesc}.`,
        nodeId: targetNode.id,
        edgeId: edge.id,
        fixSuggestion: 'Reconnect to an allowable parent node according to policy rules.',
      });
    }

    // Incoming count tracking for single-parent tree rule
    edgeTargetCounts.set(edge.target, (edgeTargetCounts.get(edge.target) || 0) + 1);
  }

  // 4. Single-Parent Rule (Tree Invariant)
  for (const [targetId, count] of edgeTargetCounts.entries()) {
    if (count > 1) {
      const targetNode = nodeMap.get(targetId);
      issues.push({
        id: `multiple-parents-${targetId}`,
        severity: 'error',
        category: 'hierarchy',
        title: 'Multiple Parents Violation',
        description: `Node "${targetNode?.data.label || targetId}" has ${count} incoming connections. A strict tree node must have at most 1 parent.`,
        nodeId: targetId,
        fixSuggestion: 'Remove excess incoming connections until the node has a single parent.',
      });
    }
  }

  // 5. Node Isolation & Completeness Diagnostics
  let orphanedCount = 0;

  for (const node of nodes) {
    const incoming = incomingMap.get(node.id) || [];
    const outgoing = outgoingMap.get(node.id) || [];
    const isOrphan = incoming.length === 0 && outgoing.length === 0;

    // Orphaned node (non-root node with zero incoming and zero outgoing edges)
    if (isOrphan && node.type !== 'root') {
      orphanedCount++;
      issues.push({
        id: `orphan-${node.id}`,
        severity: 'warning',
        category: 'orphaned',
        title: `Disconnected Node: ${node.data.label || node.id}`,
        description: `This ${node.type} node has no connections to the rest of the compliance hierarchy.`,
        nodeId: node.id,
        fixSuggestion: 'Connect this node to an appropriate parent in the tree.',
      });
    }

    // Non-root with zero incoming (rootless branch)
    if (node.type !== 'root' && incoming.length === 0 && outgoing.length > 0) {
      issues.push({
        id: `rootless-branch-${node.id}`,
        severity: 'warning',
        category: 'hierarchy',
        title: `Unanchored Subtree at "${node.data.label || node.id}"`,
        description: `This ${node.type} has children but is not connected to a parent or the Root policy.`,
        nodeId: node.id,
        fixSuggestion: 'Connect this branch to an upstream Rule or Root node.',
      });
    }

    // Completeness Checks
    const label = node.data.label?.trim();
    if (!label) {
      issues.push({
        id: `empty-label-${node.id}`,
        severity: 'error',
        category: 'metadata',
        title: `Missing Node Label (${node.type})`,
        description: `Node ${node.id} has an empty label, making it difficult to identify in audits.`,
        nodeId: node.id,
        fixSuggestion: 'Enter a descriptive label in the Properties Inspector.',
      });
    }

    // Rule Nodes: missing ruleId check
    if (node.type === 'rule' && !node.data.ruleId?.trim()) {
      issues.push({
        id: `missing-rule-id-${node.id}`,
        severity: 'warning',
        category: 'metadata',
        title: `Missing Rule ID on "${node.data.label || node.id}"`,
        description: 'Rule nodes should specify a formal regulatory Rule ID (e.g., FINRA-2210, SEC-17a-4).',
        nodeId: node.id,
        fixSuggestion: 'Assign a Rule ID code in the Properties Inspector.',
      });
    }

    // Lifecycle Status Checks
    if (node.data.status === 'deprecated') {
      issues.push({
        id: `deprecated-status-${node.id}`,
        severity: 'warning',
        category: 'metadata',
        title: `Deprecated Node: "${node.data.label || node.id}"`,
        description: 'This node is marked as deprecated and should be audited or retired.',
        nodeId: node.id,
        fixSuggestion: 'Update or archive deprecated compliance elements.',
      });
    } else if (node.data.status === 'draft') {
      issues.push({
        id: `draft-status-${node.id}`,
        severity: 'info',
        category: 'metadata',
        title: `Draft Node: "${node.data.label || node.id}"`,
        description: 'Node is currently in draft status and not yet active.',
        nodeId: node.id,
      });
    }
  }

  // Calculate summary counts
  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const infoCount = issues.filter((i) => i.severity === 'info').length;

  let status: 'healthy' | 'warning' | 'error' = 'healthy';
  if (errorCount > 0) {
    status = 'error';
  } else if (warningCount > 0) {
    status = 'warning';
  }

  const metrics: GraphStructuralMetrics = {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    rootCount,
    ruleCount,
    conditionCount,
    actionCount,
    leafCount,
    maxDepth,
    orphanedCount,
  };

  return {
    status,
    errorCount,
    warningCount,
    infoCount,
    totalIssues: issues.length,
    issues,
    metrics,
    timestamp: Date.now(),
  };
}
