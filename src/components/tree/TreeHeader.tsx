'use client';

import React from 'react';
import { Network, RotateCcw, ShieldCheck, Download, CheckSquare } from 'lucide-react';
import { useTreeStore, SAMPLE_COMPLIANCE_TEMPLATE_LABEL } from '../../store/treeStore';

export const TreeHeader: React.FC = () => {
  const { nodes, edges, resetToSampleData } = useTreeStore();

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shrink-0 select-none shadow-xs z-20">
      {/* Brand & Title */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
          <Network className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-semibold text-slate-900 tracking-tight truncate">
              Interactive Visual Tree Editor
            </h1>
            <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
              {SAMPLE_COMPLIANCE_TEMPLATE_LABEL}
            </span>
          </div>
          <p className="text-xs text-slate-500 truncate">
            Build, manage and visualize compliance rule trees
          </p>
        </div>
      </div>

      {/* Toolbar / Actions */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Topology Stats */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>{nodes.length} Nodes</span>
          <span className="text-slate-300">•</span>
          <span>{edges.length} Edges</span>
        </div>

        {/* Reset Action */}
        <button
          onClick={() => resetToSampleData()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 transition shadow-xs cursor-pointer"
          title="Reset to initial sample template"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
          <span>Reset Sample</span>
        </button>

        {/* Future Toolbar Placeholders (Disabled / Day 1 Reserved) */}
        <div className="hidden sm:flex items-center gap-1.5 pl-2 border-l border-slate-200">
          <button
            disabled
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-400 bg-slate-50 border border-slate-200 rounded-md cursor-not-allowed opacity-60"
            title="Validation engine will be enabled on Day 13"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Validate</span>
          </button>
          <button
            disabled
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-400 bg-slate-50 border border-slate-200 rounded-md cursor-not-allowed opacity-60"
            title="JSON export will be enabled on JSON milestone"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Export</span>
          </button>
        </div>

        {/* Day 1 Status Indicator */}
        <div className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Day 1 Foundation</span>
        </div>
      </div>
    </header>
  );
};
