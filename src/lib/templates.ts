/**
 * Compliance Rule Templates Library (Day 21).
 *
 * Provides curated, validated hierarchical templates for financial and regulatory compliance workflows.
 * Every template strictly respects the established graph relationship grammar:
 * - Root → Rule
 * - Rule → Condition, Rule → Action
 * - Condition → Action
 * - Action has 0 outgoing connections
 * - Single-parent constraint & 0 cycles
 *
 * NOTE: All templates are sample compliance mock structures for demonstration purposes.
 */

import type { TreeNode, TreeEdge } from '../types/tree';
import {
  getCanonicalSampleNodes,
  getCanonicalSampleEdges,
  SAMPLE_COMPLIANCE_TEMPLATE_LABEL,
} from '../store/treeStore';
import { isValidParentChildRelationship } from './relationshipRules';
import { hasAnyCycle } from './cycleDetection';

export interface ComplianceTemplate {
  id: string;
  title: string;
  category: string;
  description: string;
  disclaimer: string;
  badge: string;
  nodes: TreeNode[];
  edges: TreeEdge[];
  stats: {
    nodeCount: number;
    edgeCount: number;
    rootCount: number;
    ruleCount: number;
    conditionCount: number;
    actionCount: number;
  };
}

/**
 * Calculates node distribution stats for any node list.
 */
export function calculateTemplateStats(nodes: TreeNode[], edges: TreeEdge[]) {
  let rootCount = 0;
  let ruleCount = 0;
  let conditionCount = 0;
  let actionCount = 0;

  for (const n of nodes) {
    if (n.type === 'root') rootCount++;
    else if (n.type === 'rule') ruleCount++;
    else if (n.type === 'condition') conditionCount++;
    else if (n.type === 'action') actionCount++;
  }

  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    rootCount,
    ruleCount,
    conditionCount,
    actionCount,
  };
}

/**
 * Validates a candidate template structure against graph integrity rules.
 */
export function validateTemplate(template: unknown): {
  ok: boolean;
  error?: string;
  template?: ComplianceTemplate;
} {
  if (!template || typeof template !== 'object') {
    return { ok: false, error: 'Template payload must be a non-null object.' };
  }

  const t = template as Partial<ComplianceTemplate>;
  if (!t.id || typeof t.id !== 'string') {
    return { ok: false, error: 'Template must contain a non-empty string identifier (id).' };
  }
  if (!t.title || typeof t.title !== 'string') {
    return { ok: false, error: 'Template must contain a non-empty title.' };
  }
  if (!Array.isArray(t.nodes)) {
    return { ok: false, error: 'Template nodes must be an array.' };
  }
  if (!Array.isArray(t.edges)) {
    return { ok: false, error: 'Template edges must be an array.' };
  }

  // Check node IDs uniqueness
  const nodeIds = new Set<string>();
  let rootCount = 0;
  for (const n of t.nodes) {
    if (!n.id || typeof n.id !== 'string') {
      return { ok: false, error: 'All template nodes must have string identifiers.' };
    }
    if (nodeIds.has(n.id)) {
      return { ok: false, error: `Duplicate node ID detected in template: ${n.id}` };
    }
    nodeIds.add(n.id);
    if (n.type === 'root') rootCount++;
  }

  // If template has nodes, it must have at most 1 root
  if (t.nodes.length > 0 && rootCount > 1) {
    return { ok: false, error: `Template contains ${rootCount} root nodes; at most 1 is permitted.` };
  }

  // Validate edges
  const targetParentCounts = new Map<string, number>();
  for (const e of t.edges) {
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) {
      return { ok: false, error: `Template edge references non-existent node: ${e.source} -> ${e.target}` };
    }
    const sourceNode = t.nodes.find((n) => n.id === e.source);
    const targetNode = t.nodes.find((n) => n.id === e.target);
    if (!sourceNode || !targetNode) {
      return { ok: false, error: 'Edge endpoints missing from template.' };
    }
    if (!isValidParentChildRelationship(sourceNode.type, targetNode.type)) {
      return {
        ok: false,
        error: `Invalid relationship grammar in template: ${sourceNode.type} -> ${targetNode.type}`,
      };
    }
    // Single parent check
    const currentCount = targetParentCounts.get(e.target) ?? 0;
    if (currentCount >= 1) {
      return { ok: false, error: `Target node ${e.target} has multiple parents in template.` };
    }
    targetParentCounts.set(e.target, currentCount + 1);
  }

  // Cycle check
  if (hasAnyCycle(t.edges)) {
    return { ok: false, error: 'Cyclic loop detected in template edges.' };
  }

  const stats = calculateTemplateStats(t.nodes, t.edges);

  return {
    ok: true,
    template: {
      id: t.id,
      title: t.title,
      category: t.category ?? 'General Compliance',
      description: t.description ?? '',
      disclaimer: t.disclaimer ?? SAMPLE_COMPLIANCE_TEMPLATE_LABEL,
      badge: t.badge ?? 'Template',
      nodes: t.nodes,
      edges: t.edges,
      stats,
    },
  };
}

