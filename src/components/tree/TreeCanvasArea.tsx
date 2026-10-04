'use client';

import React from 'react';
import {
  FolderTree,
  ShieldAlert,
  HelpCircle,
  Zap,
  MousePointerClick,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Grid,
  Map,
  ArrowDown,
} from 'lucide-react';
import { useTreeStore } from '../../store/treeStore';
import { Badge } from '../ui/badge';
import type { NodeType, TreeNode } from '../../types/tree';

function getNodeTypeIcon(type: NodeType) {
  switch (type) {
    case 'root':
      return <FolderTree className="w-4 h-4 text-purple-600" />;
    case 'rule':
      return <ShieldAlert className="w-4 h-4 text-blue-600" />;
    case 'condition':
      return <HelpCircle className="w-4 h-4 text-emerald-600" />;
    case 'action':
      return <Zap className="w-4 h-4 text-orange-600" />;
    default:
      return <FolderTree className="w-4 h-4 text-slate-500" />;
  }
}

export const TreeCanvasArea: React.FC = () => {
  const { nodes, edges, selectedNodeId, setSelectedNodeId } = useTreeStore();

  const rootNode = nodes.find((n) => n.type === 'root');
  const ruleNodes = nodes.filter((n) => n.type === 'rule');

  const getChildNodes = (parentId: string): TreeNode[] => {
    const childIds = edges.filter((e) => e.source === parentId).map((e) => e.target);
    return nodes.filter((n) => childIds.includes(n.id));
  };

  return (
    <main className="flex-1 bg-slate-50/70 relative flex flex-col min-w-0 overflow-hidden">
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
          <span className="hidden sm:inline">Click node to inspect</span>
        </div>
      </div>

      {/* Main Canvas Scrollable Area with subtle dot pattern */}
      <div
        className="flex-1 overflow-auto p-6 sm:p-10 flex flex-col items-center justify-start min-h-0"
        style={{
          backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      >
        <div className="w-full max-w-5xl my-auto space-y-6 pb-16">
          {/* TREE GRAPH HIERARCHICAL PREVIEW */}
          {rootNode && (
            <div className="flex flex-col items-center">
              {/* LEVEL 1: ROOT NODE */}
              <div
                onClick={() => setSelectedNodeId(rootNode.id)}
                className={`w-72 sm:w-80 bg-white border rounded-lg p-3.5 shadow-2xs transition-all cursor-pointer select-none ${
                  selectedNodeId === rootNode.id
                    ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-xs'
                    : 'border-slate-200 hover:border-purple-300 hover:shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-purple-50 border border-purple-100">
                      {getNodeTypeIcon('root')}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-900 leading-tight">
                        {rootNode.data.label}
                      </div>
                      <div className="font-mono text-[10px] text-purple-700">
                        {rootNode.data.ruleId}
                      </div>
                    </div>
                  </div>
                  <Badge type="root">ROOT</Badge>
                </div>
                <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                  {rootNode.data.description}
                </p>
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Policy Framework Root</span>
                  <span className="font-medium text-emerald-600">Active</span>
                </div>
              </div>

              {/* DIRECTIONAL CONNECTOR DOWN FROM ROOT */}
              <div className="flex flex-col items-center">
                <div className="w-px h-5 bg-slate-300" />
                <ArrowDown className="w-3.5 h-3.5 text-slate-400 -mt-1" />
              </div>

              {/* HORIZONTAL CONNECTOR SPREAD */}
              <div className="relative w-full max-w-4xl flex items-center justify-between px-16">
                <div className="absolute top-0 left-20 right-20 h-px bg-slate-300" />
                <div className="w-px h-5 bg-slate-300 mx-auto" />
                <div className="w-px h-5 bg-slate-300 mx-auto" />
                <div className="w-px h-5 bg-slate-300 mx-auto" />
              </div>

              {/* LEVEL 2: RULE BRANCHES (FINRA-2210, SEC-17a-4, DISC-09) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
                {ruleNodes.map((rule) => {
                  const children = getChildNodes(rule.id);
                  const conditionNode = children.find((c) => c.type === 'condition');
                  const actionNode = children.find((c) => c.type === 'action');

                  return (
                    <div key={rule.id} className="flex flex-col items-center">
                      {/* RULE CARD */}
                      <div
                        onClick={() => setSelectedNodeId(rule.id)}
                        className={`w-full bg-white border rounded-lg p-3 shadow-2xs transition-all cursor-pointer select-none ${
                          selectedNodeId === rule.id
                            ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-xs'
                            : 'border-slate-200 hover:border-blue-300 hover:shadow-xs'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="p-1 rounded-md bg-blue-50 border border-blue-100">
                              {getNodeTypeIcon('rule')}
                            </div>
                            <span className="text-xs font-semibold text-slate-900">
                              {rule.data.label}
                            </span>
                          </div>
                          <Badge type="rule">RULE</Badge>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1.5 line-clamp-2">
                          {rule.data.description}
                        </p>
                        <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                          <span className="font-mono text-blue-700">
                            {rule.data.ruleId}
                          </span>
                          {rule.data.severity && (
                            <Badge severity={rule.data.severity} className="text-[9px] py-0 px-1.5">
                              {rule.data.severity.toUpperCase()}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* DIRECTIONAL CONNECTOR DOWN FROM RULE */}
                      <div className="flex flex-col items-center">
                        <div className="w-px h-4 bg-slate-300" />
                        <ArrowDown className="w-3 h-3 text-slate-400 -mt-1" />
                      </div>

                      {/* LEVEL 3 & 4: CONDITION AND ACTION */}
                      <div className="w-full space-y-2">
                        {/* Condition Card */}
                        {conditionNode && (
                          <div
                            onClick={() => setSelectedNodeId(conditionNode.id)}
                            className={`w-full bg-white border rounded-lg p-2.5 shadow-2xs transition-all cursor-pointer select-none ${
                              selectedNodeId === conditionNode.id
                                ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-xs'
                                : 'border-slate-200 hover:border-emerald-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <div className="p-1 rounded bg-emerald-50 border border-emerald-100">
                                  {getNodeTypeIcon('condition')}
                                </div>
                                <span className="text-xs font-medium text-slate-800 truncate max-w-[130px]">
                                  {conditionNode.data.label}
                                </span>
                              </div>
                              <Badge type="condition" className="text-[9px] py-0">
                                COND
                              </Badge>
                            </div>
                            <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                              <span className="font-mono text-emerald-700">
                                {conditionNode.data.ruleId}
                              </span>
                              <span>Criteria gate</span>
                            </div>
                          </div>
                        )}

                        {/* DIRECTIONAL CONNECTOR FROM CONDITION TO ACTION */}
                        <div className="flex flex-col items-center">
                          <div className="w-px h-3 bg-slate-300" />
                          <ArrowDown className="w-3 h-3 text-slate-400 -mt-1" />
                        </div>

                        {/* Action Card */}
                        {actionNode && (
                          <div
                            onClick={() => setSelectedNodeId(actionNode.id)}
                            className={`w-full bg-white border rounded-lg p-2.5 shadow-2xs transition-all cursor-pointer select-none ${
                              selectedNodeId === actionNode.id
                                ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-xs'
                                : 'border-slate-200 hover:border-orange-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <div className="p-1 rounded bg-orange-50 border border-orange-100">
                                  {getNodeTypeIcon('action')}
                                </div>
                                <span className="text-xs font-medium text-slate-800 truncate max-w-[130px]">
                                  {actionNode.data.label}
                                </span>
                              </div>
                              <Badge type="action" className="text-[9px] py-0">
                                ACT
                              </Badge>
                            </div>
                            <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                              <span className="font-mono text-orange-700">
                                {actionNode.data.ruleId}
                              </span>
                              <span>Enforcement</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* MOCK COMPLIANCE DISCLAIMER */}
          <div className="text-center pt-4">
            <p className="text-[11px] text-slate-400 max-w-xl mx-auto leading-relaxed">
              This is mock sample data and does not represent official regulatory workflows.
            </p>
          </div>
        </div>
      </div>

      {/* FLOATING CANVAS CONTROLS (Day 1 Visual Placeholders) */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-white/95 backdrop-blur-xs border border-slate-200 rounded-lg shadow-sm px-2 py-1.5 flex items-center gap-1.5 text-xs select-none">
        <button
          disabled
          className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 cursor-not-allowed opacity-60"
          title="Zoom out (Interactive canvas enabled on Day 2)"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <span className="px-1.5 text-[11px] font-mono text-slate-600">
          100%
        </span>

        <button
          disabled
          className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 cursor-not-allowed opacity-60"
          title="Zoom in (Interactive canvas enabled on Day 2)"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <div className="w-px h-3.5 bg-slate-200 mx-0.5" />

        <button
          disabled
          className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 cursor-not-allowed opacity-60"
          title="Fit view (Interactive canvas enabled on Day 2)"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        <button
          disabled
          className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 cursor-not-allowed opacity-60"
          title="Toggle grid (Canvas engine enabled on Day 2)"
        >
          <Grid className="w-4 h-4" />
        </button>

        <button
          disabled
          className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 cursor-not-allowed opacity-60"
          title="MiniMap (Enabled in later milestone)"
        >
          <Map className="w-4 h-4" />
        </button>
      </div>
    </main>
  );
};
