'use client';

import React from 'react';
import { SlidersHorizontal, Info, X, Layers, Tag, FileText } from 'lucide-react';
import { useTreeStore } from '../../store/treeStore';
import { Badge } from '../ui/badge';

export const PropertiesInspectorSidebar: React.FC = () => {
  const { nodes, selectedNodeId, setSelectedNodeId } = useTreeStore();
  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  return (
    <aside className="w-80 bg-white border-l border-slate-200 flex flex-col shrink-0 select-none overflow-y-auto">
      {/* Panel Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-slate-500" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Properties Inspector
          </h2>
        </div>
        {selectedNode && (
          <button
            onClick={() => setSelectedNodeId(null)}
            className="text-xs text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition"
            title="Clear node selection"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Content Body */}
      <div className="flex-1 p-4">
        {!selectedNode ? (
          /* Empty State */
          <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center px-4">
            <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 mb-3 shadow-2xs">
              <SlidersHorizontal className="w-5 h-5 text-slate-400" />
            </div>
            <h3 className="text-sm font-medium text-slate-800">
              No node selected
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-[200px] leading-relaxed">
              Select a node on the canvas to view its properties.
            </p>
            <div className="mt-6 p-2.5 rounded-md bg-slate-50 border border-slate-100 text-[11px] text-slate-500 text-left w-full">
              <span className="font-semibold text-slate-700 block mb-0.5">
                Inspector Scope:
              </span>
              Full live editing of parameters, rule IDs, and metadata tags will be activated on Day 7.
            </div>
          </div>
        ) : (
          /* Selected Node Read-Only Preview */
          <div className="space-y-4">
            {/* Primary Attributes */}
            <div className="bg-slate-50/70 border border-slate-200/80 rounded-lg p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Node Identification
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
                  <span className="text-[11px] text-slate-400">Severity Level</span>
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

            {/* Parameters Dictionary */}
            <div className="border border-slate-200/80 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  <span>Rule Parameters</span>
                </div>
                <span className="text-[10px] text-slate-400">
                  {Object.keys(selectedNode.data.parameters ?? {}).length} entries
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
                  <span>Audit Metadata</span>
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

            {/* Read-Only Milestone Banner */}
            <div className="p-2.5 rounded-md bg-blue-50/60 border border-blue-100 text-[11px] text-blue-700 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-500" />
              <span>
                Read-only inspection preview. Interactive live property editing will be activated on Day 7.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Note */}
      <div className="p-3 border-t border-slate-100 bg-slate-50 text-[10px] text-slate-400 text-center">
        Transient UI state only • Not stored in undo history
      </div>
    </aside>
  );
};
