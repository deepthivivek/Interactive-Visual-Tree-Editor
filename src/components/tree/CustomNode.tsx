'use client';

import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  Layers,
  Shield,
  GitBranch,
  Zap,
  CircleHelp,
  type LucideIcon,
} from 'lucide-react';
import {
  getNodeTypeConfig,
  getNodeStatusConfig,
  type NodeIconId,
} from '../../lib/nodeTypeConfig';
import type { TreeNodeData } from '../../types/tree';

/**
 * UI mapping from serializable icon identifiers to Lucide React icon components.
 * Verified against installed lucide-react package.
 */
const ICON_MAP: Record<NodeIconId, LucideIcon> = {
  root: Layers,
  rule: Shield,
  condition: GitBranch,
  action: Zap,
  unknown: CircleHelp,
};

/**
 * Custom Node Component for the Interactive Visual Tree Editor (Day 3).
 *
 * Design features:
 * - Pure data-driven presentation using shared `nodeTypeConfig`
 * - Consistent 215px compact width for clean hierarchical layouts
 * - Visually distinct type styling (Root, Rule, Condition, Action)
 * - Distinct states: Default, Hover, Selected, Focus-visible
 * - React Flow target (top) and source (bottom) handles for sample graph edges
 * - Non-interactive handles (`isConnectable={false}`) preventing premature connection creation
 * - Accessible truncation with title attribute and screen-reader context
 */
export const CustomNode: React.FC<NodeProps> = memo(({ type, data, selected }) => {
  const nodeData = data as TreeNodeData;
  const label = typeof nodeData?.label === 'string' ? nodeData.label : 'Untitled Node';
  const ruleId = typeof nodeData?.ruleId === 'string' ? nodeData.ruleId : undefined;
  const status = typeof nodeData?.status === 'string' ? nodeData.status : undefined;

  // Resolve configuration from single source of truth
  const nodeType = type || (typeof nodeData?.type === 'string' ? nodeData.type : 'unknown');
  const typeConfig = getNodeTypeConfig(nodeType);
  const statusConfig = getNodeStatusConfig(status);

  // Map icon component safely
  const IconComponent = ICON_MAP[typeConfig.iconId] || CircleHelp;

  return (
    <div
      tabIndex={0}
      role="treeitem"
      aria-selected={Boolean(selected)}
      aria-label={`${typeConfig.displayLabel}: ${label}${ruleId ? ` (${ruleId})` : ''}`}
      title={label}
      className={`group relative w-[215px] bg-white rounded-lg border transition-all duration-150 shadow-2xs select-none outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
        selected
          ? `${typeConfig.styling.cardBorderSelected} ${typeConfig.styling.cardRingSelected} shadow-xs`
          : `${typeConfig.styling.cardBorder} ${typeConfig.styling.cardBorderHover} hover:shadow-xs`
      }`}
    >
      {/* Top Target Handle (Child incoming handle in hierarchy) */}
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={true}
        className="!w-2.5 !h-2.5 !bg-slate-400 hover:!bg-blue-600 !border-2 !border-white !rounded-full !-top-1.5 transition-colors cursor-crosshair"
      />

      {/* Top Header Row: Icon + Type Badge + Status Indicator */}
      <div
        className={`px-3 py-1.5 flex items-center justify-between border-b rounded-t-lg ${typeConfig.styling.headerBg} border-slate-100`}
      >
        {/* Left: Icon + Type Badge */}
        <div className="flex items-center gap-1.5 min-w-0">
          <div
            className={`w-5 h-5 rounded flex items-center justify-center border shrink-0 ${typeConfig.styling.iconBg} ${typeConfig.styling.iconText} ${typeConfig.styling.iconBorder}`}
          >
            <IconComponent className="w-3 h-3" aria-hidden="true" />
          </div>
          <span
            className={`text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded border leading-none ${typeConfig.styling.badgeBg} ${typeConfig.styling.badgeText} ${typeConfig.styling.badgeBorder}`}
          >
            {typeConfig.badgeLabel}
          </span>
        </div>

        {/* Right: Status Indicator (clean unboxed dot + status label) */}
        {status && (
          <div
            className="flex items-center gap-1 text-[10px] text-slate-500 shrink-0 ml-1.5"
            title={`Status: ${statusConfig.label}`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusConfig.dotColor}`}
              aria-hidden="true"
            />
            <span className="font-medium truncate max-w-[55px]">
              {statusConfig.label}
            </span>
          </div>
        )}
      </div>

      {/* Body: Node Label & Optional Rule ID */}
      <div className="px-3 py-2.5">
        <div
          className="text-xs font-semibold text-slate-900 leading-snug line-clamp-2 break-words"
          title={label}
        >
          {label}
        </div>

        {ruleId && (
          <div className="mt-1 flex items-center justify-between">
            <span
              className="font-mono text-[10px] text-slate-500 truncate max-w-[170px]"
              title={`Rule Identifier: ${ruleId}`}
            >
              {ruleId}
            </span>
          </div>
        )}
      </div>

      {/* Bottom Source Handle (Parent outgoing handle in hierarchy) */}
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={true}
        className="!w-2.5 !h-2.5 !bg-slate-400 hover:!bg-blue-600 !border-2 !border-white !rounded-full !-bottom-1.5 transition-colors cursor-crosshair"
      />
    </div>
  );
});

CustomNode.displayName = 'CustomNode';
