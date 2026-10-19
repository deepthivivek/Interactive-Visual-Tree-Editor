/**
 * Pure Minimal Advisory Correction Planner (Day 13).
 *
 * Generates explainable, non-destructive advisory correction recommendations
 * based on validation issues.
 *
 * Principles:
 * - ADVISORY ONLY: Never mutates the graph automatically.
 * - Respects User Intent: Requires explicit user choice when multiple fixes are possible.
 * - Explainable: Details target entities, action types, and expected structural impacts.
 */

import type { TreeNode, TreeEdge } from '../types/tree';
import type { ValidationResult, ValidationIssue } from './validation';
import type { ProposedGraphChange } from './impactAnalysis';

export type CorrectionActionType =
  | 'remove-dangling-edge'
  | 'break-cycle-edge'
  | 'resolve-multiple-parents'
  | 'remove-invalid-relationship'
  | 'remove-action-children'
  | 'set-required-field'
  | 'add-root-node'
  | 'connect-orphan-to-root';

export interface AdvisoryCorrectionAction {
  id: string;
  title: string;
  description: string;
  actionType: CorrectionActionType;
  targetNodeIds: string[];
  targetEdgeIds: string[];
  requiresUserChoice: boolean;
  userChoiceOptions?: Array<{
    id: string;
    label: string;
    proposedChange?: ProposedGraphChange;
  }>;
  expectedImpact: string;
  proposedChange?: ProposedGraphChange;
}

export interface CorrectionPlan {
  graphValid: boolean;
  totalDefects: number;
  advisoryActions: AdvisoryCorrectionAction[];
  hasAmbiguousDecisions: boolean;
  summary: string;
}

/**
 * Builds an advisory correction plan from a validation result.
 * Deterministic and pure: zero mutations.
 */
