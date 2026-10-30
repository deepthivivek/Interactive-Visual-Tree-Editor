'use client';

import React from 'react';
import {
  Home,
  FileSpreadsheet,
  Settings,
  Info,
} from 'lucide-react';
import { NodePalette } from './NodePalette';
import { useTreeStore } from '../../store/treeStore';

export const NodePaletteSidebar: React.FC = () => {
  const openTemplatesModal = useTreeStore((state) => state.openTemplatesModal);
  const openSettingsModal = useTreeStore((state) => state.openSettingsModal);
  const openComparisonModal = useTreeStore((state) => state.openComparisonModal);
  const openApprovalsModal = useTreeStore((state) => state.openApprovalsModal);
  const openSsoModal = useTreeStore((state) => state.openSsoModal);

  return (
    <aside className="nokey w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 select-none overflow-y-auto">
      {/* 1. PRIMARY APPLICATION NAVIGATION */}
      <div className="p-3 border-b border-slate-100 space-y-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2 py-1">
          Navigation
        </div>

        {/* Tree Editor (Currently Active) */}
        <button
          type="button"
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-semibold text-blue-700 bg-blue-50/80 border border-blue-100 shadow-2xs transition cursor-default"
          title="Tree Editor (Active Workspace)"
        >
          <Home className="w-4 h-4 text-blue-600" />
          <span>Tree Editor</span>
          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600" />
        </button>

        {/* Templates */}
        <button
          type="button"
          onClick={openTemplatesModal}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 border border-transparent hover:border-slate-200 transition cursor-pointer"
          title="Browse and apply compliance rule templates"
        >
          <FileSpreadsheet className="w-4 h-4 text-blue-600" />
          <span>Templates</span>
          <span className="ml-auto text-[10px] text-blue-600 bg-blue-50 border border-blue-100 px-1 py-0.2 rounded font-mono font-medium">
            Ready
          </span>
        </button>

        {/* Policy Comparison & Diff */}
        <button
          type="button"
          onClick={openComparisonModal}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 border border-transparent hover:border-slate-200 transition cursor-pointer"
          title="Compare active graph against baseline templates or checkpoints"
        >
          <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
          <span>Policy Comparison</span>
        </button>

        {/* Governance & Approvals */}
        <button
          type="button"
          onClick={openApprovalsModal}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 border border-transparent hover:border-slate-200 transition cursor-pointer"
          title="RBAC authorization and policy approval workflow"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          <span>Governance & Approvals</span>
        </button>

        {/* Enterprise SSO */}
        <button
          type="button"
          onClick={openSsoModal}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 border border-transparent hover:border-slate-200 transition cursor-pointer"
          title="Enterprise OIDC / SAML 2.0 Single Sign-On"
        >
          <FileSpreadsheet className="w-4 h-4 text-amber-600" />
          <span>Enterprise SSO</span>
        </button>

        {/* Settings */}
        <button
          type="button"
          onClick={openSettingsModal}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 border border-transparent hover:border-slate-200 transition cursor-pointer"
          title="Configure editor display, snap-to-grid, and persistence"
        >
          <Settings className="w-4 h-4 text-slate-600" />
          <span>Settings</span>
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
