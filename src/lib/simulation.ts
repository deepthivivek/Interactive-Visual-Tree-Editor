/**
 * Pure Safe What-If Simulation Helper (Day 13).
 *
 * Simulates proposed corrections or graph modifications on an isolated graph copy,
 * computing before/after validation comparisons to forecast real structural effects.
 *
 * Principles:
 * - Completely Isolated: Never mutates the original graph.
 * - Non-destructive: Operates purely on deep-cloned copies.
 * - Rigorous: Uses the full pure validation engine on both before and after graphs.
 */

import type { TreeNode, TreeEdge } from '../types/tree';
import { validateGraph, type ValidationResult } from './validation';
import {
  compareValidationResults,
  type ValidationComparison,
} from './validationComparison';
import type { ProposedGraphChange } from './impactAnalysis';
import { deleteSingleNodePure, deleteSubtreePure } from './subtree';

export interface SimulationResult {
  completed: boolean;
  unsupportedReason?: string;
  proposedChange: ProposedGraphChange;
  affectedNodeIds: string[];
  affectedEdgeIds: string[];
  validationBefore: ValidationResult;
  validationAfter?: ValidationResult;
  comparison?: ValidationComparison;
  consequences: string[];
  successfulRepair: boolean;
}

/**
 * Deep clones nodes and edges immutably to prevent reference leakage.
 */
function deepCloneGraph(
  nodes: readonly TreeNode[],
  edges: readonly TreeEdge[]
): { clonedNodes: TreeNode[]; clonedEdges: TreeEdge[] } {
  return {
    clonedNodes: JSON.parse(JSON.stringify(nodes)) as TreeNode[],
    clonedEdges: JSON.parse(JSON.stringify(edges)) as TreeEdge[],
  };
}

/**
 * Simulates a proposed graph modification on an isolated clone,
 * returning validation before/after metrics and regression analysis.
 */
export function simulateGraphChange(
  nodes: readonly TreeNode[],
  edges: readonly TreeEdge[],
  proposedChange: ProposedGraphChange
): SimulationResult {
  const validationBefore = validateGraph(nodes, edges);

  // 1. Deep clone graph
  const { clonedNodes, clonedEdges } = deepCloneGraph(nodes, edges);
  let nextNodes = clonedNodes;
  let nextEdges = clonedEdges;

  const affectedNodeIds: string[] = [];
  const affectedEdgeIds: string[] = [];
  const consequences: string[] = [];

  // 2. Apply simulated mutation to cloned graph
  switch (proposedChange.type) {
    case 'remove-edge': {
      const edgeId = proposedChange.edgeId;
      if (!edgeId) {
        return {
          completed: false,
          unsupportedReason: 'Edge ID is required for simulated remove-edge.',
          proposedChange,
          affectedNodeIds: [],
          affectedEdgeIds: [],
          validationBefore,
          consequences: ['Simulation aborted: missing edge identifier.'],
          successfulRepair: false,
        };
      }

      const targetEdge = nextEdges.find((e) => e.id === edgeId);
      if (!targetEdge) {
        return {
          completed: false,
          unsupportedReason: `Edge "${edgeId}" does not exist in graph.`,
          proposedChange,
          affectedNodeIds: [],
          affectedEdgeIds: [],
          validationBefore,
          consequences: [`Simulation aborted: edge "${edgeId}" not found.`],
          successfulRepair: false,
        };
      }

      affectedEdgeIds.push(edgeId);
      affectedNodeIds.push(targetEdge.source, targetEdge.target);
      nextEdges = nextEdges.filter((e) => e.id !== edgeId);
      consequences.push(`Simulated removal of edge "${edgeId}" connecting "${targetEdge.source}" to "${targetEdge.target}".`);
      break;
    }

    case 'delete-node': {
      const nodeId = proposedChange.nodeId;
      if (!nodeId) {
        return {
          completed: false,
          unsupportedReason: 'Node ID is required for simulated delete-node.',
          proposedChange,
          affectedNodeIds: [],
          affectedEdgeIds: [],
          validationBefore,
          consequences: ['Simulation aborted: missing node identifier.'],
          successfulRepair: false,
        };
      }

      const targetNode = nextNodes.find((n) => n.id === nodeId);
      if (!targetNode) {
        return {
          completed: false,
          unsupportedReason: `Node "${nodeId}" does not exist in graph.`,
          proposedChange,
          affectedNodeIds: [],
          affectedEdgeIds: [],
          validationBefore,
          consequences: [`Simulation aborted: node "${nodeId}" not found.`],
          successfulRepair: false,
        };
      }

      affectedNodeIds.push(nodeId);
      if (proposedChange.isCascadeDelete) {
        const delRes = deleteSubtreePure(nodeId, nextNodes, nextEdges);
        nextNodes = [...delRes.nodes];
        nextEdges = [...delRes.edges];
        consequences.push(`Simulated cascade deletion of node "${nodeId}" and all its descendants.`);
      } else {
        const delRes = deleteSingleNodePure(nodeId, nextNodes, nextEdges);
        nextNodes = [...delRes.nodes];
        nextEdges = [...delRes.edges];
        consequences.push(`Simulated single deletion of node "${nodeId}".`);
      }
      break;
    }

    case 'add-edge': {
      const sId = proposedChange.sourceNodeId;
      const tId = proposedChange.targetNodeId;
      if (!sId || !tId) {
        return {
          completed: false,
          unsupportedReason: 'Both sourceNodeId and targetNodeId are required for simulated add-edge.',
          proposedChange,
          affectedNodeIds: [],
          affectedEdgeIds: [],
          validationBefore,
          consequences: ['Simulation aborted: missing source or target.'],
          successfulRepair: false,
        };
      }

      const simEdgeId = `sim_edge_${sId}_${tId}`;
      affectedNodeIds.push(sId, tId);
      affectedEdgeIds.push(simEdgeId);
      nextEdges = [
        ...nextEdges,
        {
          id: simEdgeId,
          source: sId,
          target: tId,
        },
      ];
      consequences.push(`Simulated edge addition connecting "${sId}" to "${tId}".`);
      break;
    }

    case 'add-node': {
      const type = proposedChange.newNodeType || 'rule';
      const simNodeId = `sim_node_${type}_${Date.now()}`;
      affectedNodeIds.push(simNodeId);
      nextNodes = [
        ...nextNodes,
        {
          id: simNodeId,
          type,
          position: { x: 0, y: 0 },
          data: { label: `Simulated ${type}` },
        },
      ];
      consequences.push(`Simulated creation of ${type} node "${simNodeId}".`);
      break;
    }

    default:
      return {
        completed: false,
        unsupportedReason: `Proposed change type "${(proposedChange as { type: string }).type}" is not supported for simulation.`,
        proposedChange,
        affectedNodeIds: [],
        affectedEdgeIds: [],
        validationBefore,
        consequences: ['Simulation aborted: unsupported operation.'],
        successfulRepair: false,
      };
  }

  // 3. Run validation on the modified clone
  const validationAfter = validateGraph(nextNodes, nextEdges);

  // 4. Compare validation before and after
  const comparison = compareValidationResults(validationBefore, validationAfter);

  // 5. Evaluate if the change repaired issues without regressions
  const successfulRepair =
    comparison.resolvedIssues.length > 0 &&
    comparison.newCriticalCount === 0 &&
    comparison.newErrorCount === 0;

  return {
    completed: true,
    proposedChange,
    affectedNodeIds: affectedNodeIds.sort(),
    affectedEdgeIds: affectedEdgeIds.sort(),
    validationBefore,
    validationAfter,
    comparison,
    consequences,
    successfulRepair,
  };
}
