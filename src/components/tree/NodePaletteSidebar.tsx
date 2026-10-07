'use client';

import React from 'react';
import {
  Home,
  FileSpreadsheet,
  Settings,
  Info,
} from 'lucide-react';
import { NodePalette } from './NodePalette';

export const NodePaletteSidebar: React.FC = () => {
  return (
    <aside className="nokey w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 select-none overflow-y-auto">
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

      {/* 2. NODE PALETTE (Active Drag-and-Drop Creation) */}
      <div className="p-3 space-y-2 flex-1">
        <div className="px-1 pt-1 pb-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Node Palette
          </div>
          <p className="text-[11px] text-slate-400">
            Drag onto canvas to add
          </p>
        </div>

        <NodePalette />
      </div>

      {/* Footer Info Notice */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50 m-3 rounded-lg border border-slate-200/60">
        <div className="flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-[11px] text-slate-500 leading-relaxed">
            <span className="font-medium text-slate-700">Drag to Create:</span> Drag any node type onto the canvas. Created nodes are selected automatically.
          </div>
        </div>
      </div>
    </aside>
  );
};
