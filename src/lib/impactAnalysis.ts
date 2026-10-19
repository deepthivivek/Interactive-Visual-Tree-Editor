/**
 * Pure Advanced Impact Analysis Helper (Day 13).
 *
 * Predicts the blast radius and potential structural consequences
 * of proposed graph changes before applying them.
 *
 * Pure and non-mutating: does not alter real graph data or state.
 */

import type { TreeNode, TreeEdge, NodeType } from '../types/tree';
import {
  isValidParentChildRelationship,
  canAcceptChild,
  canHaveParent,
} from './relationshipRules';
import { wouldCreateCycle } from './cycleDetection';
import { getSubtreeNodeIds } from './subtree';
import type { ValidationCoverageCategory } from './validation';

export type ProposedChangeType =
  | 'add-edge'
  | 'remove-edge'
  | 'reparent-node'
  | 'delete-node'
  | 'add-node';

export interface ProposedGraphChange {
  type: ProposedChangeType;
  sourceNodeId?: string;
  targetNodeId?: string;
  edgeId?: string;
  nodeId?: string;
  newNodeType?: NodeType;
  isCascadeDelete?: boolean;
}

export interface GraphImpactAnalysis {
  supported: boolean;
  unsupportedReason?: string;
  directlyAffectedNodeIds: string[];
  directlyAffectedEdgeIds: string[];
  downstreamDescendantNodeIds: string[];
  categoriesToReevaluate: ValidationCoverageCategory[];
  definiteViolations: string[];
  potentialViolations: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  summary: string;
}

/**
 * Evaluates the impact of a proposed graph change on structural integrity.
 */
