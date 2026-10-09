'use client';

import React, { useState } from 'react';
import {
  SlidersHorizontal,
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
  Check,
  AlertTriangle,
  Hash,
  ShieldAlert,
  Activity,
  Sliders,
} from 'lucide-react';
import { useTreeStore } from '../../store/treeStore';
import { Badge } from '../ui/badge';
import { getAllowedChildTypes } from '../../lib/relationshipRules';
import { getValidParentCandidates } from '../../lib/graphOperations';
import { getNodeTypeConfig, getNodeStatusConfig } from '../../lib/nodeTypeConfig';
import type { NodeSeverity, NodeStatus, TreeNode, TreeNodeData } from '../../types/tree';
import { VALID_SEVERITIES, VALID_STATUSES } from '../../lib/nodePropertyOperations';

interface NodeCorePropertiesFormProps {
  node: TreeNode;
  onUpdate: (updates: Partial<TreeNodeData>) => void;
}

const NodeCorePropertiesForm: React.FC<NodeCorePropertiesFormProps> = ({ node, onUpdate }) => {
  const [draftLabel, setDraftLabel] = useState(node.data.label);
  const [draftRuleId, setDraftRuleId] = useState(node.data.ruleId ?? '');
  const [draftDescription, setDraftDescription] = useState(node.data.description ?? '');
  const [prevData, setPrevData] = useState(node.data);

  // Sync draft state during render if node properties change externally (e.g. via undo/redo)
  if (prevData !== node.data) {
    setPrevData(node.data);
    setDraftLabel(node.data.label);
    setDraftRuleId(node.data.ruleId ?? '');
    setDraftDescription(node.data.description ?? '');
  }

  const commitLabel = () => {
    const trimmed = draftLabel.trim();
    const finalVal = trimmed || node.data.label;
    if (finalVal !== node.data.label) {
      onUpdate({ label: finalVal });
    }
    setDraftLabel(finalVal);
  };

  const commitRuleId = () => {
    const trimmed = draftRuleId.trim();
    const finalVal = trimmed === '' ? undefined : trimmed;
    if (finalVal !== node.data.ruleId) {
      onUpdate({ ruleId: finalVal });
    }
  };

  const commitDescription = () => {
    const finalVal = draftDescription;
    if (finalVal !== (node.data.description ?? '')) {
      onUpdate({ description: finalVal });
    }
  };

  const handleInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    commitFn: () => void
  ) => {
    // IME composition safety: do not commit during IME composition
    if (e.nativeEvent.isComposing) {
      return;
    }
    if (e.key === 'Enter') {
      commitFn();
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      // Revert to current node data
      setDraftLabel(node.data.label);
      setDraftRuleId(node.data.ruleId ?? '');
      e.currentTarget.blur();
    }
  };

  return (
    <div className="border border-slate-200/80 rounded-lg p-3.5 space-y-3 bg-white">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
        <FileText className="w-3.5 h-3.5 text-blue-600" />
        <span>Core Properties</span>
      </div>

      {/* Label Field */}
      <div>
        <label
          htmlFor="prop-node-label"
          className="text-[11px] text-slate-500 font-medium flex items-center justify-between mb-1"
        >
          <span>Label</span>
          <span className="text-[10px] text-rose-500 font-normal">Required</span>
        </label>
        <input
          id="prop-node-label"
          type="text"
          value={draftLabel}
          onChange={(e) => setDraftLabel(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => handleInputKeyDown(e, commitLabel)}
          placeholder="Enter node label..."
          aria-required="true"
          className="w-full text-xs font-semibold text-slate-900 bg-white border border-slate-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-2xs"
        />
      </div>

      {/* Rule ID Field */}
      <div>
        <label
          htmlFor="prop-node-ruleid"
          className="text-[11px] text-slate-500 font-medium block mb-1"
        >
          Rule Identifier
        </label>
        <input
          id="prop-node-ruleid"
          type="text"
          value={draftRuleId}
          onChange={(e) => setDraftRuleId(e.target.value)}
          onBlur={commitRuleId}
          onKeyDown={(e) => handleInputKeyDown(e, commitRuleId)}
          placeholder="e.g. RULE-FINRA-2210, COND-01"
          className="w-full font-mono text-xs text-blue-800 bg-slate-50/50 border border-slate-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-2xs"
        />
      </div>

      {/* Description Field */}
      <div>
        <label
          htmlFor="prop-node-description"
          className="text-[11px] text-slate-500 font-medium block mb-1"
        >
          Description
        </label>
        <textarea
          id="prop-node-description"
          rows={3}
          value={draftDescription}
          onChange={(e) => setDraftDescription(e.target.value)}
          onBlur={commitDescription}
          placeholder="Enter detailed description or policy rationale..."
          className="w-full text-xs text-slate-700 bg-white border border-slate-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-2xs resize-y"
        />
      </div>
    </div>
  );
};

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
    updateNodeData,
    updateNodeParameter,
    deleteNodeParameter,
    updateNodeMetadata,
    deleteNodeMetadata,
    addNodeTag,
    removeNodeTag,
    deleteSubtree,
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

  // Local state for copy feedback, new parameter input, new metadata input, and new tag input
  const [copiedId, setCopiedId] = useState(false);
  const [newParamKey, setNewParamKey] = useState('');
  const [newParamValue, setNewParamValue] = useState('');
  const [newMetaKey, setNewMetaKey] = useState('');
  const [newMetaValue, setNewMetaValue] = useState('');
  const [newTagInput, setNewTagInput] = useState('');
  const [paramError, setParamError] = useState<string | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);

  const handleCopyId = () => {
    if (!selectedNode) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(selectedNode.id).catch(() => {});
    }
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleAddParameter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNode) return;
    const key = newParamKey.trim();
    if (!key) {
      setParamError('Parameter name is required.');
      return;
    }
    const currentParams = selectedNode.data.parameters ?? {};
    if (key in currentParams) {
      setParamError(`Parameter "${key}" already exists.`);
      return;
    }
    const raw = newParamValue.trim();
    let typedVal: string | number | boolean = raw;
    if (raw.toLowerCase() === 'true') typedVal = true;
    else if (raw.toLowerCase() === 'false') typedVal = false;
    else if (!isNaN(Number(raw)) && raw !== '') typedVal = Number(raw);

    updateNodeParameter(selectedNode.id, key, typedVal);
    setNewParamKey('');
    setNewParamValue('');
    setParamError(null);
  };

  const handleAddMetadata = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNode) return;
    const key = newMetaKey.trim();
    if (!key) {
      setMetaError('Tag key is required.');
      return;
    }
    const currentMeta = selectedNode.data.metadata ?? {};
    if (key in currentMeta) {
      setMetaError(`Tag "${key}" already exists.`);
      return;
    }
    const raw = newMetaValue.trim();
    let typedVal: string | number | boolean = raw;
    if (raw.toLowerCase() === 'true') typedVal = true;
    else if (raw.toLowerCase() === 'false') typedVal = false;
    else if (!isNaN(Number(raw)) && raw !== '') typedVal = Number(raw);

    updateNodeMetadata(selectedNode.id, key, typedVal);
    setNewMetaKey('');
    setNewMetaValue('');
    setMetaError(null);
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNode) return;
    const tag = newTagInput.trim();
    if (!tag) return;
    addNodeTag(selectedNode.id, tag);
    setNewTagInput('');
  };

  const nodeTypeConfig = selectedNode ? getNodeTypeConfig(selectedNode.type) : null;
  const nodeStatusConfig = selectedNode ? getNodeStatusConfig(selectedNode.data.status) : null;

  return (
    <aside
      aria-label="Properties Inspector"
      className="nokey w-88 bg-white border-l border-slate-200 flex flex-col shrink-0 select-none overflow-y-auto"
    >
      {/* Panel Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-xs z-10">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-slate-500" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            {selectedEdge ? 'Connection Inspector' : 'Properties Inspector'}
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
          <div className="space-y-4">
            {/* Header / Type & ID Bar */}
            <div className="bg-slate-50/80 border border-slate-200/80 rounded-lg p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Node Type
                </span>
                <Badge type={selectedNode.type}>
                  {nodeTypeConfig?.badgeLabel ?? selectedNode.type.toUpperCase()}
                </Badge>
              </div>

              {/* Node ID Row with Copy */}
              <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200/60">
                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                  <Hash className="w-3 h-3 text-slate-400" />
                  <span>ID:</span>
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <code
                    className="font-mono text-[10px] text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200 truncate max-w-[140px]"
                    title={selectedNode.id}
                  >
                    {selectedNode.id}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyId}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-white border border-transparent hover:border-slate-200 transition cursor-pointer"
                    title={copiedId ? 'Copied!' : 'Copy node ID'}
                    aria-label="Copy node ID"
                  >
                    {copiedId ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* SECTION 1: CORE ATTRIBUTES (Label, Rule ID, Description with single-commit drafts) */}
            <NodeCorePropertiesForm
              key={selectedNode.id}
              node={selectedNode}
              onUpdate={(updates) => updateNodeData(selectedNode.id, updates)}
            />

            {/* SECTION 2: GOVERNANCE & CLASSIFICATION (Severity & Status) */}
            <div className="border border-slate-200/80 rounded-lg p-3.5 space-y-3 bg-white">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                <span>Governance & Classification</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Severity Selector */}
                <div>
                  <label
                    htmlFor="prop-node-severity"
                    className="text-[11px] text-slate-500 font-medium block mb-1"
                  >
                    Severity
                  </label>
                  <select
                    id="prop-node-severity"
                    value={selectedNode.data.severity ?? 'medium'}
                    onChange={(e) => {
                      const val = e.target.value as NodeSeverity;
                      if (val !== selectedNode.data.severity) {
                        updateNodeData(selectedNode.id, { severity: val });
                      }
                    }}
                    className="w-full text-xs bg-white border border-slate-300 rounded-md px-2 py-1.5 text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-2xs capitalize"
                  >
                    {VALID_SEVERITIES.map((sev) => (
                      <option key={sev} value={sev}>
                        {sev.charAt(0).toUpperCase() + sev.slice(1)}
                      </option>
                    ))}
                  </select>
                  {selectedNode.data.severity && (
                    <div className="mt-1 flex items-center gap-1">
                      <span className="text-[10px] text-slate-400">Preview:</span>
                      <Badge severity={selectedNode.data.severity} className="text-[10px] py-0 px-1.5">
                        {selectedNode.data.severity.toUpperCase()}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Status Selector */}
                <div>
                  <label
                    htmlFor="prop-node-status"
                    className="text-[11px] text-slate-500 font-medium block mb-1"
                  >
                    Status
                  </label>
                  <select
                    id="prop-node-status"
                    value={selectedNode.data.status ?? 'active'}
                    onChange={(e) => {
                      const val = e.target.value as NodeStatus;
                      if (val !== selectedNode.data.status) {
                        updateNodeData(selectedNode.id, { status: val });
                      }
                    }}
                    className="w-full text-xs bg-white border border-slate-300 rounded-md px-2 py-1.5 text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-2xs capitalize"
                  >
                    {VALID_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st === 'in_review' ? 'In Review' : st.charAt(0).toUpperCase() + st.slice(1)}
                      </option>
                    ))}
                  </select>
                  {selectedNode.data.status && (
                    <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-500">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${nodeStatusConfig?.dotColor ?? 'bg-slate-400'}`}
                      />
                      <span className="capitalize">{nodeStatusConfig?.label ?? selectedNode.data.status}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SECTION 3: PARAMETERS DICTIONARY */}
            <div className="border border-slate-200/80 rounded-lg p-3.5 space-y-3 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                  <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Rule Parameters</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  {Object.keys(selectedNode.data.parameters ?? {}).length} configured
                </span>
              </div>

              {/* Existing Parameters List */}
              {selectedNode.data.parameters && Object.keys(selectedNode.data.parameters).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(selectedNode.data.parameters).map(([key, val]) => (
                    <div
                      key={`${selectedNode.id}-param-${key}`}
                      className="flex items-center gap-1.5 p-1.5 bg-slate-50 rounded border border-slate-200/80 text-xs"
                    >
                      <input
                        type="text"
                        defaultValue={key}
                        onBlur={(e) => {
                          const newKey = e.target.value.trim();
                          if (newKey && newKey !== key) {
                            updateNodeParameter(selectedNode.id, newKey, val, key);
                          }
                        }}
                        placeholder="Key"
                        className="w-1/2 font-mono text-[11px] text-slate-700 bg-white border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        title="Parameter Name"
                      />
                      <input
                        type="text"
                        defaultValue={String(val)}
                        onBlur={(e) => {
                          const rawVal = e.target.value;
                          let typedVal: string | number | boolean = rawVal;
                          if (rawVal.toLowerCase() === 'true') typedVal = true;
                          else if (rawVal.toLowerCase() === 'false') typedVal = false;
                          else if (!isNaN(Number(rawVal)) && rawVal.trim() !== '') typedVal = Number(rawVal);
                          if (typedVal !== val) {
                            updateNodeParameter(selectedNode.id, key, typedVal);
                          }
                        }}
                        placeholder="Value"
                        className="w-1/2 font-mono text-[11px] text-slate-900 bg-white border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        title="Parameter Value"
                      />
                      <button
                        type="button"
                        onClick={() => deleteNodeParameter(selectedNode.id, key)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                        title={`Delete ${key}`}
                        aria-label={`Delete parameter ${key}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">No parameters configured</p>
              )}

              {/* Add New Parameter Form */}
              <form onSubmit={handleAddParameter} className="pt-2 border-t border-slate-100 space-y-1.5">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                  Add Parameter
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={newParamKey}
                    onChange={(e) => setNewParamKey(e.target.value)}
                    placeholder="Name (e.g. threshold)"
                    className="w-1/2 text-xs bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-[11px]"
                  />
                  <input
                    type="text"
                    value={newParamValue}
                    onChange={(e) => setNewParamValue(e.target.value)}
                    placeholder="Value (e.g. 50)"
                    className="w-1/2 text-xs bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-[11px]"
                  />
                  <button
                    type="submit"
                    className="p-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded border border-blue-200 cursor-pointer transition shrink-0"
                    title="Add Parameter"
                    aria-label="Add Parameter"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                {paramError && (
                  <p className="text-[10px] text-rose-600 font-medium">{paramError}</p>
                )}
              </form>
            </div>

            {/* SECTION 4: TAGS SECTION */}
            <div className="border border-slate-200/80 rounded-lg p-3.5 space-y-2.5 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                  <Tag className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Tags</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  {(selectedNode.data.tags ?? []).length} tags
                </span>
              </div>

              {/* Tags Pills List */}
              <div className="flex flex-wrap gap-1.5 min-h-[24px]">
                {selectedNode.data.tags && selectedNode.data.tags.length > 0 ? (
                  selectedNode.data.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200"
                    >
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => removeNodeTag(selectedNode.id, tag)}
                        className="text-emerald-500 hover:text-emerald-800 rounded-full cursor-pointer"
                        aria-label={`Remove tag ${tag}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] text-slate-400 italic">No tags added</span>
                )}
              </div>

              {/* Add Tag Input */}
              <form onSubmit={handleAddTag} className="flex items-center gap-1.5 pt-1">
                <input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  placeholder="New tag..."
                  className="flex-1 text-xs bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  className="px-2 py-1 text-xs font-medium bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded cursor-pointer transition flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add</span>
                </button>
              </form>
            </div>

            {/* SECTION 5: AUDIT METADATA */}
            <div className="border border-slate-200/80 rounded-lg p-3.5 space-y-3 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                  <Activity className="w-3.5 h-3.5 text-purple-600" />
                  <span>Audit Metadata</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  {Object.keys(selectedNode.data.metadata ?? {}).length} entries
                </span>
              </div>

              {/* Metadata Entries */}
              {selectedNode.data.metadata && Object.keys(selectedNode.data.metadata).length > 0 ? (
                <div className="space-y-1.5">
                  {Object.entries(selectedNode.data.metadata).map(([key, val]) => (
                    <div
                      key={`${selectedNode.id}-meta-${key}`}
                      className="flex items-center gap-1.5 p-1.5 bg-slate-50 rounded border border-slate-200/80 text-xs"
                    >
                      <input
                        type="text"
                        defaultValue={key}
                        onBlur={(e) => {
                          const newKey = e.target.value.trim();
                          if (newKey && newKey !== key) {
                            updateNodeMetadata(selectedNode.id, newKey, val, key);
                          }
                        }}
                        placeholder="Key"
                        className="w-1/2 font-mono text-[10px] text-slate-600 bg-white border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        title="Metadata Key"
                      />
                      <input
                        type="text"
                        defaultValue={String(val)}
                        onBlur={(e) => {
                          const rawVal = e.target.value;
                          let typedVal: string | number | boolean = rawVal;
                          if (rawVal.toLowerCase() === 'true') typedVal = true;
                          else if (rawVal.toLowerCase() === 'false') typedVal = false;
                          else if (!isNaN(Number(rawVal)) && rawVal.trim() !== '') typedVal = Number(rawVal);
                          if (typedVal !== val) {
                            updateNodeMetadata(selectedNode.id, key, typedVal);
                          }
                        }}
                        placeholder="Value"
                        className="w-1/2 font-mono text-[10px] text-slate-900 bg-white border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        title="Metadata Value"
                      />
                      <button
                        type="button"
                        onClick={() => deleteNodeMetadata(selectedNode.id, key)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                        title={`Delete ${key}`}
                        aria-label={`Delete metadata ${key}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">No metadata configured</p>
              )}

              {/* Add New Metadata Form */}
              <form onSubmit={handleAddMetadata} className="pt-2 border-t border-slate-100 space-y-1.5">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                  Add Metadata Entry
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={newMetaKey}
                    onChange={(e) => setNewMetaKey(e.target.value)}
                    placeholder="Key"
                    className="w-1/2 text-xs bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-[11px]"
                  />
                  <input
                    type="text"
                    value={newMetaValue}
                    onChange={(e) => setNewMetaValue(e.target.value)}
                    placeholder="Value"
                    className="w-1/2 text-xs bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-[11px]"
                  />
                  <button
                    type="submit"
                    className="p-1 bg-purple-50 text-purple-600 hover:bg-purple-100 rounded border border-purple-200 cursor-pointer transition shrink-0"
                    title="Add Metadata"
                    aria-label="Add Metadata"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                {metaError && (
                  <p className="text-[10px] text-rose-600 font-medium">{metaError}</p>
                )}
              </form>
            </div>

            {/* SECTION 6: NODE OPERATIONS (Day 6 feature preserved) */}
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
              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <button
                  type="button"
                  onClick={() => requestDeleteNode(selectedNode.id)}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold cursor-pointer transition shadow-2xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Node</span>
                </button>

                {/* Day 8: Delete Subtree (active when node has child branches) */}
                {edges.some((e) => e.source === selectedNode.id) && (
                  <button
                    type="button"
                    onClick={() => deleteSubtree(selectedNode.id)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold cursor-pointer transition shadow-2xs"
                    title="Delete this node and all connected descendants"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-amber-600" />
                    <span>Delete Subtree</span>
                  </button>
                )}

                <p className="text-[10px] text-slate-400 text-center mt-1">
                  Or press <kbd className="font-mono bg-slate-100 px-1 py-0.5 rounded border border-slate-200 text-slate-600">Delete</kbd> / <kbd className="font-mono bg-slate-100 px-1 py-0.5 rounded border border-slate-200 text-slate-600">Backspace</kbd>
                </p>
              </div>
            </div>

            {/* SECTION 7: HIERARCHY & RE-PARENTING (Day 6 preserved) */}
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
          </div>
        ) : selectedEdge ? (
          /* Selected Edge Information (Day 5/6 preserved) */
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
                Select a node or connection line from the tree to edit its properties.
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
                Live Synchronization:
              </span>
              Modifications to labels, rule IDs, descriptions, parameters, and classifications update the graph in real-time.
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-100 bg-slate-50 text-[10px] text-slate-400 text-center">
        Day 7 • Production Properties Inspector & Live Sync
      </div>
    </aside>
  );
};
