'use client';

import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  Layers,
  Shield,
  GitBranch,
  Zap,
  CircleHelp,
  ChevronDown,
  ChevronUp,
  type LucideIcon,
} from 'lucide-react';
import {
  getNodeTypeConfig,
  getNodeStatusConfig,
  type NodeIconId,
} from '../../lib/nodeTypeConfig';
import type { TreeNodeData } from '../../types/tree';
import { useTreeStore } from '../../store/treeStore';
import { getDescendantCount, getSubtreeNodeIds } from '../../lib/subtree';

const ICON_MAP: Record<NodeIconId, LucideIcon> = {
  root: Layers,
  rule: Shield,
  condition: GitBranch,
  action: Zap,
  unknown: CircleHelp,
};

/**
 * Custom Node Component for the Interactive Visual Tree Editor (Day 17 Refinement).
 *
 * Features:
 * - Data-driven presentation with centralized nodeTypeConfig
 * - High-contrast accessible typography and clear type distinction
 * - Subtle unboxed metadata indicators (parameter and tag counts)
 * - Distinct focus-visible and active selection states
 * - Reversible subtree collapse/expand with accessible ARIA tags
 */
export const CustomNode: React.FC<NodeProps> = memo(({ id, type, data, selected }) => {
  const nodeData = data as TreeNodeData;
  const label = typeof nodeData?.label === 'string' ? nodeData.label : 'Untitled Node';
  const ruleId = typeof nodeData?.ruleId === 'string' ? nodeData.ruleId : undefined;
  const status = typeof nodeData?.status === 'string' ? nodeData.status : undefined;

  const searchQuery = useTreeStore((state) => state.searchQuery);
  const isMatched = useTreeStore((state) => state.matchingNodeIds.has(id));
  const isFocusPulse = useTreeStore((state) => state.focusPulseNodeId === id);
  const hasMatches = useTreeStore((state) => state.matchingNodeIds.size > 0);
  const isDimmed = searchQuery.trim().length > 0 && hasMatches && !isMatched;

  const descendantCount = useTreeStore((state) => getDescendantCount(id, state.edges));
  const hasChildren = useTreeStore((state) => state.edges.some((e) => e.source === id));
  const toggleNodeCollapse = useTreeStore((state) => state.toggleNodeCollapse);
  const isCollapsed = Boolean(nodeData?.collapsed);

  const nodeType = type || (typeof nodeData?.type === 'string' ? nodeData.type : 'unknown');
  const typeConfig = getNodeTypeConfig(nodeType);
  const statusConfig = getNodeStatusConfig(status);

  const IconComponent = ICON_MAP[typeConfig.iconId] || CircleHelp;

  const selectedSubtreeRootId = useTreeStore((state) => state.selectedSubtreeRootId);
  const edges = useTreeStore((state) => state.edges);
  const isSubtreeSelected = React.useMemo(() => {
    if (!selectedSubtreeRootId) return false;
    return getSubtreeNodeIds(selectedSubtreeRootId, edges).has(id);
  }, [selectedSubtreeRootId, edges, id]);

  const selectedNodeId = useTreeStore((state) => state.selectedNodeId);
  const selectedNodeIds = useTreeStore((state) => state.selectedNodeIds);
  const isMultiSelected = React.useMemo(() => {
    if (!selectedNodeIds) return false;
    const ids = selectedNodeIds as unknown;
    if (Array.isArray(ids)) return ids.includes(id);
    if (ids instanceof Set) return (ids as Set<string>).has(id);
    return false;
  }, [selectedNodeIds, id]);
  const isNodeSelected = selectedNodeId === id || isMultiSelected || Boolean(selected);

  let borderAndRingClass = `${typeConfig.styling.cardBorder} ${typeConfig.styling.cardBorderHover} hover:shadow-xs`;
  if (isFocusPulse) {
    borderAndRingClass = `border-blue-500 ring-4 ring-blue-400/80 shadow-md transition-all`;
  } else if (isNodeSelected) {
    borderAndRingClass = `border-blue-600 ring-2 ring-blue-500/80 shadow-md bg-blue-50/20 transition-all`;
  } else if (isSubtreeSelected) {
    borderAndRingClass = `border-indigo-500 ring-2 ring-indigo-400 shadow-md bg-indigo-50/25 transition-all`;
  } else if (isMatched) {
    borderAndRingClass = `border-blue-400 ring-2 ring-blue-300 shadow-xs`;
  }

  const dimClass = isDimmed ? 'opacity-50 transition-opacity' : '';

  const paramCount = nodeData?.parameters ? Object.keys(nodeData.parameters).length : 0;
  const tagCount = nodeData?.tags ? nodeData.tags.length : 0;

  return (
    <div
      tabIndex={0}
      role="treeitem"
      aria-selected={Boolean(isNodeSelected)}
      aria-label={`${typeConfig.displayLabel}: ${label}${ruleId ? ` (${ruleId})` : ''}`}
      title={label}
      className={`group relative w-[215px] bg-white rounded-lg border transition-all duration-150 shadow-2xs select-none outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${borderAndRingClass} ${dimClass}`}
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

      {/* Body: Node Label & Optional Rule ID & Metadata */}
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

        {/* Quiet unboxed metadata: parameters and tags summary */}
        {(paramCount > 0 || tagCount > 0) && (
          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-400 font-mono">
            {paramCount > 0 && <span>{paramCount} param{paramCount !== 1 ? 's' : ''}</span>}
            {paramCount > 0 && tagCount > 0 && <span aria-hidden="true">·</span>}
            {tagCount > 0 && <span>{tagCount} tag{tagCount !== 1 ? 's' : ''}</span>}
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

      {/* Subtree Collapse / Expand Badge */}
      {hasChildren && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleNodeCollapse(id);
          }}
          className={`absolute -bottom-3 left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-0.5 rounded-full text-[10px] font-bold shadow-xs transition-transform hover:scale-105 cursor-pointer select-none focus-visible:ring-2 focus-visible:ring-blue-500 outline-hidden ${
            isCollapsed
              ? 'px-2 py-0.5 bg-amber-500 text-white border border-amber-600'
              : 'opacity-0 group-hover:opacity-90 w-5 h-5 justify-center bg-slate-100 text-slate-600 border border-slate-300 hover:bg-white hover:text-slate-900'
          }`}
          title={
            isCollapsed
              ? `Subtree collapsed (${descendantCount} hidden descendant${descendantCount > 1 ? 's' : ''}). Click to expand.`
              : `Click to collapse subtree (${descendantCount} descendant${descendantCount > 1 ? 's' : ''})`
          }
          aria-expanded={!isCollapsed}
          aria-label={
            isCollapsed
              ? `Expand subtree of ${label}. ${descendantCount} hidden descendants.`
              : `Collapse subtree of ${label}`
          }
        >
          {isCollapsed ? (
            <>
              <ChevronDown className="w-2.5 h-2.5" />
              <span>+{descendantCount}</span>
            </>
          ) : (
            <ChevronUp className="w-3 h-3" />
          )}
        </button>
      )}
    </div>
  );
});

CustomNode.displayName = 'CustomNode';
