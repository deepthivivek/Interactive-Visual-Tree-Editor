import type { NodeType, NodeStatus } from '../types/tree';

/**
 * Stable, serializable icon identifiers for node presentation.
 * Note: Actual React / Lucide component instances are deliberately NOT stored here
 * to keep this configuration serializable, framework-independent, and reusable.
 */
export type NodeIconId = 'root' | 'rule' | 'condition' | 'action' | 'unknown';

/**
 * Color palette definition for a node type.
 * Hex values ensure full compatibility with future MiniMap, SVG/canvas exports,
 * and external styling systems.
 */
export interface NodeTypeColors {
  primary: string;
  background: string;
  border: string;
  text: string;
  accent: string;
}

/**
 * Complete, static Tailwind CSS utility class mappings.
 * All class names are full static strings to guarantee proper detection by Tailwind compiler.
 */
export interface NodeTypeStyling {
  cardBorder: string;
  cardBorderHover: string;
  cardBorderSelected: string;
  cardRingSelected: string;
  headerBg: string;
  iconBg: string;
  iconText: string;
  iconBorder: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  accentBar: string;
  accentText: string;
}

/**
 * Shared presentation metadata contract for each node type.
 * Framework-independent single source of truth for CustomNode, Inspector, MiniMap, and Palette.
 */
export interface NodeTypeConfig {
  type: NodeType | 'unknown';
  displayLabel: string;
  badgeLabel: string;
  iconId: NodeIconId;
  description: string;
  colors: NodeTypeColors;
  styling: NodeTypeStyling;
}

/**
 * Static registry of supported node type configurations.
 */
export const NODE_TYPE_CONFIGS: Record<NodeType, NodeTypeConfig> = {
  root: {
    type: 'root',
    displayLabel: 'Root Node',
    badgeLabel: 'ROOT',
    iconId: 'root',
    description: 'Top-level hierarchy anchor for governance frameworks and decision trees.',
    colors: {
      primary: '#2563eb', // blue-600
      background: '#eff6ff', // blue-50
      border: '#93c5fd', // blue-300
      text: '#1e40af', // blue-800
      accent: '#3b82f6', // blue-500
    },
    styling: {
      cardBorder: 'border-slate-300',
      cardBorderHover: 'hover:border-blue-400',
      cardBorderSelected: 'border-blue-600',
      cardRingSelected: 'ring-2 ring-blue-500/25',
      headerBg: 'bg-blue-50/60',
      iconBg: 'bg-blue-50',
      iconText: 'text-blue-700',
      iconBorder: 'border-blue-200',
      badgeBg: 'bg-blue-50',
      badgeText: 'text-blue-700',
      badgeBorder: 'border-blue-200',
      accentBar: 'bg-blue-600',
      accentText: 'text-blue-600',
    },
  },

  rule: {
    type: 'rule',
    displayLabel: 'Rule',
    badgeLabel: 'RULE',
    iconId: 'rule',
    description: 'Standard, regulation, policy requirement, or business guideline.',
    colors: {
      primary: '#4f46e5', // indigo-600
      background: '#eef2ff', // indigo-50
      border: '#a5b4fc', // indigo-300
      text: '#3730a3', // indigo-800
      accent: '#6366f1', // indigo-500
    },
    styling: {
      cardBorder: 'border-slate-300',
      cardBorderHover: 'hover:border-indigo-400',
      cardBorderSelected: 'border-indigo-600',
      cardRingSelected: 'ring-2 ring-indigo-500/25',
      headerBg: 'bg-indigo-50/60',
      iconBg: 'bg-indigo-50',
      iconText: 'text-indigo-700',
      iconBorder: 'border-indigo-200',
      badgeBg: 'bg-indigo-50',
      badgeText: 'text-indigo-700',
      badgeBorder: 'border-indigo-200',
      accentBar: 'bg-indigo-600',
      accentText: 'text-indigo-600',
    },
  },

  condition: {
    type: 'condition',
    displayLabel: 'Condition',
    badgeLabel: 'CONDITION',
    iconId: 'condition',
    description: 'Evaluative criteria, threshold check, or prerequisite expression.',
    colors: {
      primary: '#d97706', // amber-600
      background: '#fffbeb', // amber-50
      border: '#fde68a', // amber-200
      text: '#92400e', // amber-800
      accent: '#f59e0b', // amber-500
    },
    styling: {
      cardBorder: 'border-slate-300',
      cardBorderHover: 'hover:border-amber-400',
      cardBorderSelected: 'border-amber-600',
      cardRingSelected: 'ring-2 ring-amber-500/25',
      headerBg: 'bg-amber-50/60',
      iconBg: 'bg-amber-50',
      iconText: 'text-amber-700',
      iconBorder: 'border-amber-200',
      badgeBg: 'bg-amber-50',
      badgeText: 'text-amber-800',
      badgeBorder: 'border-amber-200',
      accentBar: 'bg-amber-500',
      accentText: 'text-amber-600',
    },
  },

  action: {
    type: 'action',
    displayLabel: 'Action',
    badgeLabel: 'ACTION',
    iconId: 'action',
    description: 'Automated remediation, review routing, archiving task, or notification.',
    colors: {
      primary: '#059669', // emerald-600
      background: '#ecfdf5', // emerald-50
      border: '#a7f3d0', // emerald-200
      text: '#065f46', // emerald-800
      accent: '#10b981', // emerald-500
    },
    styling: {
      cardBorder: 'border-slate-300',
      cardBorderHover: 'hover:border-emerald-400',
      cardBorderSelected: 'border-emerald-600',
      cardRingSelected: 'ring-2 ring-emerald-500/25',
      headerBg: 'bg-emerald-50/60',
      iconBg: 'bg-emerald-50',
      iconText: 'text-emerald-700',
      iconBorder: 'border-emerald-200',
      badgeBg: 'bg-emerald-50',
      badgeText: 'text-emerald-800',
      badgeBorder: 'border-emerald-200',
      accentBar: 'bg-emerald-600',
      accentText: 'text-emerald-600',
    },
  },
};

