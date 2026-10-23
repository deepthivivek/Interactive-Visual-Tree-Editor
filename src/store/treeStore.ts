import { create } from 'zustand';
import type { StateCreator, UseBoundStore, StoreApi } from 'zustand';
import { temporal } from 'zundo';
import type { TemporalState } from 'zundo';
import type { TreeNode, TreeEdge, TreeStoreState, NodeType } from '../types/tree';
import { createDefaultNode, isPolicyNodeType } from '../lib/nodeFactory';
import { validateConnection } from '../lib/connectionValidation';
import {
  executeAddChild,
  executeDuplicateNode,
  executeDeleteNode,
  executeDeleteSubtree,
  executeReparentNode,
  getNodeIncidentEdges,
  hasNodesMoved,
  areGraphStatesEqual,
} from '../lib/graphOperations';
import {
  updateNodeDataPure,
  setParameterPure,
  deleteParameterPure,
  addTagPure,
  removeTagPure,
  setMetadataPure,
  deleteMetadataPure,
} from '../lib/nodePropertyOperations';
import { calculateAutoLayout, type LayoutOptions } from '../lib/autoLayout';
import {
  getSubtreeNodeIds,
  getDescendantCount,
  deleteSingleNodePure,
  deleteSubtreePure,
  moveSubtreeStructurallyPure,
  moveSubtreeLayoutPure,
} from '../lib/subtree';
import {
  alignNodesPure,
  distributeNodesPure,
  type AlignmentAxis,
  type DistributionAxis,
} from '../lib/layoutProductivity';
import {
  createCheckpointPure,
  type GraphCheckpoint,
} from '../lib/checkpoints';
import {
  createAuditEntryPure,
  appendAuditEntryPure,
  type OperationAuditEntry,
} from '../lib/operationAudit';
import {
  toggleCollapsePure,
  expandAllPure,
  collapseAllPure,
  revealNodePure,
} from '../lib/visibility';
import {
  createSubtreeClipboardSnapshot,
  pasteSubtreePure,
  MAX_GRAPH_NODES,
  type SubtreeClipboardData,
} from '../lib/clipboard';
import {
  type NodeContextMenuState,
  type PaneContextMenuState,
} from '../lib/contextMenu';
import {
  loadPersistedWorkspace,
  savePersistedWorkspace,
  isStorageAvailable,
  type PersistedSettings,
} from '../lib/persistence';

/**
 * MOCK SAMPLE COMPLIANCE TEMPLATE
 *
 * Notice: This is mock/sample data for testing and layout demonstration purposes only.
 * FINRA-2210, SEC-17a-4, and DISC-09 entries are sample placeholders, NOT official
 * regulatory workflows.
 */
export const SAMPLE_COMPLIANCE_TEMPLATE_LABEL = 'Sample Compliance Template';

export const INITIAL_SAMPLE_NODES: TreeNode[] = [
  // Root Node
  {
    id: 'root-policy-hierarchy',
    type: 'root',
    position: { x: 450, y: 40 },
    data: {
      label: 'Policy Hierarchy',
      ruleId: 'ROOT-001',
      description: 'Top-level compliance policy framework root (Sample Compliance Template - Mock)',
      severity: 'info',
      status: 'active',
      parameters: {
        frameworkVersion: '2026.1',
        jurisdiction: 'Mock Financial Authority',
      },
      metadata: {
        template: 'Sample Compliance Template',
        mockOnly: true,
      },
      collapsed: false,
    },
  },

  // Branch 1: FINRA-2210 (Rule)
  {
    id: 'rule-finra-2210',
    type: 'rule',
    position: { x: 100, y: 200 },
    data: {
      label: 'FINRA-2210',
      ruleId: 'RULE-FINRA-2210',
      description: 'Mock standard for communications with the public and retail approval rules.',
      severity: 'high',
      status: 'active',
      parameters: {
        approvalRequired: true,
        audienceCategory: 'Retail',
      },
      metadata: {
        category: 'Communications Governance',
        mockSample: true,
      },
      collapsed: false,
    },
  },
  // FINRA-2210 -> Condition
  {
    id: 'cond-finra-2210',
    type: 'condition',
    position: { x: 20, y: 370 },
    data: {
      label: 'Condition: Retail Audience Count',
      ruleId: 'COND-FINRA-2210-01',
      description: 'Evaluates if message targets 25 or more retail investors in a 30-day period.',
      severity: 'medium',
      status: 'active',
      parameters: {
        retailThreshold: 25,
        windowDays: 30,
      },
      metadata: {
        evaluator: 'AudienceCountEvaluator',
      },
      collapsed: false,
    },
  },
  // FINRA-2210 -> Action
  {
    id: 'act-finra-2210',
    type: 'action',
    position: { x: 200, y: 370 },
    data: {
      label: 'Action: Principal Review Routing',
      ruleId: 'ACT-FINRA-2210-01',
      description: 'Require supervisory registered principal sign-off prior to external release.',
      severity: 'high',
      status: 'active',
      parameters: {
        requireSignature: true,
        escalationHours: 24,
      },
      metadata: {
        routingQueue: 'Principal-Review-Desk',
      },
      collapsed: false,
    },
  },

  // Branch 2: SEC-17a-4 (Rule)
  {
    id: 'rule-sec-17a-4',
    type: 'rule',
    position: { x: 450, y: 200 },
    data: {
      label: 'SEC-17a-4',
      ruleId: 'RULE-SEC-17A-4',
      description: 'Mock electronic records retention policy and immutable storage standard.',
      severity: 'critical',
      status: 'active',
      parameters: {
        retentionPeriodYears: 6,
        wormFormatRequired: true,
      },
      metadata: {
        category: 'Books & Records Preservation',
        mockSample: true,
      },
      collapsed: false,
    },
  },
  // SEC-17a-4 -> Condition
  {
    id: 'cond-sec-17a-4',
    type: 'condition',
    position: { x: 370, y: 370 },
    data: {
      label: 'Condition: Record Type Identification',
      ruleId: 'COND-SEC-17A-4-01',
      description: 'Check whether communication contains audit-mandated business transactions.',
      severity: 'medium',
      status: 'active',
      parameters: {
        includesBrokerageData: true,
      },
      metadata: {
        evaluator: 'AuditClassificationFilter',
      },
      collapsed: false,
    },
  },
  // SEC-17a-4 -> Action
  {
    id: 'act-sec-17a-4',
    type: 'action',
    position: { x: 550, y: 370 },
    data: {
      label: 'Action: Store in WORM Vault',
      ruleId: 'ACT-SEC-17A-4-01',
      description: 'Replicate document copy directly to write-once-read-many immutable archive.',
      severity: 'critical',
      status: 'active',
      parameters: {
        wormStorageBucket: 'compliance-worm-vault-01',
        immediateLock: true,
      },
      metadata: {
        archiveTarget: 'ImmutableStorage',
      },
      collapsed: false,
    },
  },

  // Branch 3: DISC-09 (Rule)
  {
    id: 'rule-disc-09',
    type: 'rule',
    position: { x: 800, y: 200 },
    data: {
      label: 'DISC-09',
      ruleId: 'RULE-DISC-09',
      description: 'Mock promotional disclosure and risk disclaimer attachment standard.',
      severity: 'medium',
      status: 'in_review',
      parameters: {
        mandateDisclaimer: true,
        placement: 'Footer',
      },
      metadata: {
        category: 'Marketing Disclosures',
        mockSample: true,
      },
      collapsed: false,
    },
  },
  // DISC-09 -> Condition
  {
    id: 'cond-disc-09',
    type: 'condition',
    position: { x: 720, y: 370 },
    data: {
      label: 'Condition: Missing Risk Warning',
      ruleId: 'COND-DISC-09-01',
      description: 'Detects if marketing content discusses yields without standard risk notices.',
      severity: 'low',
      status: 'active',
      parameters: {
        mentionsYield: true,
        disclaimerSnippetPresent: false,
      },
      metadata: {
        evaluator: 'TextKeywordDetector',
      },
      collapsed: false,
    },
  },
  // DISC-09 -> Action
  {
    id: 'act-disc-09',
    type: 'action',
    position: { x: 900, y: 370 },
    data: {
      label: 'Action: Inject Standard Disclaimer',
      ruleId: 'ACT-DISC-09-01',
      description: 'Automatically append standardized risk disclaimer text to generated output.',
      severity: 'medium',
      status: 'active',
      parameters: {
        disclaimerTemplateId: 'DISC-TEMPLATE-MOCK-09',
        appendAutomatically: true,
      },
      metadata: {
        pipelineStage: 'PostProcessor',
      },
      collapsed: false,
    },
  },
];