/**
 * 1. Full Multi-Branch Compliance Framework Template (Canonical)
 */
function buildFullFrameworkTemplate(): ComplianceTemplate {
  const nodes = getCanonicalSampleNodes();
  const edges = getCanonicalSampleEdges();
  return {
    id: 'full-compliance-framework',
    title: 'Comprehensive Compliance Framework',
    category: 'Enterprise Governance',
    description:
      'Complete multi-branch hierarchy covering public communications (FINRA-2210), electronic books & records retention (SEC-17a-4), and promotional risk disclosures (DISC-09).',
    disclaimer: 'Sample Compliance Template — Mock Non-Regulatory Demonstration',
    badge: 'Comprehensive (10 Nodes)',
    nodes,
    edges,
    stats: calculateTemplateStats(nodes, edges),
  };
}

/**
 * 2. FINRA-2210 Communications Governance Template
 */
function buildFinraCommunicationsTemplate(): ComplianceTemplate {
  const nodes: TreeNode[] = [
    {
      id: 'root-comm-gov',
      type: 'root',
      position: { x: 400, y: 50 },
      data: {
        label: 'Communications Governance Policy',
        ruleId: 'GOV-COMM-01',
        description: 'Supervisory review and content compliance governance apex.',
        severity: 'info',
        status: 'active',
        parameters: { framework: 'FINRA Rule 2210 Focus' },
        metadata: { template: 'FINRA Communications', mockSample: true },
        collapsed: false,
      },
    },
    {
      id: 'rule-finra-public',
      type: 'rule',
      position: { x: 400, y: 190 },
      data: {
        label: 'FINRA-2210: Communications with the Public',
        ruleId: 'RULE-FINRA-2210',
        description: 'Governs all public communications, retail investor collateral, and digital marketing.',
        severity: 'high',
        status: 'active',
        parameters: { audience: 'Retail & Institutional', approvalWindowHours: 48 },
        metadata: { mockSample: true },
        collapsed: false,
      },
    },
    {
      id: 'cond-retail-size',
      type: 'condition',
      position: { x: 260, y: 350 },
      data: {
        label: 'Condition: Retail Audience >= 25',
        ruleId: 'COND-RETAIL-01',
        description: 'Evaluates whether communication reaches 25 or more retail prospects within a 30-day window.',
        severity: 'medium',
        status: 'active',
        parameters: { thresholdCount: 25, periodDays: 30 },
        metadata: { mockSample: true },
        collapsed: false,
      },
    },
    {
      id: 'act-principal-signoff',
      type: 'action',
      position: { x: 260, y: 510 },
      data: {
        label: 'Action: Registered Principal Sign-off',
        ruleId: 'ACT-PRINCIPAL-01',
        description: 'Route message draft to Series 24 Supervisory Principal for formal sign-off before distribution.',
        severity: 'high',
        status: 'active',
        parameters: { supervisorRole: 'Series 24', auditLogged: true },
        metadata: { mockSample: true },
        collapsed: false,
      },
    },
    {
      id: 'act-auto-archive',
      type: 'action',
      position: { x: 540, y: 350 },
      data: {
        label: 'Action: Retain Copy to Central Repository',
        ruleId: 'ACT-ARCHIVE-01',
        description: 'Directly dispatch finalized material to central compliance compliance repository.',
        severity: 'low',
        status: 'active',
        parameters: { retentionBucket: 'comm-archive-live', immediateIndex: true },
        metadata: { mockSample: true },
        collapsed: false,
      },
    },
  ];

  const edges: TreeEdge[] = [
    {
      id: 'edge-comm-root-rule',
      source: 'root-comm-gov',
      target: 'rule-finra-public',
      sourceHandle: 'source',
      targetHandle: 'target',
      type: 'smoothstep',
      data: { relationshipType: 'root-rule' },
    },
    {
      id: 'edge-comm-rule-cond',
      source: 'rule-finra-public',
      target: 'cond-retail-size',
      sourceHandle: 'source',
      targetHandle: 'target',
      type: 'smoothstep',
      data: { relationshipType: 'rule-condition' },
    },
    {
      id: 'edge-comm-cond-act',
      source: 'cond-retail-size',
      target: 'act-principal-signoff',
      sourceHandle: 'source',
      targetHandle: 'target',
      type: 'smoothstep',
      data: { relationshipType: 'condition-action' },
    },
    {
      id: 'edge-comm-rule-act',
      source: 'rule-finra-public',
      target: 'act-auto-archive',
      sourceHandle: 'source',
      targetHandle: 'target',
      type: 'smoothstep',
      data: { relationshipType: 'rule-action' },
    },
  ];

  return {
    id: 'finra-communications-governance',
    title: 'FINRA-2210 Communications Governance',
    category: 'Marketing & Distribution',
    description:
      'Structured approval pipeline for retail financial promotions, investor newsletters, and supervisory principal sign-off.',
    disclaimer: 'Sample Compliance Template — Mock Non-Regulatory Demonstration',
    badge: 'Communications (5 Nodes)',
    nodes,
    edges,
    stats: calculateTemplateStats(nodes, edges),
  };
}