export function analyzeGraphImpact(
  nodes: readonly TreeNode[],
  edges: readonly TreeEdge[],
  change: ProposedGraphChange
): GraphImpactAnalysis {
  const nodeMap = new Map<string, TreeNode>();
  for (const n of nodes) {
    if (n?.id) nodeMap.set(n.id, n);
  }

  const incomingCount = new Map<string, number>();
  for (const e of edges) {
    incomingCount.set(e.target, (incomingCount.get(e.target) || 0) + 1);
  }

  switch (change.type) {
    case 'add-edge': {
      const sId = change.sourceNodeId;
      const tId = change.targetNodeId;

      if (!sId || !tId) {
        return {
          supported: false,
          unsupportedReason: 'Both sourceNodeId and targetNodeId are required to analyze add-edge.',
          directlyAffectedNodeIds: [],
          directlyAffectedEdgeIds: [],
          downstreamDescendantNodeIds: [],
          categoriesToReevaluate: [],
          definiteViolations: [],
          potentialViolations: [],
          riskLevel: 'LOW',
          summary: 'Unsupported: Missing connection endpoints.',
        };
      }

      const sourceNode = nodeMap.get(sId);
      const targetNode = nodeMap.get(tId);

      const directlyAffectedNodeIds = [sId, tId].sort();
      const downstreamSet = getSubtreeNodeIds(tId, edges);
      // Remove target itself from downstream set
      downstreamSet.delete(tId);
      const downstreamDescendantNodeIds = Array.from(downstreamSet).sort();

      const definiteViolations: string[] = [];
      const potentialViolations: string[] = [];

      if (!sourceNode) {
        definiteViolations.push(`Source node "${sId}" does not exist in the graph.`);
      }
      if (!targetNode) {
        definiteViolations.push(`Target node "${tId}" does not exist in the graph.`);
      }

      if (sourceNode && targetNode) {
        // Self-loop check
        if (sId === tId) {
          definiteViolations.push(`Self-connection: node "${sId}" cannot connect to itself.`);
        }

        // Cycle check
        if (wouldCreateCycle(sId, tId, edges)) {
          definiteViolations.push(`Circular dependency: connecting "${sId}" to "${tId}" creates a directed cycle.`);
        }

        // Root cannot have parent
        if (targetNode.type === 'root') {
          definiteViolations.push(`Root node "${tId}" cannot accept an incoming parent edge.`);
        }

        // Action cannot have children
        if (sourceNode.type === 'action') {
          definiteViolations.push(`Action node "${sId}" cannot have child connections.`);
        }

        // Relationship grammar check
        if (!isValidParentChildRelationship(sourceNode.type, targetNode.type)) {
          definiteViolations.push(
            `Policy grammar violation: "${sourceNode.type}" cannot be parent of "${targetNode.type}".`
          );
        }

        // Single-parent violation check
        const currentIn = incomingCount.get(tId) || 0;
        if (currentIn >= 1) {
          definiteViolations.push(
            `Multiple parents: Node "${tId}" already has ${currentIn} parent edge(s). Adding another violates the single-parent invariant.`
          );
        }
      }

      const riskLevel =
        definiteViolations.length > 0
          ? 'HIGH'
          : downstreamDescendantNodeIds.length > 3
          ? 'MEDIUM'
          : 'LOW';

      return {
        supported: true,
        directlyAffectedNodeIds,
        directlyAffectedEdgeIds: [],
        downstreamDescendantNodeIds,
        categoriesToReevaluate: ['structure', 'cycles', 'relationshipRules', 'rootAndParent'],
        definiteViolations,
        potentialViolations,
        riskLevel,
        summary:
          definiteViolations.length > 0
            ? `High Risk: Proposed connection introduces ${definiteViolations.length} structural violation(s).`
            : `Safe connection from "${sId}" to "${tId}". Affects ${downstreamDescendantNodeIds.length} descendant node(s).`,
      };
    }

    case 'remove-edge': {
      const edge = edges.find((e) => e.id === change.edgeId);
      if (!edge) {
        return {
          supported: false,
          unsupportedReason: `Edge "${change.edgeId}" not found in graph.`,
          directlyAffectedNodeIds: [],
          directlyAffectedEdgeIds: [],
          downstreamDescendantNodeIds: [],
          categoriesToReevaluate: [],
          definiteViolations: [],
          potentialViolations: [],
          riskLevel: 'LOW',
          summary: 'Unsupported: Edge does not exist.',
        };
      }

      const directlyAffectedNodeIds = [edge.source, edge.target].sort();
      const directlyAffectedEdgeIds = [edge.id];
      const downstreamSet = getSubtreeNodeIds(edge.target, edges);
      const downstreamDescendantNodeIds = Array.from(downstreamSet).sort();

      const currentIn = incomingCount.get(edge.target) || 0;
      const potentialViolations: string[] = [];
      if (currentIn <= 1) {
        potentialViolations.push(
          `Node "${edge.target}" will become an orphan with no incoming parent edge.`
        );
        if (downstreamDescendantNodeIds.length > 1) {
          potentialViolations.push(
            `A disconnected subtree containing ${downstreamDescendantNodeIds.length} nodes will be isolated from Root.`
          );
        }
      }

      const riskLevel = downstreamDescendantNodeIds.length > 2 ? 'HIGH' : 'MEDIUM';

      return {
        supported: true,
        directlyAffectedNodeIds,
        directlyAffectedEdgeIds,
        downstreamDescendantNodeIds,
        categoriesToReevaluate: ['structure', 'rootAndParent'],
        definiteViolations: [],
        potentialViolations,
        riskLevel,
        summary: `Removing edge "${edge.id}" isolates node "${edge.target}" and its subtree (${downstreamDescendantNodeIds.length} nodes).`,
      };
    }

    case 'delete-node': {
      const nodeId = change.nodeId;
      const node = nodeId ? nodeMap.get(nodeId) : undefined;
      if (!node || !nodeId) {
        return {
          supported: false,
          unsupportedReason: `Node "${nodeId}" does not exist in graph.`,
          directlyAffectedNodeIds: [],
          directlyAffectedEdgeIds: [],
          downstreamDescendantNodeIds: [],
          categoriesToReevaluate: [],
          definiteViolations: [],
          potentialViolations: [],
          riskLevel: 'LOW',
          summary: 'Unsupported: Node does not exist.',
        };
      }

      const incidentEdges = edges.filter((e) => e.source === nodeId || e.target === nodeId);
      const directlyAffectedEdgeIds = incidentEdges.map((e) => e.id).sort();

      const subtreeIds = getSubtreeNodeIds(nodeId, edges);
      subtreeIds.delete(nodeId);
      const downstreamDescendantNodeIds = Array.from(subtreeIds).sort();

      const definiteViolations: string[] = [];
      const potentialViolations: string[] = [];

      if (node.type === 'root') {
        definiteViolations.push('Deleting the Root node leaves the tree without a primary hierarchy root.');
      }

      if (!change.isCascadeDelete && downstreamDescendantNodeIds.length > 0) {
        potentialViolations.push(
          `Deleting node "${nodeId}" without cascade leaves ${downstreamDescendantNodeIds.length} child/descendant nodes as orphans.`
        );
      }

      const riskLevel = node.type === 'root' || downstreamDescendantNodeIds.length > 3 ? 'HIGH' : 'MEDIUM';

      return {
        supported: true,
        directlyAffectedNodeIds: [nodeId],
        directlyAffectedEdgeIds,
        downstreamDescendantNodeIds,
        categoriesToReevaluate: ['structure', 'rootAndParent'],
        definiteViolations,
        potentialViolations,
        riskLevel,
        summary: change.isCascadeDelete
          ? `Cascade deletion will remove node "${nodeId}" and all ${downstreamDescendantNodeIds.length} descendants.`
          : `Single deletion will remove node "${nodeId}", leaving ${downstreamDescendantNodeIds.length} descendants disconnected.`,
      };
    }

    default:
      return {
        supported: false,
        unsupportedReason: `Proposed change type "${change.type}" is not currently modeled.`,
        directlyAffectedNodeIds: [],
        directlyAffectedEdgeIds: [],
        downstreamDescendantNodeIds: [],
        categoriesToReevaluate: [],
        definiteViolations: [],
        potentialViolations: [],
        riskLevel: 'LOW',
        summary: `Unsupported change type: ${change.type}`,
      };
  }
}
