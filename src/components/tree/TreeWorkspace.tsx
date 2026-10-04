'use client';

import React, { useState } from 'react';
import { TreeHeader } from './TreeHeader';
import { NodePaletteSidebar } from './NodePaletteSidebar';
import { TreeCanvasArea } from './TreeCanvasArea';
import { PropertiesInspectorSidebar } from './PropertiesInspectorSidebar';
import { PanelLeft, PanelRight } from 'lucide-react';

export const TreeWorkspace: React.FC = () => {
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white text-slate-900 font-sans">
      {/* 1. TOP APPLICATION HEADER */}
      <TreeHeader />

      {/* Mobile Toolbar Toggle Bar (Only visible on small screens < lg) */}
      <div className="lg:hidden h-9 bg-slate-50 border-b border-slate-200 px-4 flex items-center justify-between text-xs text-slate-600 shrink-0">
        <button
          onClick={() => {
            setMobilePaletteOpen(!mobilePaletteOpen);
            setMobileInspectorOpen(false);
          }}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-white border border-slate-200 text-xs font-medium text-slate-700 shadow-2xs"
        >
          <PanelLeft className="w-3.5 h-3.5 text-slate-500" />
          <span>{mobilePaletteOpen ? 'Close Palette' : 'Node Palette'}</span>
        </button>

        <span className="text-[11px] text-slate-400">Canvas Active</span>

        <button
          onClick={() => {
            setMobileInspectorOpen(!mobileInspectorOpen);
            setMobilePaletteOpen(false);
          }}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-white border border-slate-200 text-xs font-medium text-slate-700 shadow-2xs"
        >
          <PanelRight className="w-3.5 h-3.5 text-slate-500" />
          <span>{mobileInspectorOpen ? 'Close Inspector' : 'Inspector'}</span>
        </button>
      </div>

      {/* 2. THREE-ZONE PRIMARY WORKSPACE */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* ZONE 1: LEFT SIDEBAR (Node Palette) */}
        <div className={`hidden lg:flex shrink-0`}>
          <NodePaletteSidebar />
        </div>
        {mobilePaletteOpen && (
          <div className="lg:hidden absolute inset-y-0 left-0 z-30 shadow-xl flex bg-white">
            <NodePaletteSidebar />
          </div>
        )}

        {/* ZONE 2: CENTER (Main Tree Canvas) */}
        <TreeCanvasArea />

        {/* ZONE 3: RIGHT SIDEBAR (Properties Inspector) */}
        <div className={`hidden lg:flex shrink-0`}>
          <PropertiesInspectorSidebar />
        </div>
        {mobileInspectorOpen && (
          <div className="lg:hidden absolute inset-y-0 right-0 z-30 shadow-xl flex bg-white">
            <PropertiesInspectorSidebar />
          </div>
        )}
      </div>
    </div>
  );
};
