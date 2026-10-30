import type { TreeNode, TreeEdge } from '../types/tree';

export interface NodePropertyDiff {
  property: string;
  previousValue: unknown;
  currentValue: unknown;
}

export interface NodeDiff {
  nodeId: string;
  type: TreeNode['type'];
  label: string;
  changeType: 'added' | 'removed' | 'modified' | 'unchanged';
  propertyDiffs: NodePropertyDiff[];
}

export interface EdgeDiff {
  edgeId: string;
  source: string;
  target: string;
  changeType: 'added' | 'removed' | 'unchanged';
}

export interface PolicyGraphComparison {
  isIdentical: boolean;
  addedNodeCount: number;
  removedNodeCount: number;
  modifiedNodeCount: number;
  addedEdgeCount: number;
  removedEdgeCount: number;
  nodeDiffs: NodeDiff[];
  edgeDiffs: EdgeDiff[];
  summary: string;
  timestamp: number;
}

/**
 * Pure engine that compares two policy graph structures (source vs target / baseline vs candidate)
 * and produces a detailed, deterministic diff.
 */
export function comparePolicyGraphs(
  sourceNodes: TreeNode[],
  sourceEdges: TreeEdge[],
  targetNodes: TreeNode[],
  targetEdges: TreeEdge[]
): PolicyGraphComparison {
  const sourceNodeMap = new Map<string, TreeNode>();
  for (const n of sourceNodes) {
    sourceNodeMap.set(n.id, n);
  }

  const targetNodeMap = new Map<string, TreeNode>();
  for (const n of targetNodes) {
    targetNodeMap.set(n.id, n);
  }

  const sourceEdgeMap = new Map<string, TreeEdge>();
  for (const e of sourceEdges) {
    sourceEdgeMap.set(e.id, e);
  }

  const targetEdgeMap = new Map<string, TreeEdge>();
  for (const e of targetEdges) {
    targetEdgeMap.set(e.id, e);
  }

  const nodeDiffs: NodeDiff[] = [];
  let addedNodeCount = 0;
  let removedNodeCount = 0;
  let modifiedNodeCount = 0;

  // Process target nodes against source
  for (const [id, targetNode] of targetNodeMap.entries()) {
    const sourceNode = sourceNodeMap.get(id);

    if (!sourceNode) {
      addedNodeCount++;
      nodeDiffs.push({
        nodeId: id,
        type: targetNode.type,
        label: targetNode.data.label || id,
        changeType: 'added',
        propertyDiffs: [],
      });
    } else {
      const propertyDiffs: NodePropertyDiff[] = [];

      if (sourceNode.data.label !== targetNode.data.label) {
        propertyDiffs.push({
          property: 'label',
          previousValue: sourceNode.data.label,
          currentValue: targetNode.data.label,
        });
      }

      if (sourceNode.data.ruleId !== targetNode.data.ruleId) {
        propertyDiffs.push({
          property: 'ruleId',
          previousValue: sourceNode.data.ruleId,
          currentValue: targetNode.data.ruleId,
        });
      }

      if (sourceNode.data.description !== targetNode.data.description) {
        propertyDiffs.push({
          property: 'description',
          previousValue: sourceNode.data.description,
          currentValue: targetNode.data.description,
        });
      }

      if (sourceNode.data.severity !== targetNode.data.severity) {
        propertyDiffs.push({
          property: 'severity',
          previousValue: sourceNode.data.severity,
          currentValue: targetNode.data.severity,
        });
      }

      if (sourceNode.data.status !== targetNode.data.status) {
        propertyDiffs.push({
          property: 'status',
          previousValue: sourceNode.data.status,
          currentValue: targetNode.data.status,
        });
      }

      // Deep parameter check
      const srcParams = sourceNode.data.parameters || {};
      const tgtParams = targetNode.data.parameters || {};
      const allParamKeys = new Set([...Object.keys(srcParams), ...Object.keys(tgtParams)]);

      for (const key of allParamKeys) {
        if (JSON.stringify(srcParams[key]) !== JSON.stringify(tgtParams[key])) {
          propertyDiffs.push({
            property: `parameter.${key}`,
            previousValue: srcParams[key],
            currentValue: tgtParams[key],
          });
        }
      }

      if (propertyDiffs.length > 0) {
        modifiedNodeCount++;
        nodeDiffs.push({
          nodeId: id,
          type: targetNode.type,
          label: targetNode.data.label || id,
          changeType: 'modified',
          propertyDiffs,
        });
      } else {
        nodeDiffs.push({
          nodeId: id,
          type: targetNode.type,
          label: targetNode.data.label || id,
          changeType: 'unchanged',
          propertyDiffs: [],
        });
      }
    }
  }

  // Detect removed nodes
  for (const [id, sourceNode] of sourceNodeMap.entries()) {
    if (!targetNodeMap.has(id)) {
      removedNodeCount++;
      nodeDiffs.push({
        nodeId: id,
        type: sourceNode.type,
        label: sourceNode.data.label || id,
        changeType: 'removed',
        propertyDiffs: [],
      });
    }
  }

  // Edge diffs
  const edgeDiffs: EdgeDiff[] = [];
  let addedEdgeCount = 0;
  let removedEdgeCount = 0;

  for (const [id, targetEdge] of targetEdgeMap.entries()) {
    if (!sourceEdgeMap.has(id)) {
      addedEdgeCount++;
      edgeDiffs.push({
        edgeId: id,
        source: targetEdge.source,
        target: targetEdge.target,
        changeType: 'added',
      });
    } else {
      edgeDiffs.push({
        edgeId: id,
        source: targetEdge.source,
        target: targetEdge.target,
        changeType: 'unchanged',
      });
    }
  }

  for (const [id, sourceEdge] of sourceEdgeMap.entries()) {
    if (!targetEdgeMap.has(id)) {
      removedEdgeCount++;
      edgeDiffs.push({
        edgeId: id,
        source: sourceEdge.source,
        target: sourceEdge.target,
        changeType: 'removed',
      });
    }
  }

  const isIdentical =
    addedNodeCount === 0 &&
    removedNodeCount === 0 &&
    modifiedNodeCount === 0 &&
    addedEdgeCount === 0 &&
    removedEdgeCount === 0;

  const summaryParts: string[] = [];
  if (isIdentical) {
    summaryParts.push('Policy graphs are identical.');
  } else {
    if (addedNodeCount > 0) summaryParts.push(`+${addedNodeCount} nodes`);
    if (removedNodeCount > 0) summaryParts.push(`-${removedNodeCount} nodes`);
    if (modifiedNodeCount > 0) summaryParts.push(`~${modifiedNodeCount} modified nodes`);
    if (addedEdgeCount > 0) summaryParts.push(`+${addedEdgeCount} edges`);
    if (removedEdgeCount > 0) summaryParts.push(`-${removedEdgeCount} edges`);
  }

  return {
    isIdentical,
    addedNodeCount,
    removedNodeCount,
    modifiedNodeCount,
    addedEdgeCount,
    removedEdgeCount,
    nodeDiffs,
    edgeDiffs,
    summary: summaryParts.join(' • '),
    timestamp: Date.now(),
  };
}
