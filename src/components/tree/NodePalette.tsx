'use client';

import React from 'react';
import {
  Layers,
  Shield,
  GitBranch,
  Zap,
  GripVertical,
  type LucideIcon,
} from 'lucide-react';
import {
  getNodeTypeConfig,
  type NodeIconId,
} from '../../lib/nodeTypeConfig';
import type { NodeType } from '../../types/tree';

/**
 * UI mapping from serializable icon identifiers to Lucide React icon components.
 * Reuses the exact same iconography established in Day 3.
 */
const ICON_MAP: Record<NodeIconId, LucideIcon> = {
  root: Layers,
  rule: Shield,
  condition: GitBranch,
  action: Zap,
  unknown: Shield,
};

/**
 * Supported palette node types in presentation order.
 */
const PALETTE_TYPES: NodeType[] = ['root', 'rule', 'condition', 'action'];

interface NodePaletteProps {
  onDragStartNotification?: (message: string) => void;
  onDragEndNotification?: () => void;
}

/**
 * Node Palette component for creating new nodes via HTML5 drag-and-drop (Day 4).
 * Reuses shared `nodeTypeConfig` for labels, descriptions, badges, and colors.
 */
export const NodePalette: React.FC<NodePaletteProps> = ({
  onDragStartNotification,
  onDragEndNotification,
}) => {
  const handleDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    type: NodeType,
    displayLabel: string
  ) => {
    // Set standard React Flow drag payload
    event.dataTransfer.setData('application/reactflow', type);
    event.dataTransfer.effectAllowed = 'move';

    // Accessible feedback notification
    if (onDragStartNotification) {
      onDragStartNotification(
        `Dragging ${displayLabel}. Drop it on the canvas to create a ${displayLabel}.`
      );
    }
  };

  const handleDragEnd = () => {
    if (onDragEndNotification) {
      onDragEndNotification();
    }
  };

  return (
    <div className="space-y-2 select-none" role="region" aria-label="Node Creation Palette">
      {PALETTE_TYPES.map((type) => {
        const config = getNodeTypeConfig(type);
        const IconComponent = ICON_MAP[config.iconId] || Layers;

        return (
          <div
            key={type}
            draggable
            onDragStart={(e) => handleDragStart(e, type, config.displayLabel)}
            onDragEnd={handleDragEnd}
            role="button"
            tabIndex={0}
            aria-label={`Draggable ${config.displayLabel}: ${config.description}`}
            title={`Drag ${config.displayLabel} onto canvas`}
            className={`group relative bg-white border rounded-lg p-2.5 shadow-2xs hover:shadow-xs transition-all duration-150 cursor-grab active:cursor-grabbing outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 ${config.styling.cardBorder} ${config.styling.cardBorderHover}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {/* Drag Grip Affordance + Icon */}
                <div className="flex items-center gap-1 shrink-0">
                  <GripVertical
                    className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-colors"
                    aria-hidden="true"
                  />
                  <div
                    className={`w-6 h-6 rounded flex items-center justify-center border shrink-0 ${config.styling.iconBg} ${config.styling.iconText} ${config.styling.iconBorder}`}
                  >
                    <IconComponent className="w-3.5 h-3.5" aria-hidden="true" />
                  </div>
                </div>

                {/* Name & Concise Description */}
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-800 group-hover:text-slate-900 transition-colors truncate">
                    {config.displayLabel}
                  </div>
                  <div className="text-[10px] text-slate-400 group-hover:text-slate-500 transition-colors truncate leading-tight">
                    {config.description}
                  </div>
                </div>
              </div>

              {/* Type Badge */}
              <span
                className={`text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded border shrink-0 leading-none ${config.styling.badgeBg} ${config.styling.badgeText} ${config.styling.badgeBorder}`}
              >
                {config.badgeLabel}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
