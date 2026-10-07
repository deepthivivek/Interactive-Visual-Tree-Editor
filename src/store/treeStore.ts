import { create } from 'zustand';
import type { TreeNode, TreeEdge, TreeStoreState, NodeType } from '../types/tree';
import { createDefaultNode, isPolicyNodeType } from '../lib/nodeFactory';

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
export const useTreeStore = create<TreeStoreState>((set, get) => ({
  // Graph / Document State
  nodes: getCanonicalSampleNodes(),
  edges: getCanonicalSampleEdges(),

  // Transient UI State
  selectedNodeId: null,

  // Actions
  setNodes: (nodes: TreeNode[]) => set({ nodes }),
  setEdges: (edges: TreeEdge[]) => set({ edges }),
  setSelectedNodeId: (nodeId: string | null) => set({ selectedNodeId: nodeId }),

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
    });

    return newNode;
  },

  /**
   * Replaces current graph with the canonical Day 1 sample.
   * Restores predefined IDs, positions, and edges without shared-reference mutation.
   */
  loadSampleTree: () =>
    set({
      nodes: getCanonicalSampleNodes(),
      edges: getCanonicalSampleEdges(),
      selectedNodeId: null,
    }),

  resetToSampleData: () =>
    set({
      nodes: getCanonicalSampleNodes(),
      edges: getCanonicalSampleEdges(),
      selectedNodeId: null,
    }),
}));
