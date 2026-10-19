/**
 * Advanced Explainable Graph Validation Engine (Day 13).
 *
 * Design & Quality Principles:
 * - Pure and read-only: zero mutations to input nodes or edges.
 * - Framework-independent: zero imports of React, Zustand, DOM or UI.
 * - Deterministic: all issue IDs, ordering, and metrics are completely reproducible.
 * - Defensive: handles malformed input, missing fields, cycles, deep trees, and disconnected graphs.
 * - Transparent & Evidence-based: every issue reports exact graph evidence.
 * - Single source of truth: reuses centralized relationshipRules and cycleDetection.
 *
 * Note: This editor uses mock compliance templates for demonstration purposes.
 * Graph validity does NOT constitute legal compliance or regulatory certification.
 */

import type { TreeNode, TreeEdge, NodeType } from '../types/tree';
import {
  isValidParentChildRelationship,
  canAcceptChild,
  canHaveParent,
} from './relationshipRules';
import { findCyclePaths, type CycleEvidence } from './cycleDetection';

export type ValidationSeverity = 'CRITICAL' | 'ERROR' | 'WARNING';

export type ValidationIssueType =
  | 'EMPTY_GRAPH'
  | 'MISSING_ROOT'
  | 'MULTIPLE_ROOTS'
  | 'ROOT_HAS_PARENT'
  | 'CYCLE_DETECTED'
  | 'ORPHAN_NODE'
  | 'MULTIPLE_PARENTS'
  | 'INVALID_PARENT_CHILD_RELATIONSHIP'
  | 'ACTION_HAS_CHILDREN'
  | 'UNREACHABLE_NODE'
  | 'SECONDARY_ROOT_COMPONENT'
  | 'DUPLICATE_NODE_ID'
  | 'DUPLICATE_EDGE_ID'
  | 'DUPLICATE_EDGE_RELATIONSHIP'
  | 'SELF_LOOP_EDGE'
  | 'DANGLING_EDGE_SOURCE'
  | 'DANGLING_EDGE_TARGET'
  | 'MISSING_REQUIRED_FIELD'
  | 'EMPTY_ACTION_PARAMETERS'
  | 'MALFORMED_DATA';

export type ValidationConfidence = 'DIRECT' | 'DERIVED' | 'HYPOTHESIS';

export interface ValidationIssue {
  id: string;
  severity: ValidationSeverity;
  type: ValidationIssueType;
  message: string;
  nodeIds: string[];
  edgeIds: string[];
  field?: string;
  evidence: Record<string, unknown>;
  suggestedFix?: string;
  rootCauseGroupId?: string;
  confidence: ValidationConfidence;
  details?: Record<string, unknown>;
}

export interface GraphQualityMetrics {
  nodeCount: number;
  edgeCount: number;
  rootCount: number;
  orphanCount: number;
  cycleCount: number;
  connectedComponentCount: number;
  reachableNodeCount: number;
  unreachableNodeCount: number;
  completenessWarningCount: number;
}

export type ValidationCoverageCategory =
  | 'structure'
  | 'rootAndParent'
  | 'cycles'
  | 'relationshipRules'
  | 'identifierAndEdgeIntegrity'
  | 'requiredFields'
  | 'completeness';

export type ValidationCoverageStatus =
  | 'COMPLETED'
  | 'COMPLETED_WITH_LIMITATIONS'
  | 'NOT_COMPLETED';

export interface ValidationCoverageItem {
  status: ValidationCoverageStatus;
  limitations?: string[];
}

export type ValidationCoverageReport = Record<
  ValidationCoverageCategory,
  ValidationCoverageItem
>;

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  issues: ValidationIssue[];
  affectedNodeIds: string[];
  metrics: GraphQualityMetrics;
  coverage: ValidationCoverageReport;
  score: number;
}

export interface ValidationOptions {
  includeOptionalScore?: boolean;
}

/**
 * Deterministic severity order for stable issue sorting:
 * CRITICAL (0) < ERROR (1) < WARNING (2)
 */
const SEVERITY_ORDER: Record<ValidationSeverity, number> = {
  CRITICAL: 0,
  ERROR: 1,
  WARNING: 2,
};

