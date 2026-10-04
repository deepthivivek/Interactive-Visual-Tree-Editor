'use client';

import React from 'react';
import {
  FolderTree,
  ShieldAlert,
  GitBranch,
  HelpCircle,
  Zap,
  Info,
  Layers,
  Link as LinkIcon,
  RotateCcw,
  CheckCircle,
} from 'lucide-react';
import { useTreeStore, SAMPLE_COMPLIANCE_TEMPLATE_LABEL } from '../../store/treeStore';
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
      return <GitBranch className="w-4 h-4 text-slate-500" />;
  }
}

export const TreeFoundationViewer: React.FC = () => {
  const { nodes, edges, selectedNodeId, setSelectedNodeId, resetToSampleData } = useTreeStore();

  const rootNode = nodes.find((n) => n.type === 'root');
  const ruleNodes = nodes.filter((n) => n.type === 'rule');

  const getChildNodes = (parentId: string): TreeNode[] => {
    const childIds = edges.filter((e) => e.source === parentId).map((e) => e.target);
    return nodes.filter((n) => childIds.includes(n.id));
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  return (
    <div className="space-y-6">
      {/* Top Banner: Template info and compliance disclaimer */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-md mt-0.5">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-slate-900">
                  {SAMPLE_COMPLIANCE_TEMPLATE_LABEL}
                </h2>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  Day 1 Foundation
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Notice: FINRA-2210, SEC-17a-4, and DISC-09 branches are mock sample data designed for
                architecture and tree model validation only. These do not represent official regulatory workflows.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => resetToSampleData()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 active:bg-slate-100 transition shadow-sm"
              title="Reset state to initial sample template"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              Reset Sample Data
            </button>
          </div>
        </div>
      </div>

      {/* State Separation & Diagnostics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Graph Document State card */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Graph Document State
            </span>
            <span className="inline-flex items-center text-xs text-emerald-600 font-medium">
              <CheckCircle className="w-3.5 h-3.5 mr-1" /> Persisted
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-4">
            <div>
              <span className="text-2xl font-bold text-slate-900">{nodes.length}</span>
              <span className="ml-1 text-xs text-slate-500">Nodes</span>
            </div>
            <div>
              <span className="text-2xl font-bold text-slate-900">{edges.length}</span>
              <span className="ml-1 text-xs text-slate-500">Edges</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Target for persistence & future undo/redo history.
          </p>
        </div>

        {/* Transient UI State card */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Transient UI State
            </span>
            <span className="inline-flex items-center text-xs text-amber-600 font-medium">
              <Info className="w-3.5 h-3.5 mr-1" /> Ephemeral
            </span>
          </div>
          <div className="mt-3">
            <div className="text-sm font-medium text-slate-900 truncate">
              {selectedNode ? selectedNode.data.label : 'None (click a node to select)'}
            </div>
            <div className="text-xs text-slate-500 font-mono mt-0.5">
              ID: {selectedNodeId ?? 'null'}
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Exempt from document persistence & undo history.
          </p>
        </div>

        {/* Structural Model card */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Tree Topology
            </span>
            <span className="inline-flex items-center text-xs text-purple-600 font-medium">
              1 Root Valid
            </span>
          </div>
          <div className="mt-3 text-xs space-y-1 text-slate-600">
            <div className="flex justify-between">
              <span>Root Nodes:</span>
              <span className="font-semibold text-slate-900">
                {nodes.filter((n) => n.type === 'root').length}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Rules:</span>
              <span className="font-semibold text-slate-900">{ruleNodes.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Conditions:</span>
              <span className="font-semibold text-slate-900">
                {nodes.filter((n) => n.type === 'condition').length}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Actions:</span>
              <span className="font-semibold text-slate-900">
                {nodes.filter((n) => n.type === 'action').length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Structured Hierarchical Tree View */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Policy Hierarchy Tree Model
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Hierarchical view verifying typed node types, rule IDs, severities, and parent-child edges.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Click any card to select:</span>
          </div>
        </div>

        {/* Root Level */}
        {rootNode && (
          <div className="space-y-6">
            <div className="flex justify-center">
              <div
                onClick={() => setSelectedNodeId(rootNode.id)}
                className={`w-full max-w-md p-4 rounded-lg border cursor-pointer transition ${
                  selectedNodeId === rootNode.id
                    ? 'border-purple-600 bg-purple-50/50 shadow-md ring-2 ring-purple-500/20'
                    : 'border-purple-200 bg-purple-50/20 hover:border-purple-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getNodeTypeIcon(rootNode.type ?? 'root')}
                    <span className="font-semibold text-slate-900 text-sm">
                      {rootNode.data.label}
                    </span>
                  </div>
                  <Badge type="root">ROOT</Badge>
                </div>
                <p className="text-xs text-slate-600 mt-2">{rootNode.data.description}</p>
                <div className="mt-3 pt-2 border-t border-purple-100 flex items-center justify-between text-xs text-slate-500">
                  <span className="font-mono text-[11px] text-purple-700">
                    {rootNode.data.ruleId}
                  </span>
                  <span>Status: {rootNode.data.status}</span>
                </div>
              </div>
            </div>

            {/* Tree Branch Connector Indicator */}
            <div className="flex justify-center items-center text-slate-300">
              <div className="h-4 w-px bg-slate-300" />
            </div>

            {/* Rule Branches (FINRA-2210, SEC-17a-4, DISC-09) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {ruleNodes.map((rule) => {
                const children = getChildNodes(rule.id);
                const conditionNode = children.find((c) => c.type === 'condition');
                const actionNode = children.find((c) => c.type === 'action');

                return (
                  <div
                    key={rule.id}
                    className="flex flex-col space-y-4 border border-slate-200 bg-slate-50/50 rounded-lg p-4"
                  >
                    {/* Rule Card */}
                    <div
                      onClick={() => setSelectedNodeId(rule.id)}
                      className={`p-3.5 rounded-lg border cursor-pointer transition bg-white ${
                        selectedNodeId === rule.id
                          ? 'border-blue-600 shadow-md ring-2 ring-blue-500/20'
                          : 'border-slate-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getNodeTypeIcon('rule')}
                          <span className="font-semibold text-slate-900 text-sm">
                            {rule.data.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge type="rule">RULE</Badge>
                          {rule.data.severity && (
                            <Badge severity={rule.data.severity}>{rule.data.severity}</Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 mt-2">{rule.data.description}</p>
                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span className="font-mono text-[11px] text-blue-700">
                          {rule.data.ruleId}
                        </span>
                        <span>Status: {rule.data.status}</span>
                      </div>
                    </div>

                    {/* Edge visual indicator */}
                    <div className="flex justify-center items-center text-slate-300">
                      <div className="h-3 w-px bg-slate-300" />
                    </div>

                    {/* Branch Children (Condition & Action) */}
                    <div className="space-y-3">
                      {/* Condition Node */}
                      {conditionNode && (
                        <div
                          onClick={() => setSelectedNodeId(conditionNode.id)}
                          className={`p-3 rounded-lg border cursor-pointer transition bg-white ${
                            selectedNodeId === conditionNode.id
                              ? 'border-amber-600 shadow-md ring-2 ring-amber-500/20'
                              : 'border-slate-200 hover:border-amber-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              {getNodeTypeIcon('condition')}
                              <span className="font-medium text-slate-900 text-xs">
                                {conditionNode.data.label}
                              </span>
                            </div>
                            <Badge type="condition">CONDITION</Badge>
                          </div>
                          <p className="text-xs text-slate-500 mt-1.5">
                            {conditionNode.data.description}
                          </p>
                          <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                            <span className="font-mono text-amber-700">
                              {conditionNode.data.ruleId}
                            </span>
                            <span>Sev: {conditionNode.data.severity}</span>
                          </div>
                        </div>
                      )}

                      {/* Action Node */}
                      {actionNode && (
                        <div
                          onClick={() => setSelectedNodeId(actionNode.id)}
                          className={`p-3 rounded-lg border cursor-pointer transition bg-white ${
                            selectedNodeId === actionNode.id
                              ? 'border-emerald-600 shadow-md ring-2 ring-emerald-500/20'
                              : 'border-slate-200 hover:border-emerald-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              {getNodeTypeIcon('action')}
                              <span className="font-medium text-slate-900 text-xs">
                                {actionNode.data.label}
                              </span>
                            </div>
                            <Badge type="action">ACTION</Badge>
                          </div>
                          <p className="text-xs text-slate-500 mt-1.5">
                            {actionNode.data.description}
                          </p>
                          <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                            <span className="font-mono text-emerald-700">
                              {actionNode.data.ruleId}
                            </span>
                            <span>Sev: {actionNode.data.severity}</span>
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
      </div>

      {/* Selected Node Details Drawer / Panel (Demonstrating Transient UI State) */}
      {selectedNode && (
        <div className="bg-slate-900 text-slate-100 rounded-lg p-5 shadow-lg border border-slate-800">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Selected Node Inspector (Transient UI State Only)
              </span>
            </div>
            <button
              onClick={() => setSelectedNodeId(null)}
              className="text-xs text-slate-400 hover:text-white transition"
            >
              Clear selection
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-500 block">Node ID</span>
              <span className="font-mono text-slate-200 mt-0.5 block">{selectedNode.id}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Type</span>
              <span className="text-slate-200 mt-0.5 block font-medium capitalize">
                {selectedNode.type}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Rule ID</span>
              <span className="font-mono text-amber-400 mt-0.5 block">
                {selectedNode.data.ruleId ?? 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Status / Severity</span>
              <span className="text-slate-200 mt-0.5 block">
                {selectedNode.data.status ?? 'active'} / {selectedNode.data.severity ?? 'none'}
              </span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-400">
            <span className="text-slate-500 font-semibold">Parameters: </span>
            <code className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
              {JSON.stringify(selectedNode.data.parameters ?? {})}
            </code>
            <span className="ml-4 text-slate-500 font-semibold">Metadata: </span>
            <code className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
              {JSON.stringify(selectedNode.data.metadata ?? {})}
            </code>
          </div>
        </div>
      )}

      {/* Raw Document Connection Manifest */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2 flex items-center gap-1.5">
          <LinkIcon className="w-3.5 h-3.5 text-slate-500" /> Edge Manifest ({edges.length} Connections)
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {edges.map((edge) => (
            <div
              key={edge.id}
              className="bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs flex items-center justify-between"
            >
              <div className="truncate">
                <span className="font-mono text-slate-600 text-[11px]">{edge.source}</span>
                <span className="text-slate-400 mx-1">→</span>
                <span className="font-mono text-slate-900 text-[11px]">{edge.target}</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono ml-2">
                {edge.data?.relationshipType}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