export function buildCorrectionPlan(
  _nodes: readonly TreeNode[],
  _edges: readonly TreeEdge[],
  validationResult: ValidationResult
): CorrectionPlan {
  if (validationResult.valid && validationResult.issues.length === 0) {
    return {
      graphValid: true,
      totalDefects: 0,
      advisoryActions: [],
      hasAmbiguousDecisions: false,
      summary: 'The graph is structurally valid and complete. No correction plan required.',
    };
  }

  const advisoryActions: AdvisoryCorrectionAction[] = [];
  const processedIssueIds = new Set<string>();

  for (const issue of validationResult.issues) {
    if (processedIssueIds.has(issue.id)) continue;
    processedIssueIds.add(issue.id);

    switch (issue.type) {
      case 'DANGLING_EDGE_SOURCE':
      case 'DANGLING_EDGE_TARGET': {
        const edgeId = issue.edgeIds[0];
        if (edgeId) {
          advisoryActions.push({
            id: `plan-remove-dangling-${edgeId}`,
            title: `Remove Dangling Edge "${edgeId}"`,
            description: `The edge connects to a non-existent endpoint. Removing it restores edge endpoint integrity.`,
            actionType: 'remove-dangling-edge',
            targetNodeIds: issue.nodeIds,
            targetEdgeIds: [edgeId],
            requiresUserChoice: false,
            expectedImpact: 'Eliminates dangling reference and resolves related reachability ambiguity.',
            proposedChange: { type: 'remove-edge', edgeId },
          });
        }
        break;
      }

      case 'SELF_LOOP_EDGE': {
        const edgeId = issue.edgeIds[0];
        if (edgeId) {
          advisoryActions.push({
            id: `plan-remove-self-loop-${edgeId}`,
            title: `Remove Self-Loop Edge "${edgeId}"`,
            description: `A node cannot connect to itself. Removing this edge breaks the circular reference.`,
            actionType: 'break-cycle-edge',
            targetNodeIds: issue.nodeIds,
            targetEdgeIds: [edgeId],
            requiresUserChoice: false,
            expectedImpact: 'Resolves critical self-loop cycle immediately.',
            proposedChange: { type: 'remove-edge', edgeId },
          });
        }
        break;
      }

      case 'CYCLE_DETECTED': {
        const cycleEdges = issue.edgeIds;
        advisoryActions.push({
          id: `plan-break-cycle-${issue.id}`,
          title: 'Break Directed Cycle',
          description: `A circular dependency exists along path [${(issue.evidence.path as string[] || []).join(' -> ')}]. Breaking any single edge in this path restores acyclic hierarchy.`,
          actionType: 'break-cycle-edge',
          targetNodeIds: issue.nodeIds,
          targetEdgeIds: cycleEdges,
          requiresUserChoice: cycleEdges.length > 1,
          userChoiceOptions: cycleEdges.map((eId) => ({
            id: eId,
            label: `Remove connection "${eId}"`,
            proposedChange: { type: 'remove-edge', edgeId: eId },
          })),
          expectedImpact: 'Eliminates directed cycle without data loss in node payloads.',
          proposedChange: cycleEdges[0] ? { type: 'remove-edge', edgeId: cycleEdges[0] } : undefined,
        });
        break;
      }

      case 'MULTIPLE_PARENTS': {
        const targetNodeId = issue.nodeIds[0];
        const edgeIds = issue.edgeIds;
        advisoryActions.push({
          id: `plan-multiple-parents-${targetNodeId}`,
          title: `Resolve Multiple Parents on "${targetNodeId}"`,
          description: `Node has ${edgeIds.length} incoming parent connections. Select which parent connection to retain according to business requirements.`,
          actionType: 'resolve-multiple-parents',
          targetNodeIds: issue.nodeIds,
          targetEdgeIds: edgeIds,
          requiresUserChoice: true,
          userChoiceOptions: edgeIds.map((eId) => ({
            id: eId,
            label: `Retain edge "${eId}" and remove others`,
            proposedChange: { type: 'remove-edge', edgeId: eId },
          })),
          expectedImpact: 'Restores strict tree single-parent invariant for this node.',
        });
        break;
      }

      case 'INVALID_PARENT_CHILD_RELATIONSHIP': {
        const edgeId = issue.edgeIds[0];
        if (edgeId) {
          advisoryActions.push({
            id: `plan-invalid-rel-${edgeId}`,
            title: `Disconnect Disallowed Connection "${edgeId}"`,
            description: `This connection violates compliance hierarchy rules. Removing the edge allows reparenting to a valid parent type.`,
            actionType: 'remove-invalid-relationship',
            targetNodeIds: issue.nodeIds,
            targetEdgeIds: [edgeId],
            requiresUserChoice: false,
            expectedImpact: 'Enforces schema relationship rules; target node will require a valid parent.',
            proposedChange: { type: 'remove-edge', edgeId },
          });
        }
        break;
      }

      case 'ACTION_HAS_CHILDREN': {
        const edgeId = issue.edgeIds[0];
        if (edgeId) {
          advisoryActions.push({
            id: `plan-action-children-${edgeId}`,
            title: `Remove Action Child Edge "${edgeId}"`,
            description: `Action nodes are terminal execution leaves and cannot have downstream children.`,
            actionType: 'remove-action-children',
            targetNodeIds: issue.nodeIds,
            targetEdgeIds: [edgeId],
            requiresUserChoice: false,
            expectedImpact: 'Preserves leaf constraint on action nodes.',
            proposedChange: { type: 'remove-edge', edgeId },
          });
        }
        break;
      }

      case 'MISSING_ROOT': {
        advisoryActions.push({
          id: 'plan-add-root',
          title: 'Add Hierarchy Root Node',
          description: 'Create a Root node to act as the primary policy anchor for this compliance hierarchy.',
          actionType: 'add-root-node',
          targetNodeIds: [],
          targetEdgeIds: [],
          requiresUserChoice: false,
          expectedImpact: 'Establishes the tree root anchor for all rules.',
          proposedChange: { type: 'add-node', newNodeType: 'root' },
        });
        break;
      }

      case 'MISSING_REQUIRED_FIELD': {
        const nId = issue.nodeIds[0];
        advisoryActions.push({
          id: `plan-set-field-${nId}-${issue.field || 'label'}`,
          title: `Provide Missing ${issue.field || 'Field'} for Node "${nId}"`,
          description: `Node requires a valid non-empty ${issue.field || 'label'}.`,
          actionType: 'set-required-field',
          targetNodeIds: issue.nodeIds,
          targetEdgeIds: [],
          requiresUserChoice: true,
          expectedImpact: 'Fulfills schema completeness without altering graph connectivity.',
        });
        break;
      }

      default:
        // Other non-structural or warning issues remain advisory in the issues list
        break;
    }
  }

  // Sort advisory actions deterministically by targetNodeIds then targetEdgeIds
  advisoryActions.sort((a, b) => {
    const nodeA = a.targetNodeIds[0] || '';
    const nodeB = b.targetNodeIds[0] || '';
    const nodeCmp = nodeA.localeCompare(nodeB);
    if (nodeCmp !== 0) return nodeCmp;
    return (a.targetEdgeIds[0] || '').localeCompare(b.targetEdgeIds[0] || '');
  });

  const hasAmbiguousDecisions = advisoryActions.some((a) => a.requiresUserChoice);

  return {
    graphValid: false,
    totalDefects: validationResult.errors.length,
    advisoryActions,
    hasAmbiguousDecisions,
    summary: `Generated ${advisoryActions.length} advisory correction plan step(s). ${
      hasAmbiguousDecisions
        ? 'Some actions require user intent selection between alternative resolutions.'
        : 'All proposed steps have unambiguous resolutions.'
    }`,
  };
}

