'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
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
  type Connection,
  type OnConnect,
  type OnReconnect,
  type EdgeChange,
  type OnEdgesChange,
  type FinalConnectionState,
  type HandleType,
  ConnectionMode,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Grid,
  FolderTree,
  AlertCircle,
  X,
  Trash2,
} from 'lucide-react';
import { useTreeStore } from '../../store/treeStore';
import { isPolicyNodeType } from '../../lib/nodeFactory';
import { getNodeTypeConfig } from '../../lib/nodeTypeConfig';
import { validateConnection } from '../../lib/connectionValidation';
import { isKeyboardEventTargetProtected, resolveKeyboardAction } from '../../lib/keyboardSafety';
import { StatusTimerManager } from '../../lib/statusTimer';
import type { TreeNode, TreeEdge } from '../../types/tree';

import { CustomNode } from './CustomNode';

export { isKeyboardEventTargetProtected };

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
  const {
    nodes,
    edges,
    selectedNodeId,
    selectedEdgeId,
    deleteConfirmation,
    addChildChoiceOpen,
    statusFeedback,
    setSelectedNodeId,
    setSelectedEdgeId,
    clearSelection,
    setNodes,
    createNode,
    addEdgeConnection,
    reconnectEdgeConnection,
    deleteEdge,
    requestDeleteNode,
    confirmDeleteNode,
    cancelDeleteNode,
    setAddChildChoiceOpen,
    setStatusFeedback,
  } = useTreeStore();
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
  const [connectionFeedback, setConnectionFeedback] = useState<string | null>(null);

  // Ref tracking edge currently undergoing reconnection to support ignoreEdgeId during live validation
  const reconnectingEdgeIdRef = useRef<string | null>(null);

  // Status message timer manager (Day 6 Task J)
  const statusTimerRef = useRef<StatusTimerManager | null>(null);

  useEffect(() => {
    statusTimerRef.current = new StatusTimerManager({
      durationMs: 4500,
      onClear: () => {
        useTreeStore.getState().setStatusFeedback(null);
        setConnectionFeedback(null);
      },
    });

    return () => {
      statusTimerRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (statusFeedback || connectionFeedback) {
      statusTimerRef.current?.schedule();
    } else {
      statusTimerRef.current?.cancel();
    }
  }, [statusFeedback, connectionFeedback]);

  // Sync selectedNodeId with React Flow selected state
  const flowNodes = useMemo(() => {
    return nodes.map((node) => ({
      ...node,
      selected: node.id === selectedNodeId,
    }));
  }, [nodes, selectedNodeId]);

  // Map edges to include dynamic selected styling and direction arrow markers
  const flowEdges = useMemo(() => {
    return edges.map((edge) => {
      const isSelected = edge.id === selectedEdgeId;
      return {
        ...edge,
        selected: isSelected,
        style: isSelected
          ? { stroke: '#2563eb', strokeWidth: 2.5 }
          : { stroke: '#94a3b8', strokeWidth: 1.5 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 14,
          height: 14,
          color: isSelected ? '#2563eb' : '#94a3b8',
        },
        interactionWidth: 20,
      };
    });
  }, [edges, selectedEdgeId]);

  // Handle position changes when dragging nodes on canvas
  const onNodesChange: OnNodesChange<TreeNode> = useCallback(
    (changes: NodeChange<TreeNode>[]) => {
      // Day 5 Node Deletion Protection: filter out node removal changes strictly
      const safeChanges = changes.filter((c) => c.type !== 'remove');
      if (safeChanges.length === 0) return;
      const updated = applyNodeChanges(safeChanges, nodes) as TreeNode[];
      setNodes(updated);
    },
    [nodes, setNodes]
  );

  // Handle edge changes from React Flow selection or removals
  const onEdgesChange: OnEdgesChange<TreeEdge> = useCallback(
    (changes: EdgeChange<TreeEdge>[]) => {
      for (const change of changes) {
        if (change.type === 'remove') {
          deleteEdge(change.id);
        } else if (change.type === 'select') {
          if (change.selected) {
            setSelectedEdgeId(change.id);
            setSelectedNodeId(null);
          } else if (selectedEdgeId === change.id) {
            setSelectedEdgeId(null);
          }
        }
      }
    },
    [deleteEdge, setSelectedEdgeId, setSelectedNodeId, selectedEdgeId]
  );

  // Canvas selection click handlers
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: TreeNode) => {
      setSelectedNodeId(node.id);
      setSelectedEdgeId(null);
    },
    [setSelectedNodeId, setSelectedEdgeId]
  );

  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, edge: TreeEdge) => {
      setSelectedEdgeId(edge.id);
      setSelectedNodeId(null);
    },
    [setSelectedEdgeId, setSelectedNodeId]
  );

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, [setSelectedNodeId, setSelectedEdgeId]);

  // Global keyboard listener enforcing Day 6 keyboard actions with input shielding & Escape priority
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const state = useTreeStore.getState();
      const target = event.target as HTMLElement | null;

      const action = resolveKeyboardAction({
        key: event.key,
        target: {
          tagName: target?.tagName,
          isContentEditable: Boolean(target?.isContentEditable),
          insideNoKey: Boolean(target?.closest?.('.nokey')),
        },
        selection: {
          selectedNodeId: state.selectedNodeId,
          selectedEdgeId: state.selectedEdgeId,
        },
        confirmationOpen: Boolean(state.deleteConfirmation),
      });

      if (action === 'delete-node') {
        event.preventDefault();
        if (state.selectedNodeId) {
          state.requestDeleteNode(state.selectedNodeId);
        }
      } else if (action === 'delete-edge') {
        event.preventDefault();
        if (state.selectedEdgeId) {
          const deleted = state.deleteEdge(state.selectedEdgeId);
          if (deleted) {
            setAriaFeedback('Edge deleted.');
          }
        }
      } else if (action === 'escape') {
        event.preventDefault();
        if (state.deleteConfirmation) {
          state.cancelDeleteNode();
        } else if (state.addChildChoiceOpen) {
          state.setAddChildChoiceOpen(false);
        } else if (state.selectedNodeId || state.selectedEdgeId) {
          state.clearSelection();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  /**
   * Live Connection Validation (Day 5 - Side-effect free).
   * Pure evaluation used by React Flow while user drags a connection line over target handles.
   * MUST NOT update store, show toasts, or perform any side-effects.
   * Supports ignoreEdgeId when reconnecting an existing edge.
   */
  const isValidConnection = useCallback(
    (connection: TreeEdge | Connection) => {
      const result = validateConnection(
        {
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle,
          targetHandle: connection.targetHandle,
        },
        nodes,
        edges,
        reconnectingEdgeIdRef.current ? { ignoreEdgeId: reconnectingEdgeIdRef.current } : undefined
      );
      return result.ok;
    },
    [nodes, edges]
  );

  /**
   * Connection Completion Handler (Day 5 - Atomic state mutation).
   * Called by React Flow when a valid connection completes.
   */
  const onConnect: OnConnect = useCallback(
    (connection) => {
      const result = addEdgeConnection({
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
      });

      if (result.ok) {
        setConnectionFeedback(null);
        setAriaFeedback('Connection created successfully.');
      } else {
        setConnectionFeedback(result.message || 'Connection rejected.');
        setAriaFeedback(result.message || 'Connection rejected.');
      }
    },
    [addEdgeConnection]
  );

  /**
   * Connection End Handler (Day 5 - Transient rejection feedback).
   * Surfaces helpful feedback when a user drops a connection onto an invalid target handle.
   * Dropping on empty canvas does NOT produce feedback.
   */
  const onConnectEnd = useCallback(
    (_event: MouseEvent | TouchEvent, connectionState?: {
      fromNode?: { id: string } | null;
      toNode?: { id: string } | null;
      isValid?: boolean | null;
    }) => {
      // Only announce feedback if user attempted connecting to a real node/handle and it was rejected
      if (connectionState?.fromNode && connectionState?.toNode && !connectionState?.isValid) {
        const validation = validateConnection(
          {
            source: connectionState.fromNode.id,
            target: connectionState.toNode.id,
          },
          nodes,
          edges
        );
        if (!validation.ok) {
          setConnectionFeedback(validation.message);
          setAriaFeedback(validation.message);
        }
      }
    },
    [nodes, edges]
  );

  /**
   * Reconnection Handlers (Day 5 Part 2).
   */
  const handleReconnectStart = useCallback((_event: React.MouseEvent, edge: TreeEdge) => {
    reconnectingEdgeIdRef.current = edge.id;
  }, []);

  const handleReconnect: OnReconnect<TreeEdge> = useCallback(
    (oldEdge, newConnection) => {
      const result = reconnectEdgeConnection(oldEdge, {
        source: newConnection.source,
        target: newConnection.target,
        sourceHandle: newConnection.sourceHandle,
        targetHandle: newConnection.targetHandle,
      });

      if (result.ok) {
        setConnectionFeedback(null);
        setAriaFeedback('Connection reconnected successfully.');
      } else {
        setConnectionFeedback(result.message || 'Reconnection rejected.');
        setAriaFeedback(result.message || 'Reconnection rejected.');
      }
      reconnectingEdgeIdRef.current = null;
    },
    [reconnectEdgeConnection]
  );

  const handleReconnectEnd = useCallback(
    (
      _event: MouseEvent | TouchEvent,
      edge: TreeEdge,
      _handleType: HandleType,
      connectionState?: FinalConnectionState
    ) => {
      if (connectionState && !connectionState.isValid && connectionState.toNode) {
        const validation = validateConnection(
          {
            source: connectionState.fromNode?.id ?? edge.source,
            target: connectionState.toNode?.id ?? edge.target,
          },
          nodes,
          edges,
          { ignoreEdgeId: edge.id }
        );
        if (!validation.ok) {
          setConnectionFeedback(validation.message);
          setAriaFeedback(validation.message);
        }
      }
      reconnectingEdgeIdRef.current = null;
    },
    [nodes, edges]
  );

  return (
    <div className="w-full h-full relative overflow-hidden bg-slate-50/60 select-none">
      {/* Live Accessibility Status Announcement */}
      <div className="sr-only" role="status" aria-live="polite">
        {ariaFeedback}
      </div>

      {/* Transient Status & Connection Feedback Banner (Day 6) */}
      {(statusFeedback || connectionFeedback) && (
        <div
          role="status"
          aria-live="polite"
          className="absolute top-3 left-1/2 -translate-x-1/2 z-30 max-w-lg bg-slate-900/90 backdrop-blur-xs text-white px-3.5 py-2 rounded-lg shadow-md text-xs font-medium flex items-center gap-2 select-none transition-all animate-in fade-in slide-in-from-top-2"
        >
          <AlertCircle className="w-4 h-4 text-blue-400 shrink-0" aria-hidden="true" />
          <span className="truncate">{statusFeedback || connectionFeedback}</span>
          <button
            type="button"
            onClick={() => {
              setStatusFeedback(null);
              setConnectionFeedback(null);
            }}
            className="ml-auto text-slate-400 hover:text-white p-0.5 rounded cursor-pointer transition-colors"
            aria-label="Dismiss feedback"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal (Day 6) */}
      {deleteConfirmation && (() => {
        const nodeToDelete = nodes.find((n) => n.id === deleteConfirmation.nodeId);
        return (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            aria-describedby="delete-dialog-description"
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 select-none"
          >
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 border border-slate-200 animate-in fade-in zoom-in-95">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 id="delete-dialog-title" className="text-sm font-semibold text-slate-900">
                    {deleteConfirmation.isRoot ? 'Delete Root Node?' : 'Delete Connected Node?'}
                  </h3>
                  <p id="delete-dialog-description" className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    {deleteConfirmation.isRoot ? (
                      <>
                        You are about to delete <strong className="text-slate-800">{nodeToDelete?.data.label ?? 'Root'}</strong>.
                        {deleteConfirmation.incidentEdgeCount > 0 && (
                          <> This will also remove {deleteConfirmation.incidentEdgeCount} incident connection(s). Child nodes will remain as orphans.</>
                        )}
                      </>
                    ) : (
                      <>
                        Deleting <strong className="text-slate-800">{nodeToDelete?.data.label ?? 'this node'}</strong> will also remove{' '}
                        <strong className="text-slate-800">{deleteConfirmation.incidentEdgeCount} incident connection(s)</strong>.
                        Descendant nodes will remain in the canvas as disconnected nodes.
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={cancelDeleteNode}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteNode}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-md shadow-xs transition cursor-pointer"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* React Flow Graph Canvas */}
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodesConnectable={true}
        edgesReconnectable={true}
        onReconnect={handleReconnect}
        onReconnectStart={handleReconnectStart}
        onReconnectEnd={handleReconnectEnd}
        connectionMode={ConnectionMode.Strict}
        isValidConnection={isValidConnection}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        fitView
        fitViewOptions={{ padding: 0.25, minZoom: 0.2, maxZoom: 1.5 }}
        minZoom={0.2}
        maxZoom={2}
        panOnDrag={true}
        selectionOnDrag={false}
        nodesDraggable={true}
        elementsSelectable={true}
        deleteKeyCode={null}
        defaultEdgeOptions={{
          type: 'smoothstep',
          interactionWidth: 20,
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