/**
 * Safe, neutral fallback configuration used when encountering an unknown or missing node type.
 * Prevents runtime crashes and guarantees deterministic defensive rendering.
 */
export const UNKNOWN_NODE_TYPE_CONFIG: NodeTypeConfig = {
  type: 'unknown',
  displayLabel: 'Unknown Node',
  badgeLabel: 'UNKNOWN',
  iconId: 'unknown',
  description: 'Unrecognized node type fallback.',
  colors: {
    primary: '#64748b', // slate-500
    background: '#f8fafc', // slate-50
    border: '#cbd5e1', // slate-300
    text: '#334155', // slate-700
    accent: '#94a3b8', // slate-400
  },
  styling: {
    cardBorder: 'border-slate-300',
    cardBorderHover: 'hover:border-slate-400',
    cardBorderSelected: 'border-slate-600',
    cardRingSelected: 'ring-2 ring-slate-400/25',
    headerBg: 'bg-slate-50',
    iconBg: 'bg-slate-100',
    iconText: 'text-slate-600',
    iconBorder: 'border-slate-200',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    badgeBorder: 'border-slate-200',
    accentBar: 'bg-slate-400',
    accentText: 'text-slate-500',
  },
};

/**
 * Pure, deterministic resolver for node type configuration.
 * Safe for any arbitrary string or null/undefined input.
 *
 * @param type - The node type identifier
 * @returns The corresponding NodeTypeConfig or the safe UNKNOWN_NODE_TYPE_CONFIG fallback
 */
export function getNodeTypeConfig(type?: string | null): NodeTypeConfig {
  if (!type || typeof type !== 'string') {
    return UNKNOWN_NODE_TYPE_CONFIG;
  }

  const normalized = type.toLowerCase().trim();
  if (normalized in NODE_TYPE_CONFIGS) {
    return NODE_TYPE_CONFIGS[normalized as NodeType];
  }

  return UNKNOWN_NODE_TYPE_CONFIG;
}

/**
 * Status presentation contract for node status indicators.
 */
export interface NodeStatusConfig {
  status: NodeStatus | 'unknown';
  label: string;
  dotColor: string;
  textColor: string;
  badgeBg: string;
  badgeBorder: string;
  hex: string;
}

export const NODE_STATUS_CONFIGS: Record<NodeStatus, NodeStatusConfig> = {
  active: {
    status: 'active',
    label: 'Active',
    dotColor: 'bg-emerald-500',
    textColor: 'text-emerald-700',
    badgeBg: 'bg-emerald-50',
    badgeBorder: 'border-emerald-200',
    hex: '#10b981',
  },
  in_review: {
    status: 'in_review',
    label: 'In Review',
    dotColor: 'bg-amber-500',
    textColor: 'text-amber-700',
    badgeBg: 'bg-amber-50',
    badgeBorder: 'border-amber-200',
    hex: '#f59e0b',
  },
  draft: {
    status: 'draft',
    label: 'Draft',
    dotColor: 'bg-slate-400',
    textColor: 'text-slate-600',
    badgeBg: 'bg-slate-100',
    badgeBorder: 'border-slate-200',
    hex: '#94a3b8',
  },
  deprecated: {
    status: 'deprecated',
    label: 'Deprecated',
    dotColor: 'bg-rose-500',
    textColor: 'text-rose-700',
    badgeBg: 'bg-rose-50',
    badgeBorder: 'border-rose-200',
    hex: '#f43f5e',
  },
};

export const UNKNOWN_NODE_STATUS_CONFIG: NodeStatusConfig = {
  status: 'unknown',
  label: 'Unknown',
  dotColor: 'bg-slate-300',
  textColor: 'text-slate-500',
  badgeBg: 'bg-slate-50',
  badgeBorder: 'border-slate-200',
  hex: '#cbd5e1',
};

/**
 * Pure resolver for node lifecycle status presentation.
 *
 * @param status - The node status identifier
 * @returns The corresponding NodeStatusConfig or safe neutral fallback
 */
export function getNodeStatusConfig(status?: string | null): NodeStatusConfig {
  if (!status || typeof status !== 'string') {
    return UNKNOWN_NODE_STATUS_CONFIG;
  }

  const normalized = status.toLowerCase().trim();
  if (normalized in NODE_STATUS_CONFIGS) {
    return NODE_STATUS_CONFIGS[normalized as NodeStatus];
  }

  return UNKNOWN_NODE_STATUS_CONFIG;
}
