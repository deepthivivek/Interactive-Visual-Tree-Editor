'use client';

import React from 'react';
import { MousePointerClick } from 'lucide-react';
import { TreeCanvas } from './TreeCanvas';

export const TreeCanvasArea: React.FC = () => {
  return (
    <main className="flex-1 bg-slate-50/70 relative flex flex-col min-w-0 h-full overflow-hidden">
      {/* Workspace Header */}
      <div className="h-11 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between text-xs shrink-0 z-10">
        <div className="flex items-center gap-2.5">
          <span className="font-semibold text-slate-800">Tree Editor</span>
          <span className="text-slate-300">/</span>
          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
            Sample Compliance Template
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <MousePointerClick className="w-3.5 h-3.5 text-blue-500" />
          <span className="hidden sm:inline">Click node to inspect • Drag canvas to pan</span>
        </div>
      </div>

      {/* Dominant Central Workspace hosting React Flow Canvas */}
      <div className="flex-1 relative min-h-0 w-full overflow-hidden">
        <TreeCanvas />
      </div>
    </main>
  );
};