/**
 * 3. SEC-17a-4 Electronic Books & Records Retention Template
 */
function buildSecRecordsRetentionTemplate(): ComplianceTemplate {
  const nodes: TreeNode[] = [
    {
      id: 'root-records-gov',
      type: 'root',
      position: { x: 420, y: 50 },
      data: {
        label: 'Books & Records Preservation Framework',
        ruleId: 'GOV-REC-01',
        description: 'Electronic records retention, immutable storage, and audit trail framework.',
        severity: 'info',
        status: 'active',
        parameters: { framework: 'SEC Rule 17a-4 Focus' },
        metadata: { template: 'SEC Records', mockSample: true },
        collapsed: false,
      },
    },
    {
      id: 'rule-sec-17a4',
      type: 'rule',
      position: { x: 420, y: 190 },
      data: {
        label: 'SEC-17a-4: Electronic Records Preservation',
        ruleId: 'RULE-SEC-17A4',
        description: 'Requires preservation of all broker-dealer electronic records in write-once-read-many (WORM) format.',
        severity: 'critical',
        status: 'active',
        parameters: { minimumRetentionYears: 6, wormRequired: true },
        metadata: { mockSample: true },
        collapsed: false,
      },
    },
    {
      id: 'cond-trade-data',
      type: 'condition',
      position: { x: 300, y: 350 },
      data: {
        label: 'Condition: Ledger & Order Data Present',
        ruleId: 'COND-TRADE-01',
        description: 'Tests if record contains securities orders, confirmations, or ledger entries.',
        severity: 'medium',
        status: 'active',
        parameters: { containsOrders: true, financialLedger: true },
        metadata: { mockSample: true },
        collapsed: false,
      },
    },
    {
      id: 'act-worm-vault',
      type: 'action',
      position: { x: 300, y: 510 },
      data: {
        label: 'Action: Commit to WORM Immutable Vault',
        ruleId: 'ACT-WORM-01',
        description: 'Lock document into tamper-proof, non-rewritable, non-erasable cloud archive with duplicate offsite copy.',
        severity: 'critical',
        status: 'active',
        parameters: { vaultBucket: 'sec-worm-storage-prod', lockYears: 6 },
        metadata: { mockSample: true },
        collapsed: false,
      },
    },
    {
      id: 'act-audit-ledger',
      type: 'action',
      position: { x: 560, y: 350 },
      data: {
        label: 'Action: Record Timestamp in Audit Index',
        ruleId: 'ACT-INDEX-01',
        description: 'Generate SHA-256 fingerprint and publish entry to auditor inspection index.',
        severity: 'high',
        status: 'active',
        parameters: { hashAlgorithm: 'SHA-256', auditorAccessible: true },
        metadata: { mockSample: true },
        collapsed: false,
      },
    },
  ];

  const edges: TreeEdge[] = [
    {
      id: 'edge-sec-root-rule',
      source: 'root-records-gov',
      target: 'rule-sec-17a4',
      sourceHandle: 'source',
      targetHandle: 'target',
      type: 'smoothstep',
      data: { relationshipType: 'root-rule' },
    },
    {
      id: 'edge-sec-rule-cond',
      source: 'rule-sec-17a4',
      target: 'cond-trade-data',
      sourceHandle: 'source',
      targetHandle: 'target',
      type: 'smoothstep',
      data: { relationshipType: 'rule-condition' },
    },
    {
      id: 'edge-sec-cond-act',
      source: 'cond-trade-data',
      target: 'act-worm-vault',
      sourceHandle: 'source',
      targetHandle: 'target',
      type: 'smoothstep',
      data: { relationshipType: 'condition-action' },
    },
    {
      id: 'edge-sec-rule-act',
      source: 'rule-sec-17a4',
      target: 'act-audit-ledger',
      sourceHandle: 'source',
      targetHandle: 'target',
      type: 'smoothstep',
      data: { relationshipType: 'rule-action' },
    },
  ];

  return {
    id: 'sec-records-retention',
    title: 'SEC-17a-4 Electronic Records Preservation',
    category: 'Books & Records',
    description:
      'Standardized WORM storage, duplicate offsite archiving, and tamper-evident audit index pipeline for brokerage records.',
    disclaimer: 'Sample Compliance Template — Mock Non-Regulatory Demonstration',
    badge: 'Records Retention (5 Nodes)',
    nodes,
    edges,
    stats: calculateTemplateStats(nodes, edges),
  };
}

