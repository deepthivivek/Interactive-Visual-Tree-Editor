'use client';

import React, { useSyncExternalStore } from 'react';
import {
  Network,
  RotateCcw,
  Search,
  CheckCircle2,
  FileCode,
  Sun,
  User,
  Undo2,
  Redo2,
} from 'lucide-react';
import { useTreeStore, SAMPLE_COMPLIANCE_TEMPLATE_LABEL } from '../../store/treeStore';
import { SearchBox } from './SearchBox';

export const TreeHeader: React.FC = () => {
  const { loadSampleTree, undo, redo } = useTreeStore();

  const pastCount = useSyncExternalStore(
    useTreeStore.temporal.subscribe,
    () => useTreeStore.temporal.getState().pastStates.length,
    () => 0
  );
  const futureCount = useSyncExternalStore(
    useTreeStore.temporal.subscribe,
    () => useTreeStore.temporal.getState().futureStates.length,
    () => 0
  );

  return (
    <header className="nokey h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shrink-0 select-none z-20">
      {/* Left: Application Logo, Title, Subtitle */}
      <div className="flex items-center gap-3.5 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
          <Network className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-sm sm:text-base font-semibold text-slate-900 tracking-tight truncate">
              Interactive Visual Tree Editor
            </h1>
            <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
              {SAMPLE_COMPLIANCE_TEMPLATE_LABEL}
            </span>
          </div>
          <p className="text-xs text-slate-500 truncate">
            Build, manage and visualize your compliance rule trees
          </p>
        </div>
      </div>

      {/* Right: Reserved Action Placeholders, Undo/Redo & Working Reset */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Undo Action (Day 8) */}
        <button
          type="button"
          disabled={pastCount === 0}
          onClick={() => undo()}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition shadow-2xs ${
            pastCount > 0
              ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 cursor-pointer'
              : 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed opacity-60'
          }`}
          title={
            pastCount > 0
              ? `Undo (${pastCount} action${pastCount > 1 ? 's' : ''} available) [Ctrl+Z / ⌘Z]`
              : 'Undo (No actions to undo) [Ctrl+Z / ⌘Z]'
          }
          aria-label={`Undo (${pastCount} actions available)`}
        >
          <Undo2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Undo</span>
          {pastCount > 0 && (
            <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1 rounded">
              {pastCount}
            </span>
          )}
        </button>

        {/* Redo Action (Day 8) */}
        <button
          type="button"
          disabled={futureCount === 0}
          onClick={() => redo()}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition shadow-2xs ${
            futureCount > 0
              ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 cursor-pointer'
              : 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed opacity-60'
          }`}
          title={
            futureCount > 0
              ? `Redo (${futureCount} action${futureCount > 1 ? 's' : ''} available) [Ctrl+Shift+Z / ⌘Shift+Z]`
              : 'Redo (No actions to redo) [Ctrl+Shift+Z / ⌘Shift+Z]'
          }
          aria-label={`Redo (${futureCount} actions available)`}
        >
          <Redo2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Redo</span>
          {futureCount > 0 && (
            <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1 rounded">
              {futureCount}
            </span>
          )}
        </button>

        {/* Advanced Search Box (Day 9) */}
        <SearchBox />

        {/* Validate Action Placeholder */}
        <button
          disabled
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-400 bg-white border border-slate-200 rounded-md cursor-not-allowed opacity-70"
          title="Rule Validation Engine scheduled for later milestone"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Validate</span>
        </button>

        {/* JSON / Export Action Placeholder */}
        <button
          disabled
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-400 bg-white border border-slate-200 rounded-md cursor-not-allowed opacity-70"
          title="JSON Import/Export scheduled for later milestone"
        >
          <FileCode className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">JSON</span>
        </button>

        {/* Load Sample Tree (Active Day 1/4 Action) */}
        <button
          onClick={() => loadSampleTree()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 transition shadow-2xs cursor-pointer"
          title="Replace current tree with the canonical Day 1 sample compliance template"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
          <span>Load Sample Tree</span>
        </button>

        {/* Theme Placeholder */}
        <button
          disabled
          className="p-1.5 text-slate-400 hover:text-slate-500 rounded-md hover:bg-slate-50 border border-transparent cursor-not-allowed opacity-70"
          title="Light theme is active. Theme selector scheduled for later milestone"
        >
          <Sun className="w-4 h-4" />
        </button>

        {/* User / Profile Placeholder */}
        <div className="pl-2 border-l border-slate-200 flex items-center">
          <div
            className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shadow-2xs"
            title="Enterprise Compliance Officer (Day 1 Session)"
          >
            <User className="w-4 h-4 text-slate-500" />
          </div>
        </div>
      </div>
    </header>
  );
};
