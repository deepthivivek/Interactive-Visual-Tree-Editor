'use client';

import React from 'react';
import { FolderTree, ShieldAlert, HelpCircle, Zap, Info, GripVertical } from 'lucide-react';
import { Badge } from '../ui/badge';
import type { NodeType } from '../../types/tree';

interface PaletteItemDefinition {
  type: NodeType;
  title: string;
  description: string;
  badgeLabel: string;
  icon: React.ReactNode;
}

const PALETTE_ITEMS: PaletteItemDefinition[] = [
  {
    type: 'root',
    title: 'Root Node',
    description: 'Framework apex policy hierarchy',
    badgeLabel: 'ROOT',
    icon: <FolderTree className="w-4 h-4 text-purple-600" />,
  },
  {
    type: 'rule',
    title: 'Rule Node',
    description: 'Regulatory mandate or policy standard',
    badgeLabel: 'RULE',
    icon: <ShieldAlert className="w-4 h-4 text-blue-600" />,
  },
  {
    type: 'condition',
    title: 'Condition Node',
    description: 'Logical evaluation criteria gate',
    badgeLabel: 'COND',
    icon: <HelpCircle className="w-4 h-4 text-amber-600" />,
  },
  {
    type: 'action',
    title: 'Action Node',
    description: 'Compliance enforcement or routing task',
    badgeLabel: 'ACT',
    icon: <Zap className="w-4 h-4 text-emerald-600" />,
  },
];

export const NodePaletteSidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 select-none overflow-y-auto">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Node Palette
          </h2>
          <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
            Static
          </span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          Component library specification
        </p>
      </div>

      {/* Palette Item List (Static Placeholders for Day 1) */}
      <div className="p-3 space-y-2.5 flex-1">
        <div className="text-[11px] font-medium text-slate-400 px-1 uppercase tracking-wider">
          Available Node Types
        </div>

        {PALETTE_ITEMS.map((item) => (
          <div
            key={item.type}
            className="group relative bg-white border border-slate-200/80 rounded-lg p-3 shadow-2xs hover:border-slate-300 transition cursor-default"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-slate-50 border border-slate-100 group-hover:bg-slate-100 transition">
                  {item.icon}
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-800">
                    {item.title}
                  </div>
                  <div className="text-[11px] text-slate-400 leading-tight mt-0.5">
                    {item.description}
                  </div>
                </div>
              </div>
              <Badge type={item.type} className="text-[10px] px-1.5 py-0 shrink-0">
                {item.badgeLabel}
              </Badge>
            </div>

            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
              <span className="flex items-center gap-1 text-slate-400">
                <GripVertical className="w-3 h-3 text-slate-300" />
                Drag & Drop
              </span>
              <span className="font-mono text-slate-400">Day 3</span>
            </div>
          </div>
        ))}
      </div>

      {/* Reserved Future Status Footer */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50 m-3 rounded-lg border border-slate-200/60">
        <div className="flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-[11px] text-slate-500 leading-relaxed">
            <span className="font-medium text-slate-700">Architecture Notice:</span> Canvas drag-and-drop will be activated during the interactive node creation milestone.
          </div>
        </div>
      </div>
    </aside>
  );
};