/**
 * Calculates a transparent graph-quality heuristic score (0-100).
 *
 * Heuristic breakdown:
 * - Empty graph: 0
 * - Base score: 100
 * - Critical cycles: -35 per cycle
 * - Structural errors: -12 per error
 * - Completeness warnings: -3 per warning
 * - If valid is false, score is capped at 85 to never mislead users.
 */
export function calculateIntegrityScore(
  nodeCount: number,
  criticalCount: number,
  errorCount: number,
  warningCount: number,
  valid: boolean
): number {
  if (nodeCount === 0) return 0;

  const deductions =
    criticalCount * 35 +
    errorCount * 12 +
    warningCount * 3;

  let score = Math.max(0, 100 - deductions);
  if (!valid && score > 85) {
    score = 85;
  }
  return score;
}

/**
 * Main Pure Graph Validation Engine.
 *
 * Validates the entire graph deterministically against structural invariants,
 * hierarchy grammar, cycle safety, identifier integrity, and required field completeness.
 *
 * Note: Considers ALL nodes and edges, including collapsed/hidden descendants.
 */
export function validateGraph(
  nodesInput: unknown,
  edgesInput: unknown,
  _options?: ValidationOptions
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const coverage: ValidationCoverageReport = {
    structure: { status: 'COMPLETED' },
    rootAndParent: { status: 'COMPLETED' },
    cycles: { status: 'COMPLETED' },
    relationshipRules: { status: 'COMPLETED' },
    identifierAndEdgeIntegrity: { status: 'COMPLETED' },
    requiredFields: { status: 'COMPLETED' },
    completeness: { status: 'COMPLETED' },
  };

  // 1. Defensive input validation
  const nodes = Array.isArray(nodesInput) ? (nodesInput as TreeNode[]) : [];
  const edges = Array.isArray(edgesInput) ? (edgesInput as TreeEdge[]) : [];

  if (!Array.isArray(nodesInput) || !Array.isArray(edgesInput)) {
    issues.push({
      id: 'issue-malformed-input',
      severity: 'ERROR',
      type: 'MALFORMED_DATA',
      message: 'Graph nodes or edges collection is not an array.',
      nodeIds: [],
      edgeIds: [],
      evidence: {
        isNodesArray: Array.isArray(nodesInput),
        isEdgesArray: Array.isArray(edgesInput),
      },
      suggestedFix: 'Provide valid arrays of graph nodes and edges.',
      confidence: 'DIRECT',
    });
    coverage.structure.status = 'COMPLETED_WITH_LIMITATIONS';
    coverage.structure.limitations = ['Malformed input arrays received'];
  }

  // 2. Empty graph check
  if (nodes.length === 0) {
    issues.push({
      id: 'issue-empty-graph',
      severity: 'ERROR',
      type: 'EMPTY_GRAPH',
      message: 'The tree is empty. Add a Root node to begin building.',
      nodeIds: [],
      edgeIds: [],
      evidence: { nodeCount: 0, edgeCount: edges.length },
      suggestedFix: 'Drag or create a Root node on the canvas.',
      confidence: 'DIRECT',
    });

    const metrics: GraphQualityMetrics = {
      nodeCount: 0,
      edgeCount: edges.length,
      rootCount: 0,
      orphanCount: 0,
      cycleCount: 0,
      connectedComponentCount: 0,
      reachableNodeCount: 0,
      unreachableNodeCount: 0,
      completenessWarningCount: 0,
    };

    return {
      valid: false,
      errors: issues,
      warnings: [],
      issues,
      affectedNodeIds: [],
      metrics,
      coverage,
      score: 0,
    };
  }

  // 3. Identifier integrity & node map construction
  const nodeMap = new Map<string, TreeNode>();
  const duplicateNodeIds = new Set<string>();
  const allNodeIds = new Set<string>();

  for (let idx = 0; idx < nodes.length; idx++) {
    const node = nodes[idx];
    if (!node || typeof node !== 'object') {
      issues.push({
        id: `issue-malformed-node-${idx}`,
        severity: 'ERROR',
        type: 'MALFORMED_DATA',
        message: `Node at index ${idx} is not a valid object.`,
        nodeIds: [],
        edgeIds: [],
        evidence: { index: idx, nodeValue: String(node) },
        confidence: 'DIRECT',
      });
      continue;
    }

    const id = typeof node.id === 'string' ? node.id.trim() : '';
    if (!id) {
      issues.push({
        id: `issue-missing-node-id-${idx}`,
        severity: 'ERROR',
        type: 'MISSING_REQUIRED_FIELD',
        message: `Node at index ${idx} is missing a required 'id' attribute.`,
        nodeIds: [],
        edgeIds: [],
        field: 'id',
        evidence: { index: idx },
        suggestedFix: 'Ensure every node has a non-empty string identifier.',
        confidence: 'DIRECT',
      });
      continue;
    }

    if (allNodeIds.has(id)) {
      duplicateNodeIds.add(id);
    } else {
      allNodeIds.add(id);
      nodeMap.set(id, node);
    }
  }

  if (duplicateNodeIds.size > 0) {
    const sortedDupIds = Array.from(duplicateNodeIds).sort();
    for (const dupId of sortedDupIds) {
      const occurrences = nodes.filter((n) => n?.id === dupId).length;
      issues.push({
        id: `issue-duplicate-node-id-${dupId}`,
        severity: 'ERROR',
        type: 'DUPLICATE_NODE_ID',
        message: `Duplicate node ID "${dupId}" detected in graph (${occurrences} occurrences).`,
        nodeIds: [dupId],
        edgeIds: [],
        evidence: { nodeId: dupId, occurrences },
        suggestedFix: 'Assign unique identifiers to each node to prevent ambiguous references.',
        rootCauseGroupId: `group-dup-id-${dupId}`,
        confidence: 'DIRECT',
      });
    }
    coverage.identifierAndEdgeIntegrity.status = 'COMPLETED_WITH_LIMITATIONS';
    coverage.identifierAndEdgeIntegrity.limitations = [
      'Duplicate node IDs introduce identity ambiguity in graph traversal',
    ];
  }

  // 4. Edge integrity & dangling edge detection
  const edgeMap = new Map<string, TreeEdge>();
  const duplicateEdgeIds = new Set<string>();
  const seenEdgeRelationships = new Map<string, string[]>(); // key: `${source}->${target}` => edgeIds
  const validEdges: TreeEdge[] = [];

  for (let idx = 0; idx < edges.length; idx++) {
    const edge = edges[idx];
    if (!edge || typeof edge !== 'object') {
      issues.push({
        id: `issue-malformed-edge-${idx}`,
        severity: 'ERROR',
        type: 'MALFORMED_DATA',
        message: `Edge at index ${idx} is not a valid object.`,
        nodeIds: [],
        edgeIds: [],
        evidence: { index: idx, edgeValue: String(edge) },
        confidence: 'DIRECT',
      });
      continue;
    }

    const edgeId = typeof edge.id === 'string' ? edge.id.trim() : '';
    if (!edgeId) {
      issues.push({
        id: `issue-missing-edge-id-${idx}`,
        severity: 'ERROR',
        type: 'MISSING_REQUIRED_FIELD',
        message: `Edge at index ${idx} is missing a required 'id' attribute.`,
        nodeIds: [],
        edgeIds: [],
        field: 'id',
        evidence: { index: idx },
        confidence: 'DIRECT',
      });
      continue;
    }

    if (edgeMap.has(edgeId)) {
      duplicateEdgeIds.add(edgeId);
    } else {
      edgeMap.set(edgeId, edge);
    }

    const sourceId = typeof edge.source === 'string' ? edge.source.trim() : '';
    const targetId = typeof edge.target === 'string' ? edge.target.trim() : '';

    const sourceExists = allNodeIds.has(sourceId);
    const targetExists = allNodeIds.has(targetId);

    // Dangling source
    if (!sourceExists) {
      issues.push({
        id: `issue-dangling-edge-source-${edgeId}`,
        severity: 'ERROR',
        type: 'DANGLING_EDGE_SOURCE',
        message: `Edge "${edgeId}" references non-existent source node "${sourceId || 'undefined'}".`,
        nodeIds: targetExists ? [targetId] : [],
        edgeIds: [edgeId],
        evidence: { edgeId, source: sourceId, sourceExists: false },
        suggestedFix: 'Reconnect the edge source to an existing node or remove the dangling edge.',
        rootCauseGroupId: `group-dangling-${edgeId}`,
        confidence: 'DIRECT',
      });
    }

    // Dangling target
    if (!targetExists) {
      issues.push({
        id: `issue-dangling-edge-target-${edgeId}`,
        severity: 'ERROR',
        type: 'DANGLING_EDGE_TARGET',
        message: `Edge "${edgeId}" references non-existent target node "${targetId || 'undefined'}".`,
        nodeIds: sourceExists ? [sourceId] : [],
        edgeIds: [edgeId],
        evidence: { edgeId, target: targetId, targetExists: false },
        suggestedFix: 'Reconnect the edge target to an existing node or remove the dangling edge.',
        rootCauseGroupId: `group-dangling-${edgeId}`,
        confidence: 'DIRECT',
      });
    }

    // Self-loop
    if (sourceExists && targetExists && sourceId === targetId) {
      issues.push({
        id: `issue-self-loop-${edgeId}`,
        severity: 'CRITICAL',
        type: 'SELF_LOOP_EDGE',
        message: `Self-loop detected on node "${sourceId}". Nodes cannot connect to themselves.`,
        nodeIds: [sourceId],
        edgeIds: [edgeId],
        evidence: { edgeId, node: sourceId },
        suggestedFix: 'Remove the self-connecting edge.',
        confidence: 'DIRECT',
      });
    }

    // Prohibited duplicate relationships (multiple directed edges between identical pair)
    if (sourceExists && targetExists && sourceId !== targetId) {
      const relKey = `${sourceId}->${targetId}`;
      const existingIds = seenEdgeRelationships.get(relKey) || [];
      existingIds.push(edgeId);
      seenEdgeRelationships.set(relKey, existingIds);

      validEdges.push(edge);
    }
  }

  // Report duplicate edge IDs
  if (duplicateEdgeIds.size > 0) {
    const sortedDupEdgeIds = Array.from(duplicateEdgeIds).sort();
    for (const dId of sortedDupEdgeIds) {
      issues.push({
        id: `issue-duplicate-edge-id-${dId}`,
        severity: 'ERROR',
        type: 'DUPLICATE_EDGE_ID',
        message: `Duplicate edge ID "${dId}" detected in graph.`,
        nodeIds: [],
        edgeIds: [dId],
        evidence: { edgeId: dId },
        suggestedFix: 'Ensure all edges have unique identifiers.',
        confidence: 'DIRECT',
      });
    }
  }

  // Report duplicate relationships
  for (const [relKey, eIds] of seenEdgeRelationships.entries()) {
    if (eIds.length > 1) {
      const [sId, tId] = relKey.split('->');
      issues.push({
        id: `issue-duplicate-relationship-${relKey}`,
        severity: 'ERROR',
        type: 'DUPLICATE_EDGE_RELATIONSHIP',
        message: `Multiple parallel connections (${eIds.length}) detected from "${sId}" to "${tId}".`,
        nodeIds: [sId, tId],
        edgeIds: eIds,
        evidence: { source: sId, target: tId, edgeCount: eIds.length, edgeIds: eIds },
        suggestedFix: 'Remove redundant duplicate connections between the same pair of nodes.',
        confidence: 'DIRECT',
      });
    }
  }

  // 5. Build incoming & outgoing topology maps based on valid edge endpoints
  const incomingEdgesMap = new Map<string, TreeEdge[]>();
  const outgoingEdgesMap = new Map<string, TreeEdge[]>();

  for (const nodeId of allNodeIds) {
    incomingEdgesMap.set(nodeId, []);
    outgoingEdgesMap.set(nodeId, []);
  }

  for (const edge of validEdges) {
    if (incomingEdgesMap.has(edge.target)) {
      incomingEdgesMap.get(edge.target)!.push(edge);
    }
    if (outgoingEdgesMap.has(edge.source)) {
      outgoingEdgesMap.get(edge.source)!.push(edge);
    }
  }

  // 6. Root & parent rules
  const rootNodes = nodes.filter((n) => n?.type === 'root');
  const rootCount = rootNodes.length;

  if (rootCount === 0) {
    issues.push({
      id: 'issue-missing-root',
      severity: 'ERROR',
      type: 'MISSING_ROOT',
      message: 'Tree does not have a Root node. Every valid policy hierarchy requires exactly one Root.',
      nodeIds: [],
      edgeIds: [],
      evidence: { rootCount: 0 },
      suggestedFix: 'Create a Root node to serve as the hierarchy anchor.',
      confidence: 'DIRECT',
    });
  } else if (rootCount > 1) {
    const rootIds = rootNodes.map((n) => n.id).sort();
    issues.push({
      id: `issue-multiple-roots-${rootIds.join('-')}`,
      severity: 'ERROR',
      type: 'MULTIPLE_ROOTS',
      message: `Multiple Root nodes detected (${rootCount}): [${rootIds.join(', ')}]. A tree must have exactly one Root.`,
      nodeIds: rootIds,
      edgeIds: [],
      evidence: { rootCount, rootIds },
      suggestedFix: 'Change secondary root nodes to Rule nodes or delete them.',
      confidence: 'DIRECT',
    });
  }

  // Check if any Root node has incoming edges
  for (const rootNode of rootNodes) {
    const inEdges = incomingEdgesMap.get(rootNode.id) || [];
    if (inEdges.length > 0) {
      const inEdgeIds = inEdges.map((e) => e.id);
      issues.push({
        id: `issue-root-has-parent-${rootNode.id}`,
        severity: 'ERROR',
        type: 'ROOT_HAS_PARENT',
        message: `Root node "${rootNode.data?.label || rootNode.id}" has ${inEdges.length} incoming parent connection(s). Root nodes cannot have parents.`,
        nodeIds: [rootNode.id],
        edgeIds: inEdgeIds,
        evidence: { rootId: rootNode.id, incomingEdgeCount: inEdges.length, edgeIds: inEdgeIds },
        suggestedFix: 'Remove incoming edges to the Root node.',
        confidence: 'DIRECT',
      });
    }
  }

  // 7. Non-root parent checks & multiple parents
  const nonRootNodes = nodes.filter((n) => n?.type !== 'root');
  for (const node of nonRootNodes) {
    if (!node?.id) continue;
    const inEdges = incomingEdgesMap.get(node.id) || [];

    if (inEdges.length === 0) {
      issues.push({
        id: `issue-orphan-node-${node.id}`,
        severity: 'ERROR',
        type: 'ORPHAN_NODE',
        message: `Node "${node.data?.label || node.id}" (${node.type}) has no incoming parent connection.`,
        nodeIds: [node.id],
        edgeIds: [],
        evidence: { nodeId: node.id, nodeType: node.type, incomingEdges: 0 },
        suggestedFix: `Connect a valid parent to this ${node.type} node.`,
        confidence: 'DIRECT',
      });
    } else if (inEdges.length > 1) {
      const inEdgeIds = inEdges.map((e) => e.id);
      const parentIds = inEdges.map((e) => e.source);
      issues.push({
        id: `issue-multiple-parents-${node.id}`,
        severity: 'ERROR',
        type: 'MULTIPLE_PARENTS',
        message: `Node "${node.data?.label || node.id}" has ${inEdges.length} parent connections. Trees strictly enforce a single parent per node.`,
        nodeIds: [node.id, ...parentIds],
        edgeIds: inEdgeIds,
        evidence: {
          nodeId: node.id,
          parentCount: inEdges.length,
          parentIds,
          edgeIds: inEdgeIds,
        },
        suggestedFix: 'Remove redundant incoming edges so the node has exactly one parent.',
        confidence: 'DIRECT',
      });
    }
  }

  // 8. Relationship grammar rules
  for (const edge of validEdges) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    if (!sourceNode || !targetNode) continue;

    const parentType = sourceNode.type;
    const childType = targetNode.type;

    // Check if parent can accept children (e.g. Action cannot have children)
    if (!canAcceptChild(parentType)) {
      issues.push({
        id: `issue-action-has-children-${edge.id}`,
        severity: 'ERROR',
        type: 'ACTION_HAS_CHILDREN',
        message: `Action node "${sourceNode.data?.label || sourceNode.id}" cannot have child connections (connected to "${targetNode.data?.label || targetNode.id}").`,
        nodeIds: [sourceNode.id, targetNode.id],
        edgeIds: [edge.id],
        evidence: {
          edgeId: edge.id,
          sourceType: parentType,
          targetType: childType,
        },
        suggestedFix: 'Remove child connections from the Action node.',
        confidence: 'DIRECT',
      });
    }

    // Check if target can have parent (e.g. Root cannot have parent)
    if (!canHaveParent(childType)) {
      // Handled above in ROOT_HAS_PARENT
    }

    // Check specific pairing grammar
    if (!isValidParentChildRelationship(parentType, childType)) {
      issues.push({
        id: `issue-invalid-relationship-${edge.id}`,
        severity: 'ERROR',
        type: 'INVALID_PARENT_CHILD_RELATIONSHIP',
        message: `Invalid relationship: "${parentType}" cannot be parent of "${childType}" (connection from "${sourceNode.data?.label || sourceNode.id}" to "${targetNode.data?.label || targetNode.id}").`,
        nodeIds: [sourceNode.id, targetNode.id],
        edgeIds: [edge.id],
        evidence: {
          edgeId: edge.id,
          parentType,
          childType,
          sourceId: sourceNode.id,
          targetId: targetNode.id,
        },
        suggestedFix: `Connect to an allowed child type according to policy grammar.`,
        confidence: 'DIRECT',
      });
    }
  }

  // 9. Cycle detection & structured cycle evidence
  const cycleEvidences = findCyclePaths(validEdges);
  const cycleCount = cycleEvidences.length;

  for (let idx = 0; idx < cycleEvidences.length; idx++) {
    const cycle = cycleEvidences[idx];
    const pathStr = cycle.path.join(' -> ');
    const uniqueCycleNodeIds = Array.from(new Set(cycle.path)).sort();

    issues.push({
      id: `issue-cycle-${uniqueCycleNodeIds.join('-')}`,
      severity: 'CRITICAL',
      type: 'CYCLE_DETECTED',
      message: `Directed cycle detected: ${pathStr}`,
      nodeIds: uniqueCycleNodeIds,
      edgeIds: cycle.edgeIds,
      evidence: {
        cycleIndex: idx + 1,
        path: cycle.path,
        edgeIds: cycle.edgeIds,
        length: cycle.path.length - 1,
      },
      suggestedFix: 'Break the circular dependency by removing an edge in the cycle path.',
      rootCauseGroupId: `group-cycle-${uniqueCycleNodeIds.join('-')}`,
      confidence: 'DIRECT',
    });
  }

  // 10. Reachability from Root and connected components
  let reachableNodeCount = 0;
  const reachableNodeIds = new Set<string>();

  if (rootNodes.length > 0) {
    // Traverse from the primary root (or all roots if multiple)
    const queue: string[] = rootNodes.map((r) => r.id);
    for (const rId of queue) {
      reachableNodeIds.add(rId);
    }

    while (queue.length > 0) {
      const curr = queue.shift()!;
      const outgoing = outgoingEdgesMap.get(curr) || [];
      for (const e of outgoing) {
        if (!reachableNodeIds.has(e.target) && allNodeIds.has(e.target)) {
          reachableNodeIds.add(e.target);
          queue.push(e.target);
        }
      }
    }
  }

  reachableNodeCount = reachableNodeIds.size;
  const unreachableNodeIds: string[] = [];

  for (const n of nodes) {
    if (n?.id && !reachableNodeIds.has(n.id)) {
      unreachableNodeIds.push(n.id);
    }
  }

  // Report secondary root-like components or unreachable clusters
  if (rootNodes.length === 1 && unreachableNodeIds.length > 0) {
    const sortedUnreachable = [...unreachableNodeIds].sort();
    issues.push({
      id: `issue-unreachable-nodes`,
      severity: 'ERROR',
      type: 'UNREACHABLE_NODE',
      message: `${sortedUnreachable.length} node(s) cannot be reached from the Root: [${sortedUnreachable.join(', ')}].`,
      nodeIds: sortedUnreachable,
      edgeIds: [],
      evidence: {
        unreachableCount: sortedUnreachable.length,
        unreachableNodeIds: sortedUnreachable,
      },
      suggestedFix: 'Connect unreachable subgraphs to the main tree hierarchy.',
      confidence: 'DERIVED',
    });
  }

  // Calculate connected components count (undirected)
  const undirectedAdj = new Map<string, string[]>();
  for (const nId of allNodeIds) {
    undirectedAdj.set(nId, []);
  }
  for (const e of validEdges) {
    if (undirectedAdj.has(e.source) && undirectedAdj.has(e.target)) {
      undirectedAdj.get(e.source)!.push(e.target);
      undirectedAdj.get(e.target)!.push(e.source);
    }
  }

  let connectedComponentCount = 0;
  const visitedComp = new Set<string>();
  for (const nId of allNodeIds) {
    if (!visitedComp.has(nId)) {
      connectedComponentCount++;
      const q = [nId];
      visitedComp.add(nId);
      while (q.length > 0) {
        const u = q.shift()!;
        const neighbors = undirectedAdj.get(u) || [];
        for (const v of neighbors) {
          if (!visitedComp.has(v)) {
            visitedComp.add(v);
            q.push(v);
          }
        }
      }
    }
  }

  // 11. Required fields & completeness checks
  let completenessWarningCount = 0;

  for (const node of nodes) {
    if (!node?.id) continue;
    const label = node.data?.label;

    // Node label is required and must not be blank
    if (typeof label !== 'string' || label.trim().length === 0) {
      issues.push({
        id: `issue-missing-label-${node.id}`,
        severity: 'ERROR',
        type: 'MISSING_REQUIRED_FIELD',
        message: `Node "${node.id}" has a missing or empty label.`,
        nodeIds: [node.id],
        edgeIds: [],
        field: 'label',
        evidence: { nodeId: node.id, labelValue: label },
        suggestedFix: 'Provide a descriptive name/label for the node.',
        confidence: 'DIRECT',
      });
    }

    // Action node parameters check: empty parameters generate a WARNING
    if (node.type === 'action') {
      const params = node.data?.parameters;
      const paramKeys = params && typeof params === 'object' ? Object.keys(params) : [];
      if (paramKeys.length === 0) {
        completenessWarningCount++;
        issues.push({
          id: `issue-empty-action-parameters-${node.id}`,
          severity: 'WARNING',
          type: 'EMPTY_ACTION_PARAMETERS',
          message: `Action node "${node.data?.label || node.id}" has no evaluation parameters configured.`,
          nodeIds: [node.id],
          edgeIds: [],
          field: 'parameters',
          evidence: { nodeId: node.id, parameterCount: 0 },
          suggestedFix: 'Configure runtime parameters or payload attributes for this Action.',
          confidence: 'DIRECT',
        });
      }
    }
  }

  // 12. Deterministic issue sorting & grouping
  issues.sort((a, b) => {
    const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sevDiff !== 0) return sevDiff;
    const typeDiff = a.type.localeCompare(b.type);
    if (typeDiff !== 0) return typeDiff;
    const nodeA = a.nodeIds[0] || '';
    const nodeB = b.nodeIds[0] || '';
    const nodeDiff = nodeA.localeCompare(nodeB);
    if (nodeDiff !== 0) return nodeDiff;
    return (a.edgeIds[0] || '').localeCompare(b.edgeIds[0] || '');
  });

  const errors = issues.filter((i) => i.severity === 'CRITICAL' || i.severity === 'ERROR');
  const warnings = issues.filter((i) => i.severity === 'WARNING');
  const valid = errors.length === 0;

  // Aggregate affected node IDs deterministically
  const affectedNodeSet = new Set<string>();
  for (const issue of issues) {
    for (const nId of issue.nodeIds) {
      if (allNodeIds.has(nId)) {
        affectedNodeSet.add(nId);
      }
    }
  }
  const affectedNodeIds = Array.from(affectedNodeSet).sort();

  // Metrics summary
  const orphanCount = nonRootNodes.filter(
    (n) => n?.id && (incomingEdgesMap.get(n.id) || []).length === 0
  ).length;

  const metrics: GraphQualityMetrics = {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    rootCount,
    orphanCount,
    cycleCount,
    connectedComponentCount,
    reachableNodeCount,
    unreachableNodeCount: nodes.length - reachableNodeCount,
    completenessWarningCount,
  };

  const criticalCount = issues.filter((i) => i.severity === 'CRITICAL').length;
  const nonCriticalErrorCount = issues.filter((i) => i.severity === 'ERROR').length;
  const score = calculateIntegrityScore(
    nodes.length,
    criticalCount,
    nonCriticalErrorCount,
    warnings.length,
    valid
  );

  return {
    valid,
    errors,
    warnings,
    issues,
    affectedNodeIds,
    metrics,
    coverage,
    score,
  };
}
