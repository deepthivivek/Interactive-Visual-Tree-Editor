'use client';

import React from 'react';
import {
  SlidersHorizontal,
  Info,
  X,
  Layers,
  Tag,
  FileText,
  CheckCircle2,
  Trash2,
  GitCommit,
  ArrowDown,
  Plus,
  Copy,
  GitBranch,
} from 'lucide-react';
import { useTreeStore } from '../../store/treeStore';
import { Badge } from '../ui/badge';
import { getAllowedChildTypes } from '../../lib/relationshipRules';
import { getValidParentCandidates } from '../../lib/graphOperations';

export const PropertiesInspectorSidebar: React.FC = () => {
  const {
    nodes,
    edges,
    selectedNodeId,
    selectedEdgeId,
    setSelectedNodeId,
    setSelectedEdgeId,
    deleteEdge,
    addChild,
    duplicateNode,
    requestDeleteNode,
    reparentNode,
  } = useTreeStore();

  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null;
  const selectedEdge =
    !selectedNode && selectedEdgeId ? edges.find((e) => e.id === selectedEdgeId) ?? null : null;
  const rootCount = nodes.filter((n) => n.type === 'root').length;

  const sourceNode = selectedEdge ? nodes.find((n) => n.id === selectedEdge.source) : null;
  const targetNode = selectedEdge ? nodes.find((n) => n.id === selectedEdge.target) : null;

  const allowedChildTypes = selectedNode ? getAllowedChildTypes(selectedNode.type) : [];
  const currentParentEdge = selectedNode ? edges.find((e) => e.target === selectedNode.id) : null;
  const currentParentNode = currentParentEdge ? nodes.find((n) => n.id === currentParentEdge.source) : null;
  const validParentCandidates = selectedNode ? getValidParentCandidates(selectedNode, nodes, edges) : [];

  return (
    <aside className="nokey w-80 bg-white border-l border-slate-200 flex flex-col shrink-0 select-none overflow-y-auto">
      {/* Panel Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-slate-500" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            {selectedEdge ? 'Connection Inspector' : 'Node Inspector'}
          </h2>
        </div>
        {selectedNode && (
          <button
            onClick={() => setSelectedNodeId(null)}
            className="text-xs text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition cursor-pointer"
            title="Clear node selection"
            aria-label="Clear node selection"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        {selectedEdge && (
          <button
            onClick={() => setSelectedEdgeId(null)}
            className="text-xs text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition cursor-pointer"
            title="Clear connection selection"
            aria-label="Clear connection selection"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Panel Body */}
      <div className="flex-1 p-4 space-y-4">
        {selectedNode ? (
          /* Selected Node Read-Only Basic Information */
          <div className="space-y-4">
            {/* Primary Attributes */}
            <div className="bg-slate-50/70 border border-slate-200/80 rounded-lg p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Selected Node
                </span>
                <Badge type={selectedNode.type}>
                  {selectedNode.type.toUpperCase()}
                </Badge>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block font-medium">Label</label>
                <div className="text-sm font-semibold text-slate-900 mt-0.5">
                  {selectedNode.data.label}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 text-xs">
                <div>
                  <span className="text-[11px] text-slate-400 block">Rule ID</span>
                  <span className="font-mono text-xs text-blue-700 font-medium">
                    {selectedNode.data.ruleId ?? 'None'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Status</span>
                  <span className="capitalize font-medium text-slate-700">
                    {selectedNode.data.status ?? 'active'}
                  </span>
                </div>
              </div>

              {selectedNode.data.severity && (
                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-400">Severity</span>
                  <Badge severity={selectedNode.data.severity}>
                    {selectedNode.data.severity.toUpperCase()}
                  </Badge>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="border border-slate-200/80 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 mb-1">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>Description</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {selectedNode.data.description ?? 'No description provided.'}
              </p>
            </div>

            {/* Parameters */}
            <div className="border border-slate-200/80 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  <span>Parameters</span>
                </div>
                <span className="text-[10px] text-slate-400">
                  {Object.keys(selectedNode.data.parameters ?? {}).length} configured
                </span>
              </div>

              {selectedNode.data.parameters && Object.keys(selectedNode.data.parameters).length > 0 ? (
                <div className="bg-slate-50 rounded border border-slate-200/60 divide-y divide-slate-200/60 text-xs">
                  {Object.entries(selectedNode.data.parameters).map(([key, val]) => (
                    <div key={key} className="px-2.5 py-1.5 flex items-center justify-between">
                      <span className="font-mono text-[11px] text-slate-600">{key}</span>
                      <span className="font-mono text-[11px] text-slate-900 font-medium">
                        {String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">No parameters configured</p>
              )}
            </div>

            {/* Audit Metadata */}
            <div className="border border-slate-200/80 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                  <Tag className="w-3.5 h-3.5 text-slate-400" />
                  <span>Metadata Tags</span>
                </div>
                <span className="text-[10px] text-slate-400">
                  {Object.keys(selectedNode.data.metadata ?? {}).length} tags
                </span>
              </div>

              {selectedNode.data.metadata && Object.keys(selectedNode.data.metadata).length > 0 ? (
                <div className="space-y-1">
                  {Object.entries(selectedNode.data.metadata).map(([key, val]) => (
                    <div
                      key={key}
                      className="text-[11px] bg-slate-50 border border-slate-200/60 rounded px-2 py-1 flex items-center justify-between"
                    >
                      <span className="text-slate-500 font-mono text-[10px]">{key}:</span>
                      <span className="text-slate-700 font-medium truncate ml-1">
                        {String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">No metadata tags</p>
              )}
            </div>

            {/* Node Operations (Day 6) */}
            <div className="border border-slate-200/80 rounded-lg p-3 space-y-3 bg-white">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                <span>Node Operations</span>
              </div>

              {/* 1. Add Child */}
              <div>
                <span className="text-[11px] text-slate-500 font-medium block mb-1.5">Add Child</span>
                {allowedChildTypes.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {allowedChildTypes.map((childType) => (
                      <button
                        key={childType}
                        type="button"
                        onClick={() => addChild(selectedNode.id, childType)}
                        className="flex-1 min-w-[110px] flex items-center justify-center gap-1 py-1.5 px-2 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold cursor-pointer transition shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add {childType.charAt(0).toUpperCase() + childType.slice(1)}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 italic bg-slate-50 p-2 rounded border border-slate-100">
                    Action nodes cannot have children.
                  </div>
                )}
              </div>

              {/* 2. Duplicate Node */}
              <div>
                <button
                  type="button"
                  onClick={() => duplicateNode(selectedNode.id)}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium cursor-pointer transition shadow-2xs"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Duplicate Node</span>
                </button>
              </div>

              {/* 3. Delete Node */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => requestDeleteNode(selectedNode.id)}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold cursor-pointer transition shadow-2xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Node</span>
                </button>
                <p className="text-[10px] text-slate-400 text-center mt-1">
                  Or press <kbd className="font-mono bg-slate-100 px-1 py-0.5 rounded border border-slate-200 text-slate-600">Delete</kbd> / <kbd className="font-mono bg-slate-100 px-1 py-0.5 rounded border border-slate-200 text-slate-600">Backspace</kbd>
                </p>
              </div>
            </div>

            {/* Hierarchy & Parent Selector (Day 6 Re-parenting) */}
            <div className="border border-slate-200/80 rounded-lg p-3 space-y-2.5 bg-white">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <GitBranch className="w-3.5 h-3.5 text-indigo-600" />
                <span>Parent Connection</span>
              </div>

              {selectedNode.type === 'root' ? (
                <div className="text-[11px] text-slate-400 italic bg-slate-50 p-2 rounded border border-slate-100">
                  Root nodes cannot have a parent.
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-[11px] text-slate-500 flex items-center justify-between">
                    <span>Current Parent:</span>
                    <span className="font-medium text-slate-800">
                      {currentParentNode ? currentParentNode.data.label : 'None (Disconnected)'}
                    </span>
                  </div>

                  <div>
                    <label htmlFor="parent-selector" className="text-[11px] text-slate-500 font-medium block mb-1">
                      Re-parent / Disconnect:
                    </label>
                    <select
                      id="parent-selector"
                      value={currentParentEdge?.source ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        reparentNode(selectedNode.id, val === '' ? null : val);
                      }}
                      className="w-full text-xs bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-2xs"
                    >
                      <option value="">None (Disconnected)</option>
                      {validParentCandidates.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          [{candidate.type.toUpperCase()}] {candidate.data.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Read-Only Notice */}
            <div className="p-2.5 rounded-md bg-blue-50/60 border border-blue-100 text-[11px] text-blue-700 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-500" />
              <span>
                Read-only inspection preview. Interactive property editing is deferred to Day 7.
              </span>
            </div>
          </div>
        ) : selectedEdge ? (
          /* Selected Edge Information (Day 5 Part 2) */
          <div className="space-y-4">
            <div className="bg-slate-50/70 border border-slate-200/80 rounded-lg p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Selected Edge
                </span>
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                  {selectedEdge.data?.relationshipType ?? 'parent-child'}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 block font-medium">Edge ID</span>
                <span className="font-mono text-xs text-slate-700 font-medium break-all block mt-0.5">
                  {selectedEdge.id}
                </span>
              </div>

              {/* Hierarchy Endpoints Flow */}
              <div className="space-y-2 pt-2 border-t border-slate-200/60 text-xs">
                {/* Source (Parent) */}
                <div className="p-2 rounded bg-white border border-slate-200/80">
                  <div className="text-[10px] uppercase font-semibold text-slate-400 flex items-center justify-between">
                    <span>Source (Parent)</span>
                    {sourceNode && (
                      <span className="capitalize text-slate-500 font-mono text-[9px]">
                        {sourceNode.type}
                      </span>
                    )}
                  </div>
                  <div className="font-medium text-slate-800 text-xs mt-0.5 truncate">
                    {sourceNode?.data.label ?? selectedEdge.source}
                  </div>
                </div>

                <div className="flex justify-center -my-1 text-slate-400">
                  <ArrowDown className="w-3.5 h-3.5" />
                </div>

                {/* Target (Child) */}
                <div className="p-2 rounded bg-white border border-slate-200/80">
                  <div className="text-[10px] uppercase font-semibold text-slate-400 flex items-center justify-between">
                    <span>Target (Child)</span>
                    {targetNode && (
                      <span className="capitalize text-slate-500 font-mono text-[9px]">
                        {targetNode.type}
                      </span>
                    )}
                  </div>
                  <div className="font-medium text-slate-800 text-xs mt-0.5 truncate">
                    {targetNode?.data.label ?? selectedEdge.target}
                  </div>
                </div>
              </div>

              {/* Delete Edge Action */}
              <div className="pt-2 border-t border-slate-200/60">
                <button
                  type="button"
                  onClick={() => deleteEdge(selectedEdge.id)}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold cursor-pointer transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Connection</span>
                </button>
                <p className="text-[10px] text-slate-400 text-center mt-1">
                  Or press <kbd className="font-mono bg-slate-100 px-1 py-0.5 rounded border border-slate-200 text-slate-600">Delete</kbd> / <kbd className="font-mono bg-slate-100 px-1 py-0.5 rounded border border-slate-200 text-slate-600">Backspace</kbd>
                </p>
              </div>
            </div>

            <div className="p-2.5 rounded-md bg-blue-50/60 border border-blue-100 text-[11px] text-blue-700 flex items-start gap-1.5">
              <GitCommit className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-500" />
              <span>
                Drag either endpoint handle to reconnect this edge to another valid node.
              </span>
            </div>
          </div>
        ) : (
          /* Empty State */
          <div className="space-y-6">
            <div className="py-8 flex flex-col items-center justify-center text-center px-4">
              <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 mb-3 shadow-2xs">
                <SlidersHorizontal className="w-5 h-5 text-slate-400" />
              </div>
              <h3 className="text-sm font-semibold text-slate-800">
                No element selected
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-[210px] leading-relaxed">
                Select a node or connection line from the tree to view its properties.
              </p>
            </div>

            {/* Quick Stats Section */}
            <div className="border border-slate-200/80 rounded-lg p-3 bg-slate-50/50">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
                Quick Stats
              </div>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex items-center justify-between text-slate-600 bg-white px-2.5 py-1.5 rounded border border-slate-200/60">
                  <span className="font-sans text-slate-500">Nodes</span>
                  <span className="font-semibold text-slate-900">{nodes.length}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 bg-white px-2.5 py-1.5 rounded border border-slate-200/60">
                  <span className="font-sans text-slate-500">Edges</span>
                  <span className="font-semibold text-slate-900">{edges.length}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 bg-white px-2.5 py-1.5 rounded border border-slate-200/60">
                  <span className="font-sans text-slate-500">Root</span>
                  <span className="font-semibold text-emerald-600 flex items-center gap-1">
                    {rootCount} <CheckCircle2 className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200/60 text-[11px] text-slate-500 leading-relaxed">
              <span className="font-semibold text-slate-700 block mb-0.5">
                Inspector Scope:
              </span>
              Full live editing of node labels, parameters, and severity tags will be activated in the inspector milestone (Day 7).
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-100 bg-slate-50 text-[10px] text-slate-400 text-center">
        Day 5 Foundation • Directional Edge Safety & Selection
      </div>
    </aside>
  );
};