export const INITIAL_SAMPLE_EDGES: TreeEdge[] = [
  // Root -> Rule edges
  {
    id: 'e-root-finra',
    source: 'root-policy-hierarchy',
    target: 'rule-finra-2210',
    data: { relationshipType: 'root-rule' },
  },
  {
    id: 'e-root-sec',
    source: 'root-policy-hierarchy',
    target: 'rule-sec-17a-4',
    data: { relationshipType: 'root-rule' },
  },
  {
    id: 'e-root-disc',
    source: 'root-policy-hierarchy',
    target: 'rule-disc-09',
    data: { relationshipType: 'root-rule' },
  },

  // FINRA-2210 branch
  {
    id: 'e-finra-cond',
    source: 'rule-finra-2210',
    target: 'cond-finra-2210',
    data: { relationshipType: 'rule-condition' },
  },
  {
    id: 'e-finra-act',
    source: 'rule-finra-2210',
    target: 'act-finra-2210',
    data: { relationshipType: 'rule-action' },
  },

  // SEC-17a-4 branch
  {
    id: 'e-sec-cond',
    source: 'rule-sec-17a-4',
    target: 'cond-sec-17a-4',
    data: { relationshipType: 'rule-condition' },
  },
  {
    id: 'e-sec-act',
    source: 'rule-sec-17a-4',
    target: 'act-sec-17a-4',
    data: { relationshipType: 'rule-action' },
  },

  // DISC-09 branch
  {
    id: 'e-disc-cond',
    source: 'rule-disc-09',
    target: 'cond-disc-09',
    data: { relationshipType: 'rule-condition' },
  },
  {
    id: 'e-disc-act',
    source: 'rule-disc-09',
    target: 'act-disc-09',
    data: { relationshipType: 'rule-action' },
  },
];

/**
 * Canonical deep-clone getters ensuring active graph mutations
 * do not overwrite or mutate the predefined sample template data.
 */
export const getCanonicalSampleNodes = (): TreeNode[] =>
  JSON.parse(JSON.stringify(INITIAL_SAMPLE_NODES));

export const getCanonicalSampleEdges = (): TreeEdge[] =>
  JSON.parse(JSON.stringify(INITIAL_SAMPLE_EDGES));

/**
 * Zustand Tree Store.
 *
 * Explicitly separates:
 * 1. Graph / Document State: `nodes` and `edges` (persisted, future Zundo undo target).
 * 2. Transient UI State: `selectedNodeId` (never part of document or undo history).
 */
let dragBaselineNodes: TreeNode[] | null = null;
let isLayoutRunning = false;
let prevNodesRef: TreeNode[] = [];
let prevEdgesRef: TreeEdge[] = [];
let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

export type TreeTemporalState = TemporalState<{ nodes: TreeNode[]; edges: TreeEdge[] }> & {
  _handleSet?: (
    pastState: { nodes: TreeNode[]; edges: TreeEdge[] },
    replace: boolean | undefined,
    currentState: { nodes: TreeNode[]; edges: TreeEdge[] },
    deltaState?: unknown
  ) => void;
};
export type TreeStore = UseBoundStore<StoreApi<TreeStoreState> & { temporal: StoreApi<TreeTemporalState> }>;