export interface RankedCorrectionAction extends AdvisoryCorrectionAction {
  rank: number;
  isRecommended: boolean;
  rankingScore: number;
  rankingReason: string;
}

/**
 * Deterministically ranks multiple advisory correction actions (Day 13).
 *
 * Scoring Heuristic:
 * 1. Severity resolved: Cycle/Critical break (+50) > Error fix (+30) > Warning (+10)
 * 2. Simplicity / Low disruption: Unambiguous fix (+15) vs Requires user intent (-10)
 * 3. Scope of mutation: Fewer target entities is preferred (-2 per entity beyond 1)
 *
 * Clearly labeled as "heuristically ranked" / "recommended", avoiding unproven claims of mathematical optimality.
 */
export function rankAdvisoryActions(
  actions: readonly AdvisoryCorrectionAction[],
  _nodes: readonly TreeNode[],
  _edges: readonly TreeEdge[]
): RankedCorrectionAction[] {
  if (actions.length === 0) return [];

  const scored = actions.map((action) => {
    let score = 0;
    const reasons: string[] = [];

    // 1. Defect severity resolved
    if (action.actionType === 'break-cycle-edge') {
      score += 50;
      reasons.push('Resolves critical cycle defect');
    } else if (
      action.actionType === 'remove-dangling-edge' ||
      action.actionType === 'remove-invalid-relationship' ||
      action.actionType === 'resolve-multiple-parents'
    ) {
      score += 30;
      reasons.push('Resolves structural hierarchy violation');
    } else if (action.actionType === 'add-root-node') {
      score += 40;
      reasons.push('Restores missing hierarchy root anchor');
    } else {
      score += 15;
      reasons.push('Resolves configuration field requirement');
    }

    // 2. Decision certainty
    if (!action.requiresUserChoice) {
      score += 15;
      reasons.push('Unambiguous direct resolution');
    } else {
      score -= 5;
      reasons.push('Requires explicit user choice between alternative fixes');
    }

    // 3. Edit complexity
    const totalEntities = action.targetNodeIds.length + action.targetEdgeIds.length;
    score -= Math.max(0, totalEntities - 1) * 2;

    const rankingReason = `Heuristically recommended: ${reasons.join(', ')}.`;

    return {
      ...action,
      rankingScore: score,
      rankingReason,
    };
  });

  // Sort descending by score; break ties deterministically by title
  scored.sort((a, b) => {
    if (b.rankingScore !== a.rankingScore) {
      return b.rankingScore - a.rankingScore;
    }
    return a.title.localeCompare(b.title);
  });

  return scored.map((item, idx) => ({
    ...item,
    rank: idx + 1,
    isRecommended: idx === 0,
  }));
}

