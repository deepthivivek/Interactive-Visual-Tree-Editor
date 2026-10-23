'use client';

import React, { useMemo } from 'react';
import {
  MousePointerClick,
  Layers,
  Shield,
  GitBranch,
  Zap,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';
import { TreeCanvas } from './TreeCanvas';
import { useTreeStore } from '../../store/treeStore';
import { validateGraph } from '../../lib/validation';

export const TreeCanvasArea: React.FC = () => {
  const nodes = useTreeStore((state) => state.nodes);
  const edges = useTreeStore((state) => state.edges);
  const selectedNodeId = useTreeStore((state) => state.selectedNodeId);
  const selectedNodeIds = useTreeStore((state) => state.selectedNodeIds);

  const stats = useMemo(() => {
    let rootCount = 0;
    let ruleCount = 0;
    let condCount = 0;
    let actionCount = 0;

    for (const n of nodes) {
      if (n.type === 'root') rootCount++;
      else if (n.type === 'rule') ruleCount++;
      else if (n.type === 'condition') condCount++;
      else if (n.type === 'action') actionCount++;
    }

    const validation = validateGraph(nodes, edges);

    return {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      rootCount,
      ruleCount,
      condCount,
      actionCount,
      isValid: validation.valid,
      errorCount: validation.errors.length,
      warningCount: validation.warnings.length,
      score: validation.score,
    };
  }, [nodes, edges]);

  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null;
  const multiCount = Array.isArray(selectedNodeIds) ? selectedNodeIds.length : 0;

  const handleOpenValidation = () => {
    window.dispatchEvent(new CustomEvent('tree:trigger-validation'));
  };

  return (
    <main className="flex-1 bg-slate-50/70 relative flex flex-col min-w-0 h-full overflow-hidden">
      {/* Workspace Header & Live Graph Statistics (Day 17 Section 10.5) */}
      <div className="h-11 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between text-xs shrink-0 z-10 select-none">
        {/* Left: Breadcrumb Context */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-slate-800 shrink-0">Tree Editor</span>
          <span className="text-slate-300">/</span>
          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200 truncate">
            Sample Compliance Template
          </span>
        </div>

        {/* Center: Live Graph Statistics Bar (Derived accurately from real state) */}
        <div className="hidden md:flex items-center gap-3 text-[11px] text-slate-600 font-medium">
          <div className="flex items-center gap-1.5 font-mono" title="Total Nodes and Connections in current graph">
            <span className="tabular-nums font-semibold text-slate-800">{stats.nodeCount}</span>
            <span className="text-slate-400 font-sans">nodes</span>
            <span className="text-slate-300 font-sans">·</span>
            <span className="tabular-nums font-semibold text-slate-800">{stats.edgeCount}</span>
            <span className="text-slate-400 font-sans">edges</span>
          </div>

          <span className="text-slate-300 font-sans">|</span>

          {/* Node Breakdown */}
          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
            <span className="flex items-center gap-0.5 text-blue-700" title="Root nodes">
              <Layers className="w-3 h-3 text-blue-600" />
              <span className="tabular-nums font-semibold">{stats.rootCount}</span>
            </span>
            <span className="flex items-center gap-0.5 text-indigo-700" title="Rule nodes">
              <Shield className="w-3 h-3 text-indigo-600" />
              <span className="tabular-nums font-semibold">{stats.ruleCount}</span>
            </span>
            <span className="flex items-center gap-0.5 text-amber-700" title="Condition nodes">
              <GitBranch className="w-3 h-3 text-amber-600" />
              <span className="tabular-nums font-semibold">{stats.condCount}</span>
            </span>
            <span className="flex items-center gap-0.5 text-emerald-700" title="Action nodes">
              <Zap className="w-3 h-3 text-emerald-600" />
              <span className="tabular-nums font-semibold">{stats.actionCount}</span>
            </span>
          </div>

          <span className="text-slate-300 font-sans">|</span>

          {/* Validation Score Button Trigger */}
          <button
            type="button"
            onClick={handleOpenValidation}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer border focus-visible:ring-2 focus-visible:ring-blue-500 outline-hidden ${
              stats.isValid
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                : stats.errorCount > 0
                ? 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
            }`}
            title={`Validation score: ${stats.score}/100. Click to inspect issues.`}
          >
            {stats.isValid ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            ) : stats.errorCount > 0 ? (
              <AlertCircle className="w-3 h-3 text-rose-600" />
            ) : (
              <AlertTriangle className="w-3 h-3 text-amber-600" />
            )}
            <span>
              {stats.isValid
                ? `Valid (${stats.score})`
                : `${stats.errorCount} Error${stats.errorCount !== 1 ? 's' : ''}`}
            </span>
          </button>
        </div>

        {/* Right: Active Selection or Helpful Hint */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate max-w-[200px] sm:max-w-xs">
          {multiCount > 1 ? (
            <span className="font-medium text-blue-600 truncate">
              {multiCount} nodes selected
            </span>
          ) : selectedNode ? (
            <span className="truncate">
              Selected: <strong className="text-slate-700 font-semibold">{selectedNode.data.label}</strong>
            </span>
          ) : (
            <div className="flex items-center gap-1 text-slate-400">
              <MousePointerClick className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="hidden sm:inline truncate">Click node to inspect • Drag canvas to pan</span>
            </div>
          )}
        </div>
      </div>

      {/* Dominant Central Workspace hosting React Flow Canvas */}
      <div className="flex-1 relative min-h-0 w-full overflow-hidden">
        <TreeCanvas />
      </div>
    </main>
  );
};
