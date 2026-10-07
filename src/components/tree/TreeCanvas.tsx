'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
  useViewport,
  applyNodeChanges,
  type NodeChange,
  type OnNodesChange,
  type NodeProps,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Grid,
  FolderTree,
} from 'lucide-react';
import { useTreeStore } from '../../store/treeStore';
import { isPolicyNodeType } from '../../lib/nodeFactory';
import { getNodeTypeConfig } from '../../lib/nodeTypeConfig';
import type { TreeNode } from '../../types/tree';

import { CustomNode } from './CustomNode';

const nodeTypes = {
  root: CustomNode,
  rule: CustomNode,
  condition: CustomNode,
  action: CustomNode,
};

/**
 * Inner canvas component utilizing React Flow hooks.
 */
const TreeCanvasInner: React.FC = () => {
  const { nodes, edges, selectedNodeId, setSelectedNodeId, setNodes, createNode } = useTreeStore();
  const { zoomIn, zoomOut, fitView, setViewport, screenToFlowPosition } = useReactFlow();

  // Reactive viewport coordinates and zoom from React Flow
  const { x, y, zoom } = useViewport();

  // Validate that viewport values are finite numbers (prevents SVG NaN attribute errors)
  const isViewportValid =
    Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(zoom) && zoom > 0;
  const currentZoom = isViewportValid ? zoom : 1;

  // Transient UI states for canvas (not persisted, not in undo history)
  const [gridVisible, setGridVisible] = useState(true);
  const [ariaFeedback, setAriaFeedback] = useState<string>('');

  // Sync selectedNodeId with React Flow selected state
  const flowNodes = useMemo(() => {
    return nodes.map((node) => ({
      ...node,
      selected: node.id === selectedNodeId,
    }));
  }, [nodes, selectedNodeId]);

  // Handle position changes when dragging nodes on canvas
  const onNodesChange: OnNodesChange<TreeNode> = useCallback(
    (changes: NodeChange<TreeNode>[]) => {
      // Filter out node deletion - Day 4 does not implement node deletion
      const safeChanges = changes.filter((c) => c.type !== 'remove');
      if (safeChanges.length === 0) return;
      const updated = applyNodeChanges(safeChanges, nodes) as TreeNode[];
      setNodes(updated);
    },
    [nodes, setNodes]
  );

  // Fit View handler with safety check
  const handleFitView = useCallback(() => {
    if (nodes.length > 0) {
      fitView({ padding: 0.25, duration: 300 });
    }
  }, [nodes.length, fitView]);

  // Reset View handler - Restores initial viewport ONLY without mutating document state
  const handleResetView = useCallback(() => {
    if (nodes.length > 0) {
      fitView({ padding: 0.25, duration: 300 });
    } else {
      setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 300 });
    }
  }, [nodes.length, fitView, setViewport]);

  // HTML5 Drag-and-Drop Handlers for Node Creation (Day 4)
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      // 1. Extract and validate runtime drag data using runtime type guard
      const rawType = event.dataTransfer.getData('application/reactflow');
      if (!isPolicyNodeType(rawType)) {
        setAriaFeedback('Node was not added. Invalid node type.');
        return;
      }

      // 2. React Flow screen-to-flow coordinate conversion
      const flowPosition = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // 3. Coordinate validation (prevent NaN, Infinity)
      if (!Number.isFinite(flowPosition.x) || !Number.isFinite(flowPosition.y)) {
        setAriaFeedback('Node was not added. Invalid drop coordinates.');
        return;
      }

      // 4. Centralized createNode action in Zustand store
      const createdNode = createNode(rawType, flowPosition);
      if (createdNode) {
        const typeConfig = getNodeTypeConfig(rawType);
        setAriaFeedback(`${typeConfig.displayLabel} added to the canvas.`);
      }
    },
    [screenToFlowPosition, createNode]
  );

  return (
    <div className="w-full h-full relative overflow-hidden bg-slate-50/60 select-none">
      {/* Live Accessibility Status Announcement */}
      <div className="sr-only" role="status" aria-live="polite">
        {ariaFeedback}
      </div>

      {/* React Flow Graph Canvas */}
      <ReactFlow
        nodes={flowNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={(_, node) => setSelectedNodeId(node.id)}
        onPaneClick={() => setSelectedNodeId(null)}
        onDragOver={onDragOver}
        onDrop={onDrop}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        fitView
        fitViewOptions={{ padding: 0.25, minZoom: 0.2, maxZoom: 1.5 }}
        minZoom={0.2}
        maxZoom={2}
        panOnDrag={true}
        selectionOnDrag={false}
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
        deleteKeyCode={null}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { stroke: '#94a3b8', strokeWidth: 1.5 },
        }}
        proOptions={{ hideAttribution: true }}
      >
        {/* Toggleable Canvas Grid Background (Rendered only when viewport numbers are valid and finite) */}
        {gridVisible && isViewportValid && (
          <Background
            color="#cbd5e1"
            gap={20}
            size={1}
            variant={BackgroundVariant.Dots}
          />
        )}
      </ReactFlow>

      {/* Empty State when no nodes exist */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 px-4">
          <div className="bg-white/95 backdrop-blur-xs border border-slate-200 rounded-lg p-6 shadow-sm text-center max-w-sm pointer-events-auto">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <FolderTree className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-800">
              Drag a node from the left to get started.
            </p>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Drop a node onto the canvas to begin building your tree.
            </p>
          </div>
        </div>
      )}

      {/* Floating Canvas Controls (Day 2 requirements) */}
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-white/95 backdrop-blur-xs border border-slate-200 rounded-lg shadow-sm px-2 py-1.5 flex items-center gap-1 text-xs select-none"
        role="toolbar"
        aria-label="Canvas Navigation Controls"
      >
        {/* Zoom Out */}
        <button
          type="button"
          onClick={() => zoomOut({ duration: 250 })}
          className="p-1.5 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 transition"
          aria-label="Zoom out"
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        {/* Current Zoom Indicator */}
        <span
          className="px-2 text-[11px] font-mono text-slate-600 min-w-[44px] text-center select-none"
          aria-live="polite"
          aria-label={`Current zoom: ${Math.round(currentZoom * 100)} percent`}
        >
          {Math.round(currentZoom * 100)}%
        </span>

        {/* Zoom In */}
        <button
          type="button"
          onClick={() => zoomIn({ duration: 250 })}
          className="p-1.5 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 transition"
          aria-label="Zoom in"
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <div className="w-px h-4 bg-slate-200 mx-0.5" />

        {/* Fit View */}
        <button
          type="button"
          onClick={handleFitView}
          className="p-1.5 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 transition"
          aria-label="Fit view"
          title="Fit view (centers all nodes within viewport)"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        {/* Reset View */}
        <button
          type="button"
          onClick={handleResetView}
          className="p-1.5 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 transition"
          aria-label="Reset view"
          title="Reset view (restores default canvas position without modifying tree data)"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <div className="w-px h-4 bg-slate-200 mx-0.5" />

        {/* Grid Toggle */}
        <button
          type="button"
          onClick={() => setGridVisible((prev) => !prev)}
          className={`p-1.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 transition ${
            gridVisible
              ? 'text-blue-600 bg-blue-50/80 hover:bg-blue-100/80 border border-blue-200/60'
              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 border border-transparent'
          }`}
          aria-label={gridVisible ? 'Hide grid background' : 'Show grid background'}
          aria-pressed={gridVisible}
          title={gridVisible ? 'Grid: Enabled (click to hide)' : 'Grid: Disabled (click to show)'}
        >
          <Grid className="w-4 h-4" />
        </button>
      </div>

      {/* Mock Compliance Disclaimer (Persistent Subtle Note) */}
      <div className="absolute top-2.5 right-4 z-10 hidden sm:block pointer-events-none">
        <span className="text-[10px] text-slate-400 bg-white/80 backdrop-blur-2xs border border-slate-200/70 px-2 py-0.5 rounded shadow-2xs">
          Mock sample data • Does not represent official regulatory workflows
        </span>
      </div>
    </div>
  );
};

/**
 * Reusable TreeCanvas component wrapped in ReactFlowProvider.
 * Isolated from page-level layout logic.
 */
export const TreeCanvas: React.FC = () => {
  return (
    <ReactFlowProvider>
      <TreeCanvasInner />
    </ReactFlowProvider>
  );
};