/**
 * 4. Minimal Starter Policy Template (1 of each node type)
 */
function buildMinimalStarterTemplate(): ComplianceTemplate {
  const nodes: TreeNode[] = [
    {
      id: 'root-starter',
      type: 'root',
      position: { x: 380, y: 60 },
      data: {
        label: 'Organization Policy Apex',
        ruleId: 'ORG-ROOT-01',
        description: 'Root anchor for organizational policy decisions.',
        severity: 'info',
        status: 'active',
        parameters: {},
        metadata: { template: 'Minimal Starter', mockSample: true },
        collapsed: false,
      },
    },
    {
      id: 'rule-starter',
      type: 'rule',
      position: { x: 380, y: 200 },
      data: {
        label: 'Policy Standard Rule',
        ruleId: 'RULE-STD-01',
        description: 'Standard regulatory obligation or policy gate.',
        severity: 'medium',
        status: 'draft',
        parameters: {},
        metadata: { mockSample: true },
        collapsed: false,
      },
    },
    {
      id: 'cond-starter',
      type: 'condition',
      position: { x: 380, y: 350 },
      data: {
        label: 'Evaluation Condition',
        ruleId: 'COND-EVAL-01',
        description: 'Decision parameter or threshold test.',
        severity: 'medium',
        status: 'draft',
        parameters: {},
        metadata: { mockSample: true },
        collapsed: false,
      },
    },
    {
      id: 'act-starter',
      type: 'action',
      position: { x: 380, y: 500 },
      data: {
        label: 'Remediation / Enforcement Action',
        ruleId: 'ACT-EXEC-01',
        description: 'Final execution or enforcement action dispatch.',
        severity: 'high',
        status: 'draft',
        parameters: {},
        metadata: { mockSample: true },
        collapsed: false,
      },
    },
  ];

  const edges: TreeEdge[] = [
    {
      id: 'edge-starter-root-rule',
      source: 'root-starter',
      target: 'rule-starter',
      sourceHandle: 'source',
      targetHandle: 'target',
      type: 'smoothstep',
      data: { relationshipType: 'root-rule' },
    },
    {
      id: 'edge-starter-rule-cond',
      source: 'rule-starter',
      target: 'cond-starter',
      sourceHandle: 'source',
      targetHandle: 'target',
      type: 'smoothstep',
      data: { relationshipType: 'rule-condition' },
    },
    {
      id: 'edge-starter-cond-act',
      source: 'cond-starter',
      target: 'act-starter',
      sourceHandle: 'source',
      targetHandle: 'target',
      type: 'smoothstep',
      data: { relationshipType: 'condition-action' },
    },
  ];

  return {
    id: 'minimal-starter-policy',
    title: 'Minimal Starter Policy',
    category: 'Starter Templates',
    description:
      'A lean 4-node starter chain (Root → Rule → Condition → Action) ready for rapid customization and branch expansion.',
    disclaimer: 'Sample Compliance Template — Mock Non-Regulatory Demonstration',
    badge: 'Starter Chain (4 Nodes)',
    nodes,
    edges,
    stats: calculateTemplateStats(nodes, edges),
  };
}

/**
 * 5. Blank Canvas Template
 */
function buildBlankCanvasTemplate(): ComplianceTemplate {
  return {
    id: 'blank-canvas',
    title: 'Blank Canvas',
    category: 'Starter Templates',
    description: 'Empty workspace with 0 nodes and 0 connections, ready for building a bespoke hierarchy from the palette.',
    disclaimer: 'Clean Workspace',
    badge: 'Empty (0 Nodes)',
    nodes: [],
    edges: [],
    stats: {
      nodeCount: 0,
      edgeCount: 0,
      rootCount: 0,
      ruleCount: 0,
      conditionCount: 0,
      actionCount: 0,
    },
  };
}

/**
 * Returns the list of all available templates.
 */
export function getAvailableTemplates(): ComplianceTemplate[] {
  return [
    buildFullFrameworkTemplate(),
    buildFinraCommunicationsTemplate(),
    buildSecRecordsRetentionTemplate(),
    buildMinimalStarterTemplate(),
    buildBlankCanvasTemplate(),
  ];
}

/**
 * Finds a template by ID.
 */
export function getTemplateById(id: string): ComplianceTemplate | undefined {
  const all = getAvailableTemplates();
  return all.find((t) => t.id === id);
}