export const useTreeStore: TreeStore = create<TreeStoreState>()(
  temporal(
    (set, get): TreeStoreState => ({
  // Graph / Document State
  nodes: getCanonicalSampleNodes(),
  edges: getCanonicalSampleEdges(),

  // Transient UI State
  selectedNodeId: null,
  selectedEdgeId: null,
  deleteConfirmation: null,
  addChildChoiceOpen: false,
  statusFeedback: null,
  focusPulseNodeId: null,
  searchQuery: '',
  matchingNodeIds: new Set<string>(),
  clipboard: null,
  nodeContextMenu: null,
  paneContextMenu: null,
  selectedSubtreeRootId: null,
  selectedNodeIds: [],
  checkpoints: [],
  auditLog: [],

  // Day 16 Persistence State
  persistenceStatus: 'idle',
  saveStatus: 'idle',
  saveErrorMessage: null,
  lastSavedAt: null,
  corruptedPayload: null,
  recoveryError: null,
  isResetConfirmationOpen: false,
  persistedSettings: {},

  // Actions
  setNodes: (nodes: TreeNode[]) => set({ nodes }),
  setEdges: (edges: TreeEdge[]) => {
    const { selectedEdgeId } = get();
    const nextSelectedEdgeId =
      selectedEdgeId && edges.some((e) => e.id === selectedEdgeId) ? selectedEdgeId : null;
    set({ edges, selectedEdgeId: nextSelectedEdgeId });
  },
  setSelectedNodeId: (nodeId: string | null) =>
    set({
      selectedNodeId: nodeId,
      selectedNodeIds: nodeId ? [nodeId] : [],
      deleteConfirmation: null,
      addChildChoiceOpen: false,
    }),
  setSelectedEdgeId: (edgeId: string | null) =>
    set({
      selectedEdgeId: edgeId,
      deleteConfirmation: null,
      addChildChoiceOpen: false,
    }),
  clearSelection: () =>
    set({
      selectedNodeId: null,
      selectedEdgeId: null,
      selectedNodeIds: [],
      deleteConfirmation: null,
      addChildChoiceOpen: false,
    }),
  setSelectedNodeIds: (nodeIds: Set<string> | string[]) => {
    const raw = nodeIds as unknown;
    const arr: string[] = Array.isArray(raw)
      ? (raw as string[])
      : raw instanceof Set
      ? Array.from(raw as Set<string>)
      : [];
    set({
      selectedNodeIds: arr,
      selectedNodeId: arr.length === 1 ? arr[0] : null,
      selectedEdgeId: null,
      deleteConfirmation: null,
      addChildChoiceOpen: false,
    });
  },
  toggleNodeSelection: (nodeId: string, additive = false) => {
    const { selectedNodeIds, selectedNodeId } = get();
    const rawIds = selectedNodeIds as unknown;
    const currentArray: string[] = Array.isArray(rawIds)
      ? (rawIds as string[])
      : rawIds instanceof Set
      ? Array.from(rawIds as Set<string>)
      : [];
    const base = currentArray.length > 0 ? currentArray : (selectedNodeId ? [selectedNodeId] : []);
    const nextSet = new Set<string>(additive ? base : []);
    if (nextSet.has(nodeId)) {
      nextSet.delete(nodeId);
    } else {
      nextSet.add(nodeId);
    }
    const arr = Array.from(nextSet);
    set({
      selectedNodeIds: arr,
      selectedNodeId: arr.length === 1 ? arr[0] : null,
      selectedEdgeId: null,
    });
  },
  setFocusPulseNodeId: (id: string | null) => set({ focusPulseNodeId: id }),
  setSearchQueryAndMatches: (query: string, matches: Set<string>) =>
    set({ searchQuery: query, matchingNodeIds: matches }),

  /**
   * Centralized Node Creation Action (Day 4).
   * - Enforces runtime type guard and coordinate validity.
   * - Utilizes pure `createDefaultNode` factory for collision-resistant unique IDs and complete typed data.
   * - Immutably updates graph state, preserving all existing nodes and edges.
   * - Automatically selects the newly created node.
   */
  createNode: (type: NodeType, position: { x: number; y: number }) => {
    if (!isPolicyNodeType(type)) {
      return null;
    }

    if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
      return null;
    }

    const { nodes, edges } = get();
    const existingIds = nodes.map((n) => n.id);
    const newNode = createDefaultNode(type, position, existingIds);

    set({
      nodes: [...nodes, newNode],
      edges: [...edges],
      selectedNodeId: newNode.id,
      selectedNodeIds: [newNode.id],
    });

    return newNode;
  },

  /**
   * Directional Parent-Child Edge Connection Action (Day 5).
   * - Enforces shared validateConnection pipeline (relationship rules, single-parent constraint, cycles, duplicate edges).
   * - Atomic: if invalid, zero graph mutations occur.
   * - If valid, exactly one edge is created with a unique ID and appended immutably.
   */
  addEdgeConnection: (connection) => {
    const { nodes, edges } = get();
    const validation = validateConnection(connection, nodes, edges);

    if (!validation.ok) {
      return {
        ok: false,
        reason: validation.reason,
        message: validation.message,
      };
    }

    const uniqueSuffix =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).substring(2, 8);

    const newEdgeId = `e-${connection.source}-${connection.target}-${uniqueSuffix}`;

    const newEdge: TreeEdge = {
      id: newEdgeId,
      source: connection.source!,
      target: connection.target!,
      sourceHandle: connection.sourceHandle ?? null,
      targetHandle: connection.targetHandle ?? null,
      type: 'smoothstep',
      data: {
        relationshipType: validation.relationshipType,
      },
    };

    set({
      edges: [...edges, newEdge],
    });

    return {
      ok: true,
      edge: newEdge,
    };
  },

  /**
   * Safe Edge Reconnection Action (Day 5 Part 2).
   *
   * Flow:
   * 1. Validates inputs and confirms oldEdge exists in current graph.
   * 2. Validates proposed replacement connection BEFORE modifying or removing oldEdge.
   * 3. Passes `ignoreEdgeId = oldEdge.id` so the old edge does not falsely count as duplicate,
   *    parent, or cycle.
   * 4. If invalid: ZERO graph mutations occur! Original edge and graph remain 100% intact.
   * 5. If valid: performs an atomic replacement in `edges`, preserving edge ID, custom styling,
   *    and configuration metadata while updating connection endpoints and relationshipType.
   */
  reconnectEdgeConnection: (oldEdge, newConnection) => {
    if (!oldEdge || !oldEdge.id || typeof oldEdge.id !== 'string') {
      return {
        ok: false,
        reason: 'malformed',
        message: 'Invalid or missing edge reference to reconnect.',
      };
    }

    if (!newConnection || !newConnection.source || !newConnection.target) {
      return {
        ok: false,
        reason: 'malformed',
        message: 'Reconnected edge must have valid source and target identifiers.',
      };
    }

    const { nodes, edges, selectedEdgeId } = get();
    const existingEdge = edges.find((e) => e.id === oldEdge.id);

    if (!existingEdge) {
      return {
        ok: false,
        reason: 'missing-node',
        message: 'The edge to reconnect does not exist in the current graph.',
      };
    }

    // No-op check: if reconnecting to exact same source, target, and handles, return existing
    if (
      existingEdge.source === newConnection.source &&
      existingEdge.target === newConnection.target &&
      (existingEdge.sourceHandle ?? null) === (newConnection.sourceHandle ?? null) &&
      (existingEdge.targetHandle ?? null) === (newConnection.targetHandle ?? null)
    ) {
      return {
        ok: true,
        edge: existingEdge,
      };
    }

    // CRITICAL: Validate proposed connection BEFORE removing or mutating the existing edge!
    const validation = validateConnection(newConnection, nodes, edges, {
      ignoreEdgeId: existingEdge.id,
    });

    if (!validation.ok) {
      // STRICT ATOMICITY: ZERO graph mutation on rejection!
      return {
        ok: false,
        reason: validation.reason,
        message: validation.message,
      };
    }

    // VALID RECONNECTION: Perform atomic replacement preserving edge ID and configuration
    const updatedEdge: TreeEdge = {
      ...existingEdge,
      source: newConnection.source,
      target: newConnection.target,
      sourceHandle: newConnection.sourceHandle ?? null,
      targetHandle: newConnection.targetHandle ?? null,
      data: {
        ...existingEdge.data,
        relationshipType: validation.relationshipType,
      },
    };

    const updatedEdges = edges.map((e) => (e.id === existingEdge.id ? updatedEdge : e));

    set({
      edges: updatedEdges,
      selectedEdgeId: selectedEdgeId === existingEdge.id ? existingEdge.id : selectedEdgeId,
    });

    return {
      ok: true,
      edge: updatedEdge,
    };
  },

  /**
   * Day 5 Edge Deletion.
   * - Deletes ONLY the specified edge.
   * - Preserves all nodes, unrelated edges, and selectedNodeId.
   * - Safely clears selectedEdgeId if the deleted edge was selected.
   * - Atomic: if edgeId does not exist, zero graph mutation occurs.
   */
  deleteEdge: (edgeId: string) => {
    if (!edgeId || typeof edgeId !== 'string') {
      return false;
    }

    const { edges, selectedEdgeId } = get();
    const existing = edges.find((e) => e.id === edgeId);
    if (!existing) {
      return false;
    }

    const updatedEdges = edges.filter((e) => e.id !== edgeId);
    set({
      edges: updatedEdges,
      selectedEdgeId: selectedEdgeId === edgeId ? null : selectedEdgeId,
    });

    return true;
  },

  /**
   * Day 6: Add Child Action.
   * Atomically creates and appends the child node and directional edge.
   * Sets newly created child as selected, closes choice, and emits feedback.
   */
  addChild: (parentId: string, childType: NodeType) => {
    const { nodes, edges } = get();
    const result = executeAddChild(parentId, childType, nodes, edges);

    if (!result.ok) {
      set({ statusFeedback: result.message ?? 'Failed to add child.' });
      return {
        ok: false,
        reason: result.reason,
        message: result.message,
      };
    }

    set({
      nodes: result.nodes,
      edges: result.edges,
      selectedNodeId: result.data!.newChild.id,
      selectedNodeIds: [result.data!.newChild.id],
      selectedEdgeId: null,
      addChildChoiceOpen: false,
      statusFeedback: `Added ${childType} child.`,
    });

    return {
      ok: true,
      newChild: result.data!.newChild,
      newEdge: result.data!.newEdge,
      message: `Added ${childType} child.`,
    };
  },

  /**
   * Day 6: Duplicate Node Action.
   * Deep-copies parameters and metadata, increments label copy suffix,
   * generates collision-safe ID, copies zero edges, and selects duplicate.
   */
  duplicateNode: (nodeId: string) => {
    const { nodes, edges } = get();
    const result = executeDuplicateNode(nodeId, nodes, edges);

    if (!result.ok) {
      set({ statusFeedback: result.message ?? 'Failed to duplicate node.' });
      return {
        ok: false,
        reason: result.reason,
        message: result.message,
      };
    }

    set({
      nodes: result.nodes,
      edges: result.edges,
      selectedNodeId: result.data!.duplicatedNode.id,
      selectedNodeIds: [result.data!.duplicatedNode.id],
      selectedEdgeId: null,
      deleteConfirmation: null,
      addChildChoiceOpen: false,
      statusFeedback: `Duplicated node: ${result.data!.duplicatedNode.data.label}`,
    });

    return {
      ok: true,
      duplicatedNode: result.data!.duplicatedNode,
      message: `Duplicated node: ${result.data!.duplicatedNode.data.label}`,
    };
  },

  /**
   * Day 6/12: Request Delete Node Action.
   * If non-Root and zero incident edges and zero descendants, deletes immediately without confirmation.
   * Otherwise, sets deleteConfirmation state for user review with descendantCount.
   */
  requestDeleteNode: (nodeId: string) => {
    const { nodes, edges } = get();
    const targetNode = nodes.find((n) => n.id === nodeId);
    if (!targetNode) return;

    const incidentEdges = getNodeIncidentEdges(nodeId, edges);
    const descendantCount = getDescendantCount(nodeId, edges);

    // Isolated non-Root node with no descendants: delete immediately without confirmation
    if (targetNode.type !== 'root' && incidentEdges.length === 0 && descendantCount === 0) {
      const result = deleteSingleNodePure(nodeId, nodes, edges);
      if (!result.ok) {
        set({ statusFeedback: result.reason ?? 'Failed to delete node.' });
        return;
      }
      set({
        nodes: result.nodes,
        edges: result.edges,
        selectedNodeId: null,
        selectedNodeIds: [],
        selectedEdgeId: null,
        deleteConfirmation: null,
        addChildChoiceOpen: false,
        statusFeedback: 'Node deleted successfully.',
      });
      return;
    }

    // Connected node or Root node: requires user confirmation
    set({
      deleteConfirmation: {
        nodeId,
        incidentEdgeCount: incidentEdges.length,
        isRoot: targetNode.type === 'root',
        descendantCount,
      },
    });
  },

  /**
   * Day 6/12: Confirm Delete Node Action.
   * Supports 'single' (deletes node, children preserved as orphans) or 'subtree' (cascades deletion).
   */
  confirmDeleteNode: (mode: 'single' | 'subtree' = 'single') => {
    const { deleteConfirmation, nodes, edges } = get();
    if (!deleteConfirmation) return false;

    const targetNode = nodes.find((n) => n.id === deleteConfirmation.nodeId);
    if (!targetNode) {
      set({ deleteConfirmation: null });
      return false;
    }

    if (mode === 'subtree') {
      const result = deleteSubtreePure(deleteConfirmation.nodeId, nodes, edges);
      if (!result.ok) {
        set({ statusFeedback: result.reason ?? 'Failed to delete subtree.' });
        return false;
      }
      set({
        nodes: result.nodes,
        edges: result.edges,
        selectedNodeId: null,
        selectedNodeIds: [],
        selectedEdgeId: null,
        deleteConfirmation: null,
        addChildChoiceOpen: false,
        statusFeedback: 'Subtree deleted successfully.',
      });
      return true;
    }

    const result = deleteSingleNodePure(deleteConfirmation.nodeId, nodes, edges);
    if (!result.ok) {
      set({ statusFeedback: result.reason ?? 'Failed to delete node.' });
      return false;
    }
    set({
      nodes: result.nodes,
      edges: result.edges,
      selectedNodeId: null,
      selectedNodeIds: [],
      selectedEdgeId: null,
      deleteConfirmation: null,
      addChildChoiceOpen: false,
      statusFeedback: 'Node deleted successfully.',
    });
    return true;
  },

  /**
   * Day 6: Cancel Delete Node Action.
   * Cancels the pending deletion prompt with zero graph mutations.
   */
  cancelDeleteNode: () => {
    set({ deleteConfirmation: null });
  },

  /**
   * Day 6: Re-parent Node Action.
   * Atomically changes parent connection or disconnects child.
   */
  reparentNode: (nodeId: string, newParentId: string | null) => {
    const { nodes, edges } = get();
    const result = executeReparentNode(nodeId, newParentId, nodes, edges);

    if (result.noop) {
      return { ok: true, noop: true };
    }

    if (!result.ok) {
      set({ statusFeedback: result.message ?? 'Failed to re-parent node.' });
      return {
        ok: false,
        reason: result.reason,
        message: result.message,
      };
    }

    const feedback =
      newParentId === null
        ? 'Disconnected node from parent.'
        : 'Node re-parented successfully.';

    set({
      nodes: result.nodes,
      edges: result.edges,
      statusFeedback: feedback,
    });

    return {
      ok: true,
      noop: false,
      message: feedback,
    };
  },

  /**
   * Day 6: Disconnect Node Action.
   * Disconnects node from its incoming parent edge.
   */
  disconnectNode: (nodeId: string) => {
    const res = get().reparentNode(nodeId, null);
    return res.ok && !res.noop;
  },

  /**
   * Day 6: Transient Add Child Choice & Feedback State Handlers
   */
  setAddChildChoiceOpen: (open: boolean) => set({ addChildChoiceOpen: open }),
  setStatusFeedback: (message: string | null) => set({ statusFeedback: message }),

  /**
   * Day 7: Update Node Data Action.
   * Immutably updates the target node's data payload and triggers real-time reactivity.
   */
  updateNodeData: (nodeId: string, updates: Partial<TreeNode['data']>) => {
    const { nodes } = get();
    const targetNode = nodes.find((n) => n.id === nodeId);
    if (!targetNode) return false;

    // No-op check: if nothing changed, create zero history entries
    let hasChanged = false;
    for (const [key, val] of Object.entries(updates)) {
      if (targetNode.data[key] !== val) {
        hasChanged = true;
        break;
      }
    }
    if (!hasChanged) {
      return true;
    }

    const updatedNode = updateNodeDataPure(targetNode, updates);
    const updatedNodes = nodes.map((n) => (n.id === nodeId ? updatedNode : n));

    set({ nodes: updatedNodes });
    return true;
  },

  /**
   * Day 7: Update / Add / Rename Node Parameter Action.
   */
  updateNodeParameter: (
    nodeId: string,
    key: string,
    value: string | number | boolean,
    oldKey?: string
  ) => {
    const { nodes } = get();
    const targetNode = nodes.find((n) => n.id === nodeId);
    if (!targetNode) return false;

    const trimmedKey = key.trim();
    if (!trimmedKey) return false;

    const currentParams = targetNode.data.parameters ?? {};
    if (!oldKey && currentParams[trimmedKey] === value) {
      return true; // No-op: 0 entries
    }

    const nextParams = setParameterPure(targetNode.data.parameters, key, value, oldKey);
    const updatedNode = updateNodeDataPure(targetNode, { parameters: nextParams });
    const updatedNodes = nodes.map((n) => (n.id === nodeId ? updatedNode : n));

    set({ nodes: updatedNodes });
    return true;
  },

  /**
   * Day 7: Delete Node Parameter Action.
   */
  deleteNodeParameter: (nodeId: string, key: string) => {
    const { nodes } = get();
    const targetNode = nodes.find((n) => n.id === nodeId);
    if (!targetNode) return false;

    if (!targetNode.data.parameters || !(key in targetNode.data.parameters)) {
      return false; // Not present: 0 entries
    }

    const nextParams = deleteParameterPure(targetNode.data.parameters, key);
    const updatedNode = updateNodeDataPure(targetNode, { parameters: nextParams });
    const updatedNodes = nodes.map((n) => (n.id === nodeId ? updatedNode : n));

    set({ nodes: updatedNodes });
    return true;
  },

  /**
   * Day 7: Add Tag Action.
   */
  addNodeTag: (nodeId: string, tag: string) => {
    const { nodes } = get();
    const targetNode = nodes.find((n) => n.id === nodeId);
    if (!targetNode) return false;

    const trimmed = tag.trim();
    if (!trimmed || targetNode.data.tags?.includes(trimmed)) {
      return true; // No-op: 0 entries
    }

    const nextTags = addTagPure(targetNode.data.tags, tag);
    const updatedNode = updateNodeDataPure(targetNode, { tags: nextTags });
    const updatedNodes = nodes.map((n) => (n.id === nodeId ? updatedNode : n));

    set({ nodes: updatedNodes });
    return true;
  },

  /**
   * Day 7: Remove Tag Action.
   */
  removeNodeTag: (nodeId: string, tag: string) => {
    const { nodes } = get();
    const targetNode = nodes.find((n) => n.id === nodeId);
    if (!targetNode) return false;

    if (!targetNode.data.tags?.includes(tag)) {
      return false; // Tag not present: 0 entries
    }

    const nextTags = removeTagPure(targetNode.data.tags, tag);
    const updatedNode = updateNodeDataPure(targetNode, { tags: nextTags });
    const updatedNodes = nodes.map((n) => (n.id === nodeId ? updatedNode : n));

    set({ nodes: updatedNodes });
    return true;
  },

  /**
   * Day 7: Update / Add / Rename Node Metadata Tag Action.
   */
  updateNodeMetadata: (
    nodeId: string,
    key: string,
    value: string | number | boolean,
    oldKey?: string
  ) => {
    const { nodes } = get();
    const targetNode = nodes.find((n) => n.id === nodeId);
    if (!targetNode) return false;

    const trimmedKey = key.trim();
    if (!trimmedKey) return false;

    const currentMeta = targetNode.data.metadata ?? {};
    if (!oldKey && currentMeta[trimmedKey] === value) {
      return true; // No-op: 0 entries
    }

    const nextMeta = setMetadataPure(targetNode.data.metadata, key, value, oldKey);
    const updatedNode = updateNodeDataPure(targetNode, { metadata: nextMeta });
    const updatedNodes = nodes.map((n) => (n.id === nodeId ? updatedNode : n));

    set({ nodes: updatedNodes });
    return true;
  },

  /**
   * Day 7: Delete Node Metadata Tag Action.
   */
  deleteNodeMetadata: (nodeId: string, key: string) => {
    const { nodes } = get();
    const targetNode = nodes.find((n) => n.id === nodeId);
    if (!targetNode) return false;

    if (!targetNode.data.metadata || !(key in targetNode.data.metadata)) {
      return false; // Not present: 0 entries
    }

    const nextMeta = deleteMetadataPure(targetNode.data.metadata, key);
    const updatedNode = updateNodeDataPure(targetNode, { metadata: nextMeta });
    const updatedNodes = nodes.map((n) => (n.id === nodeId ? updatedNode : n));

    set({ nodes: updatedNodes });
    return true;
  },

  // ==========================================================================
  // Day 8: Drag Transactions, Batch & History Operations
  // ==========================================================================

  /**
   * Day 8: Node Drag Start Transaction.
   * Captures baseline positions and pauses temporal tracking so intermediate
   * pointer moves do not flood history.
   */
  startNodeDrag: () => {
    if (dragBaselineNodes !== null) {
      get().stopNodeDrag();
    }
    dragBaselineNodes = get().nodes.map((n) => ({
      ...n,
      position: { ...n.position },
    }));
    useTreeStore.temporal.getState().pause();
  },

  /**
   * Day 8: Node Drag Stop Transaction.
   * Resumes temporal tracking, compares final positions against baseline,
   * and commits exactly ONE history entry if any node moved.
   */
  stopNodeDrag: () => {
    if (dragBaselineNodes === null) {
      return; // Safe against drag stop without start
    }
    useTreeStore.temporal.getState().resume();
    const currentNodes = get().nodes;
    const currentEdges = get().edges;
    const baseline = dragBaselineNodes;
    dragBaselineNodes = null;

    if (hasNodesMoved(baseline, currentNodes)) {
      useTreeStore.temporal.getState()._handleSet?.(
        { nodes: baseline, edges: currentEdges },
        undefined,
        { nodes: currentNodes, edges: currentEdges }
      );
    }
  },

  /**
   * Day 8: Node Drag Cancellation.
   * Restores original node positions, resumes temporal tracking,
   * and creates zero history entries.
   */
  cancelNodeDrag: () => {
    if (dragBaselineNodes === null) {
      return;
    }
    const baseline = dragBaselineNodes;
    dragBaselineNodes = null;
    set({ nodes: baseline });
    useTreeStore.temporal.getState().resume();
  },

  /**
   * Day 8: Apply Valid Batch Graph Updates.
   * Atomically sets nodes and edges in exactly 1 history entry,
   * or rejects with 0 entries if validation fails or graph is unchanged.
   */
  applyGraphBatch: (batch: { nodes?: TreeNode[]; edges?: TreeEdge[] }) => {
    const currentNodes = get().nodes;
    const currentEdges = get().edges;
    const nextNodes = batch.nodes ?? currentNodes;
    const nextEdges = batch.edges ?? currentEdges;

    // Validation: edge references must exist in target nodes
    const nodeIds = new Set(nextNodes.map((n) => n.id));
    for (const edge of nextEdges) {
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
        return false; // Invalid batch
      }
    }

    // Unchanged check
    const nodesUnchanged =
      nextNodes.length === currentNodes.length &&
      nextNodes.every((n, i) => n === currentNodes[i]);
    const edgesUnchanged =
      nextEdges.length === currentEdges.length &&
      nextEdges.every((e, i) => e === currentEdges[i]);

    if (nodesUnchanged && edgesUnchanged) {
      return false; // No-op: 0 entries
    }

    set({ nodes: nextNodes, edges: nextEdges });
    get().reconcileSelection();
    return true;
  },

  /**
   * Day 8: Delete Subtree Action.
   * Atomically removes the target node, all downstream descendants, and all incident edges.
   */
  deleteSubtree: (nodeId: string) => {
    const { nodes, edges } = get();
    const targetNode = nodes.find((n) => n.id === nodeId);
    if (!targetNode) {
      set({ statusFeedback: 'Node not found.' });
      return false;
    }

    const result = executeDeleteSubtree(nodeId, nodes, edges);
    if (!result.ok) {
      set({ statusFeedback: result.reason ?? 'Failed to delete subtree.' });
      return false;
    }

    const { selectedNodeId, selectedEdgeId, selectedNodeIds } = get();
    const deletedNodeIds = new Set(result.data!.deletedNodes.map((n) => n.id));
    const nextSelectedNodeId =
      selectedNodeId && deletedNodeIds.has(selectedNodeId) ? null : selectedNodeId;
    const nextSelectedNodeIds = (selectedNodeIds || []).filter(
      (id) => !deletedNodeIds.has(id)
    );
    const remainingEdgeIds = new Set(result.edges.map((e) => e.id));
    const nextSelectedEdgeId =
      selectedEdgeId && !remainingEdgeIds.has(selectedEdgeId) ? null : selectedEdgeId;

    set({
      nodes: result.nodes,
      edges: result.edges,
      selectedNodeId: nextSelectedNodeId,
      selectedNodeIds: nextSelectedNodeIds,
      selectedEdgeId: nextSelectedEdgeId,
      deleteConfirmation: null,
      statusFeedback: 'Subtree deleted successfully.',
    });
    return true;
  },

  /**
   * Day 8: Selection Reconciliation.
   * Ensures selectedNodeId and selectedEdgeId point to elements that actually exist
   * in the current graph. Transient UI state: creates ZERO history entries.
   */
  reconcileSelection: () => {
    const { nodes, edges, selectedNodeId, selectedEdgeId, deleteConfirmation, selectedNodeIds } = get();
    let changed = false;
    let nextNodeId = selectedNodeId;
    let nextEdgeId = selectedEdgeId;
    let nextDeleteConfirm = deleteConfirmation;

    if (selectedNodeId && !nodes.some((n) => n.id === selectedNodeId)) {
      nextNodeId = null;
      changed = true;
    }
    if (selectedEdgeId && !edges.some((e) => e.id === selectedEdgeId)) {
      nextEdgeId = null;
      changed = true;
    }
    if (deleteConfirmation && !nodes.some((n) => n.id === deleteConfirmation.nodeId)) {
      nextDeleteConfirm = null;
      changed = true;
    }

    const validNodeIdSet = new Set(nodes.map((n) => n.id));
    const nextSelectedNodeIds = (selectedNodeIds || []).filter((id) => validNodeIdSet.has(id));
    if (nextSelectedNodeIds.length !== (selectedNodeIds?.length || 0)) {
      changed = true;
    }

    if (changed) {
      set({
        selectedNodeId: nextNodeId,
        selectedEdgeId: nextEdgeId,
        deleteConfirmation: nextDeleteConfirm,
        selectedNodeIds: nextSelectedNodeIds,
      });
    }
  },

  /**
   * Day 8: Undo Action.
   * Restores previous graph snapshot, reconciles selection, and displays feedback.
   */
  undo: (steps = 1) => {
    const temporal = useTreeStore.temporal.getState();
    if (temporal.pastStates.length > 0) {
      temporal.undo(steps);
      get().reconcileSelection();
      set({ statusFeedback: 'Undid last graph action' });
    }
  },

  /**
   * Day 8: Redo Action.
   * Restores future graph snapshot, reconciles selection, and displays feedback.
   */
  redo: (steps = 1) => {
    const temporal = useTreeStore.temporal.getState();
    if (temporal.futureStates.length > 0) {
      temporal.redo(steps);
      get().reconcileSelection();
      set({ statusFeedback: 'Redid last graph action' });
    }
  },

  canUndo: () => useTreeStore.temporal.getState().pastStates.length > 0,
  canRedo: () => useTreeStore.temporal.getState().futureStates.length > 0,
  getHistoryDepth: () => ({
    past: useTreeStore.temporal.getState().pastStates.length,
    future: useTreeStore.temporal.getState().futureStates.length,
  }),

  /**
   * Replaces current graph with the canonical Day 1 sample.
   * Clears temporal history and establishes new baseline with 0 past and 0 future states.
   */
  loadSampleTree: () => {
    const sampleNodes = getCanonicalSampleNodes();
    const sampleEdges = getCanonicalSampleEdges();
    prevNodesRef = sampleNodes;
    prevEdgesRef = sampleEdges;
    if (autosaveTimer) {
      clearTimeout(autosaveTimer);
      autosaveTimer = null;
    }

    set({
      nodes: sampleNodes,
      edges: sampleEdges,
      selectedNodeId: null,
      selectedEdgeId: null,
      deleteConfirmation: null,
      addChildChoiceOpen: false,
      searchQuery: '',
      matchingNodeIds: new Set<string>(),
      statusFeedback: 'Sample compliance template loaded.',
    });
    useTreeStore.temporal.getState().clear();

    if (get().persistenceStatus === 'ready' && isStorageAvailable()) {
      const saveRes = savePersistedWorkspace(sampleNodes, sampleEdges, get().persistedSettings);
      if (saveRes.ok) {
        set({ saveStatus: 'saved', lastSavedAt: saveRes.savedAt, saveErrorMessage: null });
      }
    }
  },

  resetToSampleData: () => {
    set({
      nodes: getCanonicalSampleNodes(),
      edges: getCanonicalSampleEdges(),
      selectedNodeId: null,
      selectedEdgeId: null,
      deleteConfirmation: null,
      addChildChoiceOpen: false,
      searchQuery: '',
      matchingNodeIds: new Set<string>(),
      statusFeedback: null,
      selectedNodeIds: [],
      selectedSubtreeRootId: null,
    });
    useTreeStore.temporal.getState().clear();
  },

  /**
   * Day 10: Hierarchical Auto-Layout Action.
   *
   * Executes deterministic top-to-bottom layout via @dagrejs/dagre:
   * - Re-entrancy guard protects against rapid duplicate clicks.
   * - Snapshot safety: verifies graph is current before applying coordinates.
   * - Position-only mutation: preserves node IDs, types, data object references, and edges.
   * - Single atomic store update: creates exactly 1 history entry if nodes moved.
   * - No-op or failure updates create 0 history entries.
   * - Preserves selection, inspector state, and Day 9 search cache stability.
   */
  applyAutoLayout: (options?: LayoutOptions) => {
    if (isLayoutRunning) {
      return {
        ok: false,
        reason: 'Layout already in progress',
        message: 'Layout already in progress.',
      };
    }
    isLayoutRunning = true;
    try {
      const snapshotNodes = get().nodes;
      const snapshotEdges = get().edges;

      if (snapshotNodes.length === 0) {
        set({ statusFeedback: 'No nodes to arrange.' });
        return { ok: true, noop: true, movedCount: 0, message: 'No nodes to arrange.' };
      }

      const layoutResult = calculateAutoLayout(snapshotNodes, snapshotEdges, options);

      if (!layoutResult.ok) {
        const errorMsg = `Layout failed: ${layoutResult.reason}`;
        set({ statusFeedback: errorMsg });
        return { ok: false, reason: layoutResult.reason, message: errorMsg };
      }

      // Snapshot safety: verify graph was not mutated during calculation
      if (get().nodes !== snapshotNodes || get().edges !== snapshotEdges) {
        return {
          ok: false,
          reason: 'Graph modified during layout calculation',
          message: 'Layout aborted: graph modified during calculation.',
        };
      }

      // Idempotence & no-op detection: 0 history entries created
      if (!layoutResult.hasMoved) {
        const noopMsg = 'Already arranged.';
        set({ statusFeedback: noopMsg });
        return { ok: true, noop: true, movedCount: 0, message: noopMsg };
      }

      // Construct nextNodes preserving exact node data references and un-moved node references
      const nextNodes = snapshotNodes.map((node) => {
        const newPos = layoutResult.positions[node.id];
        if (!newPos || (newPos.x === node.position.x && newPos.y === node.position.y)) {
          return node;
        }
        return {
          ...node,
          position: { x: newPos.x, y: newPos.y },
        };
      });

      const successMsg = `Auto-layout applied (${layoutResult.metrics.movedCount} nodes arranged).`;
      set({
        nodes: nextNodes,
        statusFeedback: successMsg,
      });

      return {
        ok: true,
        noop: false,
        movedCount: layoutResult.metrics.movedCount,
        message: successMsg,
        metrics: layoutResult.metrics,
      };
    } finally {
      isLayoutRunning = false;
    }
  },

  // Day 12 Subtree Operations, Clipboard, Collapse/Expand, & Context Menu Actions
  copySubtree: (rootId?: string) => {
    const { selectedNodeIds } = get();
    const rawIds = selectedNodeIds as unknown;
    const currentArray: string[] = Array.isArray(rawIds)
      ? (rawIds as string[])
      : rawIds instanceof Set
      ? Array.from(rawIds as Set<string>)
      : [];
    if (!rootId && currentArray.length >= 2) {
      return get().copySelectedNodes();
    }

    const targetId = rootId ?? get().selectedNodeId;
    if (!targetId) {
      set({ statusFeedback: 'No node selected to copy.' });
      return false;
    }

    const { nodes, edges } = get();
    const result = createSubtreeClipboardSnapshot(targetId, nodes, edges);
    if (!result.ok || !result.data) {
      set({ statusFeedback: result.reason ?? 'Failed to copy subtree.' });
      return false;
    }

    const count = result.data.nodes.length;
    set({
      clipboard: result.data,
      statusFeedback: `Subtree copied to clipboard (${count} node${count > 1 ? 's' : ''}).`,
    });
    return true;
  },

  copySelectedNodes: () => {
    const { selectedNodeIds, selectedNodeId, nodes, edges } = get();
    const rawIds = selectedNodeIds as unknown;
    const currentArray: string[] = Array.isArray(rawIds)
      ? (rawIds as string[])
      : rawIds instanceof Set
      ? Array.from(rawIds as Set<string>)
      : [];
    let ids: string[];
    if (currentArray.length > 0) {
      ids = currentArray;
    } else if (selectedNodeId) {
      ids = [selectedNodeId];
    } else {
      ids = nodes.filter((n) => n.selected).map((n) => n.id);
    }

    if (ids.length === 0) {
      set({ statusFeedback: 'No nodes selected to copy.' });
      return false;
    }

    const selectedNodes = nodes.filter((n) => ids.includes(n.id));
    const selectedEdges = edges.filter(
      (e) => ids.includes(e.source) && ids.includes(e.target)
    );

    if (selectedNodes.length > MAX_GRAPH_NODES) {
      set({ statusFeedback: `Selection exceeds maximum limit of ${MAX_GRAPH_NODES} nodes.` });
      return false;
    }

    const clonedNodes: TreeNode[] = JSON.parse(JSON.stringify(selectedNodes));
    const clonedEdges: TreeEdge[] = JSON.parse(JSON.stringify(selectedEdges));

    const clipboardData = {
      version: 1 as const,
      rootNodeId: ids[0],
      nodes: clonedNodes,
      edges: clonedEdges,
      copiedAt: Date.now(),
    };

    set({
      clipboard: clipboardData,
      statusFeedback: `Copied ${clonedNodes.length} selected node(s) to clipboard.`,
    });
    return true;
  },

  deleteSelectedNodes: () => {
    const { selectedNodeIds, selectedNodeId, nodes, edges } = get();
    const rawIds = selectedNodeIds as unknown;
    const currentArray: string[] = Array.isArray(rawIds)
      ? (rawIds as string[])
      : rawIds instanceof Set
      ? Array.from(rawIds as Set<string>)
      : [];
    let ids: string[];
    if (currentArray.length > 0) {
      ids = currentArray;
    } else if (selectedNodeId) {
      ids = [selectedNodeId];
    } else {
      ids = nodes.filter((n) => n.selected).map((n) => n.id);
    }

    if (ids.length === 0) {
      set({ statusFeedback: 'No nodes selected to delete.' });
      return false;
    }

    const selectedNodes = nodes.filter((n) => ids.includes(n.id));

    const deleteSet = new Set(ids);
    const nextNodes = nodes.filter((n) => !deleteSet.has(n.id));
    const nextEdges = edges.filter(
      (e) => !deleteSet.has(e.source) && !deleteSet.has(e.target)
    );

    const actualDeletedCount = selectedNodes.length;

    set({
      nodes: nextNodes,
      edges: nextEdges,
      selectedNodeId: null,
      selectedNodeIds: [],
      deleteConfirmation: null,
      statusFeedback: `${actualDeletedCount} node${actualDeletedCount > 1 ? 's' : ''} deleted successfully.`,
    });
    return true;
  },

  pasteSubtree: (
    targetParentId?: string | null,
    options?: { cursorPosition?: { x: number; y: number } }
  ) => {
    const { clipboard, nodes, edges } = get();
    if (!clipboard) {
      const msg = 'No subtree in clipboard to paste.';
      set({ statusFeedback: msg });
      return { ok: false, message: msg };
    }

    const effectiveParentId =
      targetParentId !== undefined ? targetParentId : get().selectedNodeId;

    const result = pasteSubtreePure(clipboard, effectiveParentId, nodes, edges, options);
    if (!result.ok) {
      set({ statusFeedback: result.message ?? 'Paste failed.' });
      return { ok: false, message: result.message ?? 'Paste failed.' };
    }

    set({
      nodes: result.nodes,
      edges: result.edges,
      selectedNodeId: result.newRootId ?? null,
      selectedEdgeId: null,
      statusFeedback: result.message ?? 'Subtree pasted.',
    });

    return {
      ok: true,
      message: result.message ?? 'Subtree pasted.',
      pastedCount: result.pastedCount,
      newRootId: result.newRootId,
    };
  },

  duplicateSubtree: (rootId?: string) => {
    const targetId = rootId ?? get().selectedNodeId;
    if (!targetId) {
      const msg = 'No node selected to duplicate.';
      set({ statusFeedback: msg });
      return { ok: false, message: msg };
    }

    const { nodes, edges } = get();
    const snapshot = createSubtreeClipboardSnapshot(targetId, nodes, edges);
    if (!snapshot.ok || !snapshot.data) {
      const msg = snapshot.reason ?? 'Failed to capture subtree.';
      set({ statusFeedback: msg });
      return { ok: false, message: msg };
    }

    const result = pasteSubtreePure(snapshot.data, null, nodes, edges, {
      defaultOffset: { x: 50, y: 50 },
    });

    if (!result.ok) {
      set({ statusFeedback: result.message ?? 'Duplication failed.' });
      return { ok: false, message: result.message ?? 'Duplication failed.' };
    }

    set({
      nodes: result.nodes,
      edges: result.edges,
      selectedNodeId: result.newRootId ?? null,
      selectedEdgeId: null,
      statusFeedback: `Duplicated subtree (${result.pastedCount} nodes).`,
    });

    return {
      ok: true,
      message: `Duplicated subtree (${result.pastedCount} nodes).`,
      duplicatedRootId: result.newRootId,
    };
  },

  toggleNodeCollapse: (nodeId: string) => {
    const { nodes } = get();
    const result = toggleCollapsePure(nodeId, nodes);
    if (!result.toggled) {
      return false;
    }

    set({
      nodes: result.nodes,
      statusFeedback: result.newState ? 'Subtree collapsed.' : 'Subtree expanded.',
    });
    return true;
  },

  expandAllSubtrees: () => {
    const { nodes } = get();
    const nextNodes = expandAllPure(nodes);
    set({
      nodes: nextNodes,
      statusFeedback: 'All subtrees expanded.',
    });
  },

  collapseAllSubtrees: () => {
    const { nodes, edges } = get();
    const nextNodes = collapseAllPure(nodes, edges);
    set({
      nodes: nextNodes,
      statusFeedback: 'All subtrees collapsed.',
    });
  },

  revealNode: (nodeId: string) => {
    const { nodes, edges } = get();
    const result = revealNodePure(nodeId, nodes, edges);
    if (result.uncollapsedNodeIds.length > 0) {
      set({ nodes: result.nodes });
    }
  },

  deleteSingleNode: (nodeId: string) => {
    const { nodes, edges } = get();
    const targetNode = nodes.find((n) => n.id === nodeId);
    if (!targetNode) {
      set({ statusFeedback: 'Node not found.' });
      return false;
    }

    const result = deleteSingleNodePure(nodeId, nodes, edges);
    if (!result.ok) {
      set({ statusFeedback: result.reason ?? 'Failed to delete node.' });
      return false;
    }

    const { selectedNodeId, selectedEdgeId, selectedNodeIds } = get();
    const nextSelectedNodeId = selectedNodeId === nodeId ? null : selectedNodeId;
    const nextSelectedNodeIds = (selectedNodeIds || []).filter((id) => id !== nodeId);
    const removedEdgeIds = new Set((result.removedEdges ?? []).map((e) => e.id));
    const nextSelectedEdgeId =
      selectedEdgeId && removedEdgeIds.has(selectedEdgeId) ? null : selectedEdgeId;

    set({
      nodes: result.nodes,
      edges: result.edges,
      selectedNodeId: nextSelectedNodeId,
      selectedNodeIds: nextSelectedNodeIds,
      selectedEdgeId: nextSelectedEdgeId,
      deleteConfirmation: null,
      addChildChoiceOpen: false,
      statusFeedback: 'Node deleted successfully.',
    });
    return true;
  },

  setNodeContextMenu: (menu: NodeContextMenuState | null) => {
    set({ nodeContextMenu: menu, paneContextMenu: null });
  },

  setPaneContextMenu: (menu: PaneContextMenuState | null) => {
    set({ paneContextMenu: menu, nodeContextMenu: null });
  },

  closeAllContextMenus: () => {
    set({ nodeContextMenu: null, paneContextMenu: null });
  },

  setSelectedSubtreeRootId: (nodeId: string | null) => {
    set({ selectedSubtreeRootId: nodeId });
  },

  moveSubtreeStructurally: (subtreeRootId: string, newParentId: string | null) => {
    const { nodes, edges } = get();
    const res = moveSubtreeStructurallyPure(subtreeRootId, newParentId, nodes, edges);
    if (!res.ok) {
      set({ statusFeedback: res.message });
      return { ok: false, message: res.message, reason: res.reason };
    }

    set({
      nodes: res.nodes,
      edges: res.edges,
      statusFeedback: res.message,
      selectedNodeId: subtreeRootId,
      selectedSubtreeRootId: subtreeRootId,
    });
    return { ok: true, message: res.message };
  },

  moveSubtreeLayout: (subtreeRootId: string, dx: number, dy: number) => {
    const { nodes, edges } = get();
    const res = moveSubtreeLayoutPure(subtreeRootId, dx, dy, nodes, edges);
    if (!res.ok) {
      return { ok: false, movedCount: 0, message: res.reason || 'Failed to move subtree layout' };
    }

    set({
      nodes: res.nodes,
      statusFeedback: `Subtree layout shifted (${res.movedCount} nodes).`,
    });
    return { ok: true, movedCount: res.movedCount, message: `Moved ${res.movedCount} nodes.` };
  },

  alignSelectedNodes: (nodeIds: string[], axis: AlignmentAxis) => {
    const { nodes } = get();
    const updatedNodes = alignNodesPure(nodeIds, axis, nodes);
    set({
      nodes: updatedNodes,
      statusFeedback: `Aligned ${nodeIds.length} nodes to ${axis}.`,
    });
    return true;
  },

  distributeSelectedNodes: (nodeIds: string[], axis: DistributionAxis) => {
    const { nodes } = get();
    const updatedNodes = distributeNodesPure(nodeIds, axis, nodes);
    set({
      nodes: updatedNodes,
      statusFeedback: `Distributed ${nodeIds.length} nodes ${axis}ly.`,
    });
    return true;
  },

  createCheckpoint: (name: string, description?: string) => {
    const { nodes, edges, checkpoints } = get();
    const cp = createCheckpointPure(name, nodes, edges, description);
    set({
      checkpoints: [cp, ...checkpoints],
      statusFeedback: `Checkpoint "${cp.name}" saved.`,
    });
    return cp;
  },

  restoreCheckpoint: (checkpointId: string) => {
    const { checkpoints } = get();
    const cp = checkpoints.find((c) => c.id === checkpointId);
    if (!cp) return false;

    set({
      nodes: JSON.parse(JSON.stringify(cp.nodes)),
      edges: JSON.parse(JSON.stringify(cp.edges)),
      selectedNodeId: null,
      selectedEdgeId: null,
      selectedSubtreeRootId: null,
      statusFeedback: `Restored checkpoint "${cp.name}".`,
    });
    return true;
  },

  deleteCheckpoint: (checkpointId: string) => {
    const { checkpoints } = get();
    set({
      checkpoints: checkpoints.filter((c) => c.id !== checkpointId),
    });
    return true;
  },

  appendAuditEntry: (operationType, status, affectedNodeIds, affectedEdgeIds, options) => {
    const { auditLog } = get();
    const entry = createAuditEntryPure(operationType, status, affectedNodeIds, affectedEdgeIds, options);
    set({
      auditLog: appendAuditEntryPure(auditLog, entry),
    });
  },

  // Day 16 Persistence Actions
  initializePersistence: async () => {
    if (!isStorageAvailable()) {
      set({ persistenceStatus: 'unavailable', saveStatus: 'idle' });
      return;
    }

    set({ persistenceStatus: 'restoring' });
    const loadResult = loadPersistedWorkspace();

    if (loadResult.ok) {
      const doc = loadResult.document;
      prevNodesRef = doc.nodes;
      prevEdgesRef = doc.edges;
      if (autosaveTimer) {
        clearTimeout(autosaveTimer);
        autosaveTimer = null;
      }

      set({
        nodes: doc.nodes,
        edges: doc.edges,
        persistedSettings: doc.settings || {},
        lastSavedAt: doc.savedAt,
        persistenceStatus: 'ready',
        saveStatus: 'saved',
        saveErrorMessage: null,
        corruptedPayload: null,
        recoveryError: null,
        selectedNodeId: null,
        selectedEdgeId: null,
        selectedNodeIds: [],
        selectedSubtreeRootId: null,
        searchQuery: '',
        matchingNodeIds: new Set<string>(),
        deleteConfirmation: null,
        addChildChoiceOpen: false,
        statusFeedback: 'Saved workspace restored.',
      });
      // Fresh history guarantee: previous session history is never restored; starts fresh on restore.
      useTreeStore.temporal.getState().clear();
    } else if (loadResult.errorType === 'NO_DATA') {
      const currentNodes = get().nodes;
      const currentEdges = get().edges;
      const currentSettings = get().persistedSettings;
      prevNodesRef = currentNodes;
      prevEdgesRef = currentEdges;
      if (autosaveTimer) {
        clearTimeout(autosaveTimer);
        autosaveTimer = null;
      }

      const saveRes = savePersistedWorkspace(currentNodes, currentEdges, currentSettings);
      set({
        persistenceStatus: 'ready',
        saveStatus: saveRes.ok ? 'saved' : 'idle',
        lastSavedAt: saveRes.ok ? saveRes.savedAt : null,
        saveErrorMessage: saveRes.ok ? null : saveRes.message,
        corruptedPayload: null,
        recoveryError: null,
      });
      useTreeStore.temporal.getState().clear();
    } else {
      // Data corruption or schema mismatch: do NOT overwrite storage!
      set({
        persistenceStatus: 'recovery-required',
        corruptedPayload: loadResult.rawPayload || null,
        recoveryError: loadResult.message,
        saveStatus: 'idle',
      });
      useTreeStore.temporal.getState().clear();
    }
  },

  scheduleAutosave: () => {
    const { persistenceStatus } = get();
    if (persistenceStatus !== 'ready') return;

    set({ saveStatus: 'unsaved' });
    if (autosaveTimer) {
      clearTimeout(autosaveTimer);
    }
    autosaveTimer = setTimeout(() => {
      get().saveNow();
    }, 600);
  },

  saveNow: () => {
    set({ saveStatus: 'saving', saveErrorMessage: null });
    const { nodes, edges, persistedSettings } = get();
    const result = savePersistedWorkspace(nodes, edges, persistedSettings);

    if (result.ok) {
      set({
        saveStatus: 'saved',
        lastSavedAt: result.savedAt,
        saveErrorMessage: null,
      });
      return true;
    } else {
      set({
        saveStatus: 'error',
        saveErrorMessage: result.message,
      });
      return false;
    }
  },

  openResetConfirmation: () => {
    set({ isResetConfirmationOpen: true });
  },

  closeResetConfirmation: () => {
    set({ isResetConfirmationOpen: false });
  },

  confirmResetSampleTree: () => {
    const sampleNodes = getCanonicalSampleNodes();
    const sampleEdges = getCanonicalSampleEdges();
    const settings = get().persistedSettings;

    prevNodesRef = sampleNodes;
    prevEdgesRef = sampleEdges;
    if (autosaveTimer) {
      clearTimeout(autosaveTimer);
      autosaveTimer = null;
    }

    set({
      isResetConfirmationOpen: false,
      nodes: sampleNodes,
      edges: sampleEdges,
      selectedNodeId: null,
      selectedEdgeId: null,
      selectedNodeIds: [],
      selectedSubtreeRootId: null,
      deleteConfirmation: null,
      addChildChoiceOpen: false,
      searchQuery: '',
      matchingNodeIds: new Set<string>(),
      statusFeedback: 'Reset to sample compliance template.',
    });

    useTreeStore.temporal.getState().clear();

    if (isStorageAvailable()) {
      const saveRes = savePersistedWorkspace(sampleNodes, sampleEdges, settings);
      if (saveRes.ok) {
        set({
          persistenceStatus: 'ready',
          saveStatus: 'saved',
          lastSavedAt: saveRes.savedAt,
          saveErrorMessage: null,
        });
        return true;
      } else {
        set({
          saveStatus: 'error',
          saveErrorMessage: saveRes.message,
        });
        return false;
      }
    }
    return true;
  },

  recoverWithSampleTree: () => {
    const sampleNodes = getCanonicalSampleNodes();
    const sampleEdges = getCanonicalSampleEdges();
    const settings = get().persistedSettings;

    prevNodesRef = sampleNodes;
    prevEdgesRef = sampleEdges;
    if (autosaveTimer) {
      clearTimeout(autosaveTimer);
      autosaveTimer = null;
    }

    set({
      nodes: sampleNodes,
      edges: sampleEdges,
      selectedNodeId: null,
      selectedEdgeId: null,
      selectedNodeIds: [],
      selectedSubtreeRootId: null,
      deleteConfirmation: null,
      addChildChoiceOpen: false,
      corruptedPayload: null,
      recoveryError: null,
      statusFeedback: 'Recovered workspace with sample compliance template.',
    });

    useTreeStore.temporal.getState().clear();

    if (isStorageAvailable()) {
      const saveRes = savePersistedWorkspace(sampleNodes, sampleEdges, settings);
      if (saveRes.ok) {
        set({
          persistenceStatus: 'ready',
          saveStatus: 'saved',
          lastSavedAt: saveRes.savedAt,
          saveErrorMessage: null,
        });
        return true;
      }
    }
    set({ persistenceStatus: 'ready', saveStatus: 'idle' });
    return true;
  },

  recoverWithEmptyTree: () => {
    const emptyNodes: TreeNode[] = [];
    const emptyEdges: TreeEdge[] = [];
    prevNodesRef = emptyNodes;
    prevEdgesRef = emptyEdges;
    if (autosaveTimer) {
      clearTimeout(autosaveTimer);
      autosaveTimer = null;
    }

    set({
      nodes: emptyNodes,
      edges: emptyEdges,
      selectedNodeId: null,
      selectedEdgeId: null,
      selectedNodeIds: [],
      selectedSubtreeRootId: null,
      deleteConfirmation: null,
      addChildChoiceOpen: false,
      corruptedPayload: null,
      recoveryError: null,
      statusFeedback: 'Started with empty workspace.',
    });

    useTreeStore.temporal.getState().clear();

    if (isStorageAvailable()) {
      const saveRes = savePersistedWorkspace(emptyNodes, emptyEdges, get().persistedSettings);
      if (saveRes.ok) {
        set({
          persistenceStatus: 'ready',
          saveStatus: 'saved',
          lastSavedAt: saveRes.savedAt,
          saveErrorMessage: null,
        });
        return true;
      }
    }
    set({ persistenceStatus: 'ready', saveStatus: 'idle' });
    return true;
  },

  dismissRecoveryModal: () => {
    set({
      recoveryError: null,
      corruptedPayload: null,
    });
  },
    }),
    {
      limit: 100,
      partialize: (state) => ({ nodes: state.nodes, edges: state.edges }),
      equality: (pastState, currentState) => areGraphStatesEqual(pastState, currentState),
    }
  )
);

// Subscribe to store mutations to trigger debounced autosave when nodes or edges change
prevNodesRef = useTreeStore.getState().nodes;
prevEdgesRef = useTreeStore.getState().edges;

useTreeStore.subscribe((state) => {
  if (state.persistenceStatus === 'ready') {
    if (state.nodes !== prevNodesRef || state.edges !== prevEdgesRef) {
      prevNodesRef = state.nodes;
      prevEdgesRef = state.edges;
      state.scheduleAutosave();
    }
  } else {
    prevNodesRef = state.nodes;
    prevEdgesRef = state.edges;
  }
});

