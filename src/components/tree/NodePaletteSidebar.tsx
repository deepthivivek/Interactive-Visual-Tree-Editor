'use client';

import React from 'react';
import {
  Home,
  FileSpreadsheet,
  Settings,
  FolderTree,
  ShieldAlert,
  HelpCircle,
  Zap,
  Info,
} from 'lucide-react';
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
    title: 'Root',
    description: 'Framework root policy',
    badgeLabel: 'ROOT',
    icon: <FolderTree className="w-4 h-4 text-purple-600" />,
  },
  {
    type: 'rule',
    title: 'Rule',
    description: 'Regulatory mandate standard',
    badgeLabel: 'RULE',
    icon: <ShieldAlert className="w-4 h-4 text-blue-600" />,
  },
  {
    type: 'condition',
    title: 'Condition',
    description: 'Evaluation criteria gate',
    badgeLabel: 'COND',
    icon: <HelpCircle className="w-4 h-4 text-emerald-600" />,
  },
  {
    type: 'action',
    title: 'Action',
    description: 'Compliance routing task',
    badgeLabel: 'ACT',
    icon: <Zap className="w-4 h-4 text-orange-600" />,
  },
];

export const NodePaletteSidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 select-none overflow-y-auto">
      {/* 1. PRIMARY APPLICATION NAVIGATION */}
      <div className="p-3 border-b border-slate-100 space-y-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2 py-1">
          Navigation
        </div>

        {/* Tree Editor (Currently Active) */}
        <button
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-semibold text-blue-700 bg-blue-50/80 border border-blue-100 shadow-2xs transition"
          title="Tree Editor (Active Workspace)"
        >
          <Home className="w-4 h-4 text-blue-600" />
          <span>Tree Editor</span>
          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600" />
        </button>

        {/* Templates (Future Placeholder) */}
        <button
          disabled
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-400 hover:text-slate-500 cursor-not-allowed opacity-70 transition"
          title="Templates library scheduled for later milestone"
        >
          <FileSpreadsheet className="w-4 h-4 text-slate-400" />
          <span>Templates</span>
          <span className="ml-auto text-[10px] text-slate-400 bg-slate-100 px-1 py-0.2 rounded font-mono">
            Soon
          </span>
        </button>

        {/* Settings (Future Placeholder) */}
        <button
          disabled
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-400 hover:text-slate-500 cursor-not-allowed opacity-70 transition"
          title="Editor Settings scheduled for later milestone"
        >
          <Settings className="w-4 h-4 text-slate-400" />
          <span>Settings</span>
          <span className="ml-auto text-[10px] text-slate-400 bg-slate-100 px-1 py-0.2 rounded font-mono">
            Soon
          </span>
        </button>
      </div>

      {/* 2. NODE PALETTE (Visual Only for Day 1) */}
      <div className="p-3 space-y-2 flex-1">
        <div className="px-1 pt-1 pb-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Node Palette
          </div>
          <p className="text-[11px] text-slate-400">
            Add nodes
          </p>
        </div>

        <div className="space-y-2">
          {PALETTE_ITEMS.map((item) => (
            <div
              key={item.type}
              className="group relative bg-white border border-slate-200/80 rounded-lg p-2.5 shadow-2xs hover:border-slate-300 transition cursor-default"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 rounded-md bg-slate-50 border border-slate-100 group-hover:bg-slate-100 transition shrink-0">
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-800 truncate">
                      {item.title}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate leading-tight">
                      {item.description}
                    </div>
                  </div>
                </div>
                <Badge type={item.type} className="text-[9px] px-1.5 py-0 shrink-0">
                  {item.badgeLabel}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Info Notice */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50 m-3 rounded-lg border border-slate-200/60">
        <div className="flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-[11px] text-slate-500 leading-relaxed">
            <span className="font-medium text-slate-700">Day 1 Static Preview:</span> Node creation and drag-and-drop will be activated on Day 3.
          </div>
        </div>
      </div>
    </aside>
  );
};
