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
  Layers,
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
      return <HelpCircle className="w-4 h-4 text-amber-600" />;
    case 'action':
      return <Zap className="w-4 h-4 text-emerald-600" />;
    default:
      return <Layers className="w-4 h-4 text-slate-500" />;
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
    <main className="flex-1 bg-slate-50/60 relative flex flex-col min-w-0 overflow-hidden">
      {/* Canvas Top Bar / Workspace Status */}
      <div className="h-10 bg-white/80 backdrop-blur-xs border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between text-xs text-slate-500 shrink-0 z-10">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-700">Canvas Workspace</span>
          <span className="text-slate-300">•</span>
          <span className="text-[11px] text-slate-500">
            Hierarchical Compliance Tree Preview
          </span>
        </div>

        {/* Viewport & Controls Placeholder */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100/70 border border-slate-200 px-2 py-0.5 rounded text-[11px] text-slate-600">
            <span>100%</span>
            <span className="text-slate-300">|</span>
            <button disabled className="opacity-40 cursor-not-allowed">
              <ZoomOut className="w-3 h-3" />
            </button>
            <button disabled className="opacity-40 cursor-not-allowed">
              <ZoomIn className="w-3 h-3" />
            </button>
            <button disabled className="opacity-40 cursor-not-allowed">
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>
          <span className="hidden xl:inline text-[11px] text-slate-400">
            Interactive canvas on Day 2
          </span>
        </div>
      </div>

      {/* Main Canvas Scrollable Surface with subtle dot grid */}
      <div
        className="flex-1 overflow-auto p-6 lg:p-10 flex flex-col items-center justify-start min-h-0"
        style={{
          backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      >
        <div className="w-full max-w-5xl my-auto space-y-6">
          {/* Interaction Instruction Banner */}
          <div className="flex items-center justify-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/90 border border-slate-200 rounded-full shadow-2xs text-xs text-slate-500">
              <MousePointerClick className="w-3.5 h-3.5 text-blue-500" />
              <span>Click any node card to inspect properties in the right sidebar</span>
            </div>
          </div>

          {/* TREE STRUCTURE */}
          {rootNode && (
            <div className="flex flex-col items-center">
              {/* ROOT NODE CARD */}
              <div
                onClick={() => setSelectedNodeId(rootNode.id)}
                className={`w-72 sm:w-80 bg-white border rounded-xl p-4 shadow-xs transition-all cursor-pointer select-none ${
                  selectedNodeId === rootNode.id
                    ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-md'
                    : 'border-slate-200 hover:border-purple-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-purple-50 border border-purple-100">
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
                <p className="text-xs text-slate-500 mt-2.5 line-clamp-2">
                  {rootNode.data.description}
                </p>
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Policy Framework Root</span>
                  <span className="font-medium text-emerald-600">Active</span>
                </div>
              </div>

              {/* VERTICAL CONNECTOR FROM ROOT */}
              <div className="w-px h-6 bg-slate-300" />

              {/* HORIZONTAL CONNECTOR SPREAD */}
              <div className="relative w-full max-w-4xl flex items-center justify-between px-16">
                <div className="absolute top-0 left-24 right-24 h-px bg-slate-300" />
                <div className="w-px h-6 bg-slate-300 mx-auto" />
                <div className="w-px h-6 bg-slate-300 mx-auto" />
                <div className="w-px h-6 bg-slate-300 mx-auto" />
              </div>

              {/* RULE BRANCHES (FINRA-2210, SEC-17a-4, DISC-09) */}
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
                        className={`w-full bg-white border rounded-lg p-3.5 shadow-xs transition-all cursor-pointer select-none ${
                          selectedNodeId === rule.id
                            ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-md'
                            : 'border-slate-200 hover:border-blue-300 hover:shadow-sm'
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
                        <p className="text-[11px] text-slate-500 mt-2 line-clamp-2">
                          {rule.data.description}
                        </p>
                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
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

                      {/* VERTICAL CONNECTOR DOWN FROM RULE */}
                      <div className="w-px h-5 bg-slate-300" />

                      {/* BRANCH LEAVES (CONDITION & ACTION) */}
                      <div className="w-full space-y-2.5">
                        {/* Condition Card */}
                        {conditionNode && (
                          <div
                            onClick={() => setSelectedNodeId(conditionNode.id)}
                            className={`w-full bg-white border rounded-lg p-3 shadow-2xs transition-all cursor-pointer select-none ${
                              selectedNodeId === conditionNode.id
                                ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-md'
                                : 'border-slate-200 hover:border-amber-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <div className="p-1 rounded bg-amber-50 border border-amber-100">
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
                            <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
                              <span className="font-mono text-amber-700">
                                {conditionNode.data.ruleId}
                              </span>
                              <span>Gate criteria</span>
                            </div>
                          </div>
                        )}

                        {/* Action Card */}
                        {actionNode && (
                          <div
                            onClick={() => setSelectedNodeId(actionNode.id)}
                            className={`w-full bg-white border rounded-lg p-3 shadow-2xs transition-all cursor-pointer select-none ${
                              selectedNodeId === actionNode.id
                                ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-md'
                                : 'border-slate-200 hover:border-emerald-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <div className="p-1 rounded bg-emerald-50 border border-emerald-100">
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
                            <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
                              <span className="font-mono text-emerald-700">
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

          {/* COMPLIANCE DISCLAIMER FOOTER */}
          <div className="text-center pt-6">
            <p className="text-[11px] text-slate-400 max-w-xl mx-auto leading-relaxed">
              <span className="font-medium text-slate-600">Sample Compliance Template:</span> FINRA-2210, SEC-17a-4, and DISC-09 branches are mock demonstration fixtures created for architecture validation and are not official regulatory workflows.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
};
