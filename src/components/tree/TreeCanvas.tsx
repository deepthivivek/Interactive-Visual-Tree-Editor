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
  MiniMap,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Grid,
  Map as MapIcon,
  Keyboard,
  FolderTree,
  AlertCircle,
  X,
  Trash2,
  Workflow,
  ShieldCheck,
  Bookmark,
  Copy,
} from 'lucide-react';
import { useTreeStore } from '../../store/treeStore';
import { isPolicyNodeType } from '../../lib/nodeFactory';
import { getNodeTypeConfig } from '../../lib/nodeTypeConfig';
import { validateConnection } from '../../lib/connectionValidation';
import {
  isKeyboardEventTargetProtected,
  resolveKeyboardAction,
  resolveUndoRedoAction,
  resolveCanvasKeyboardAction,
  computeNudgedPosition,
  getNextSelectedNodeId,
} from '../../lib/keyboardSafety';
import { StatusTimerManager } from '../../lib/statusTimer';
import type { TreeNode, TreeEdge } from '../../types/tree';
import { computeVisibleGraph } from '../../lib/visibility';
import { getSubtreeNodeIds, getSubtreeEdges } from '../../lib/subtree';
import { computeNodesBoundingBox } from '../../lib/layoutProductivity';
import { findNodesInSelectionBox } from '../../lib/selectionBox';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { GraphDiagnosticsModal } from './GraphDiagnosticsModal';
import { CheckpointsModal } from './CheckpointsModal';
import { ValidationPanel } from './ValidationPanel';
import { ContextMenu } from './ContextMenu';

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
    startNodeDrag,
    stopNodeDrag,
    copySubtree,
    pasteSubtree,
    duplicateSubtree,
    toggleNodeCollapse,
    deleteSingleNode,
    deleteSubtree,
    setNodeContextMenu,
    setPaneContextMenu,
    closeAllContextMenus,
    selectedNodeIds,
    setSelectedNodeIds,
    copySelectedNodes,
    deleteSelectedNodes,
  } = useTreeStore();
  const { zoomIn, zoomOut, fitView, setViewport, screenToFlowPosition, setCenter } =
    useReactFlow();

  // Reactive viewport coordinates and zoom from React Flow
  const { x, y, zoom } = useViewport();

  // Validate that viewport values are finite numbers (prevents SVG NaN attribute errors)
  const isViewportValid =
    Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(zoom) && zoom > 0;
  const currentZoom = isViewportValid ? zoom : 1;

  // Transient UI states for canvas (not persisted, not in undo history)
  const [gridVisible, setGridVisible] = useState(true);
  const [miniMapVisible, setMiniMapVisible] = useState(true);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const [diagnosticsModalOpen, setDiagnosticsModalOpen] = useState(false);
  const [checkpointsModalOpen, setCheckpointsModalOpen] = useState(false);
  const [validationPanelOpen, setValidationPanelOpen] = useState(false);
  const [ariaFeedback, setAriaFeedback] = useState<string>('');
  const [connectionFeedback, setConnectionFeedback] = useState<string | null>(null);

  // Drag-box (rubber-band) multi-selection state
  const [isBoxSelecting, setIsBoxSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const boxStartFlowPosRef = useRef<{ x: number; y: number } | null>(null);
  const didBoxSelectRef = useRef(false);

  const mouseFlowPosRef = useRef<{ x: number; y: number } | null>(null);
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      mouseFlowPosRef.current = pos;
    },
    [screenToFlowPosition]
  );

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

  // Day 12 Subtree Visibility: compute which nodes/edges are visible based on collapsed states
  const { visibleNodes, visibleEdges } = useMemo(() => {
    return computeVisibleGraph(nodes, edges);
  }, [nodes, edges]);

  // Sync selectedNodeId and selectedNodeIds with React Flow selected state
  const flowNodes = useMemo(() => {
    const rawIds = selectedNodeIds as unknown;
    const selectedSet = new Set<string>(
      Array.isArray(rawIds)
        ? (rawIds as string[])
        : rawIds instanceof Set
        ? Array.from(rawIds as Set<string>)
        : []
    );
    if (selectedNodeId) {
      selectedSet.add(selectedNodeId);
    }
    return visibleNodes.map((node) => ({
      ...node,
      selected: selectedSet.has(node.id),
    }));
  }, [visibleNodes, selectedNodeId, selectedNodeIds]);

  // Map edges to include dynamic selected styling and direction arrow markers
  const flowEdges = useMemo(() => {
    return visibleEdges.map((edge) => {
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
  }, [visibleEdges, selectedEdgeId]);

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
    (e: React.MouseEvent, node: TreeNode) => {
      closeAllContextMenus();
      const additive = e.ctrlKey || e.metaKey || e.shiftKey;
      if (additive) {
        useTreeStore.getState().toggleNodeSelection(node.id, true);
      } else {
        setSelectedNodeId(node.id);
        setSelectedEdgeId(null);
      }
    },
    [setSelectedNodeId, setSelectedEdgeId, closeAllContextMenus]
  );

  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, edge: TreeEdge) => {
      closeAllContextMenus();
      setSelectedEdgeId(edge.id);
      setSelectedNodeId(null);
    },
    [setSelectedEdgeId, setSelectedNodeId, closeAllContextMenus]
  );

  const handlePaneClick = useCallback(() => {
    closeAllContextMenus();
    if (didBoxSelectRef.current) {
      didBoxSelectRef.current = false;
      return;
    }
    clearSelection();
  }, [clearSelection, closeAllContextMenus]);

  // Drag-box multi-selection event handlers on pane
  const handlePaneMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only initiate box select on primary left click when clicking background pane (not interactive widgets, menus, or dialogs)
      const target = e.target as HTMLElement | null;
      if (
        e.button !== 0 ||
        !target ||
        target.closest('.react-flow__node') ||
        target.closest('.react-flow__controls') ||
        target.closest('[role="menu"]') ||
        target.closest('.context-menu') ||
        target.closest('[role="alertdialog"]') ||
        target.closest('[role="dialog"]')
      ) {
        return;
      }
      closeAllContextMenus();
      const rect = e.currentTarget.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;
      const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });

      boxStartFlowPosRef.current = flowPos;
      didBoxSelectRef.current = false;
      setIsBoxSelecting(true);
      setSelectionBox({ startX: clientX, startY: clientY, endX: clientX, endY: clientY });
    },
    [screenToFlowPosition, closeAllContextMenus]
  );

  const handlePaneMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isBoxSelecting || !boxStartFlowPosRef.current) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      setSelectionBox((prev) => (prev ? { ...prev, endX: clientX, endY: clientY } : null));

      if (selectionBox) {
        const deltaX = Math.abs(clientX - selectionBox.startX);
        const deltaY = Math.abs(clientY - selectionBox.startY);
        if (deltaX > 5 || deltaY > 5) {
          didBoxSelectRef.current = true;
        }
      }

      // Calculate matching nodes in box
      const currentFlowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const startPos = boxStartFlowPosRef.current;

      const matchedIds = findNodesInSelectionBox(
        {
          startX: startPos.x,
          startY: startPos.y,
          endX: currentFlowPos.x,
          endY: currentFlowPos.y,
        },
        nodes
      );

      setSelectedNodeIds(matchedIds);
    },
    [isBoxSelecting, selectionBox, nodes, screenToFlowPosition, setSelectedNodeIds]
  );

  const handlePaneMouseUp = useCallback(() => {
    if (isBoxSelecting) {
      setIsBoxSelecting(false);
      setSelectionBox(null);
      boxStartFlowPosRef.current = null;
      // Allow pane click cycle to complete without clearing box selection
      setTimeout(() => {
        didBoxSelectRef.current = false;
      }, 100);
    }
  }, [isBoxSelecting]);

  // Day 8 Node Drag Transaction Handlers
  const handleNodeDragStart = useCallback(() => {
    startNodeDrag();
  }, [startNodeDrag]);

  const handleNodeDragStop = useCallback(() => {
    stopNodeDrag();
  }, [stopNodeDrag]);

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

  // Day 10 Auto-Layout handler & viewport fitting
  const [isLayoutBusy, setIsLayoutBusy] = useState(false);
  const layoutPendingFitRef = useRef(false);

  const handleAutoLayout = useCallback(() => {
    if (isLayoutBusy || nodes.length === 0) return;
    setIsLayoutBusy(true);

    try {
      const result = useTreeStore.getState().applyAutoLayout();
      if (result.ok && !result.noop) {
        layoutPendingFitRef.current = true;
      } else {
        setIsLayoutBusy(false);
      }
    } catch {
      setIsLayoutBusy(false);
    }
  }, [nodes.length, isLayoutBusy]);

  // Viewport fitting effect triggered ONLY after React Flow has rendered updated node positions
  useEffect(() => {
    if (!layoutPendingFitRef.current) return;
    layoutPendingFitRef.current = false;

    // Allow React Flow to process setNodes and update internal nodeLookup before computing bounds
    const timer = setTimeout(() => {
      requestAnimationFrame(() => {
        const prefersReducedMotion =
          typeof window !== 'undefined' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        fitView({
          padding: 0.2,
          maxZoom: 1,
          duration: prefersReducedMotion ? 0 : 300,
        }).finally(() => {
          setIsLayoutBusy(false);
        });
      });
    }, 50);

    return () => {
      clearTimeout(timer);
    };
  }, [nodes, fitView]);

  // Global keyboard listener enforcing Day 6 actions, Day 8 Undo/Redo & Day 11 canvas navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const state = useTreeStore.getState();
      const target = event.target as HTMLElement | null;

      // 1. Day 8 Undo / Redo keyboard shortcuts with native input editing protection
      const undoRedoAction = resolveUndoRedoAction({
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        target,
      });

      if (undoRedoAction === 'undo') {
        event.preventDefault();
        state.undo();
        return;
      } else if (undoRedoAction === 'redo') {
        event.preventDefault();
        state.redo();
        return;
      }

      // Extract comprehensive selection list (combines selectedNodeId, selectedNodeIds, and flow node.selected)
      const rawIds = state.selectedNodeIds as unknown;
      const selectedIdList: string[] = Array.isArray(rawIds)
        ? [...(rawIds as string[])]
        : rawIds instanceof Set
        ? Array.from(rawIds as Set<string>)
        : [];
      if (state.selectedNodeId && !selectedIdList.includes(state.selectedNodeId)) {
        selectedIdList.push(state.selectedNodeId);
      }
      for (const n of state.nodes) {
        if (n.selected && !selectedIdList.includes(n.id)) {
          selectedIdList.push(n.id);
        }
      }
      const hasAnySelected = selectedIdList.length > 0;

      // Handle delete confirmation modal keyboard interactions
      if (state.deleteConfirmation && !isKeyboardEventTargetProtected(target)) {
        if (event.key === 'Escape') {
          event.preventDefault();
          state.cancelDeleteNode();
          return;
        }
        if (event.key === 'Enter' || event.key === 'Delete' || event.key === 'Backspace') {
          event.preventDefault();
          state.confirmDeleteNode(event.shiftKey ? 'subtree' : 'single');
          return;
        }
      }

      // 2. Day 6 Core Graph Deletion / Escape actions
      const action = resolveKeyboardAction({
        key: event.key,
        target: {
          tagName: target?.tagName,
          isContentEditable: Boolean(target?.isContentEditable),
          insideNoKey: Boolean(target?.closest?.('.nokey')),
        },
        selection: {
          selectedNodeId: state.selectedNodeId,
          selectedNodeIds: selectedIdList,
          selectedEdgeId: state.selectedEdgeId,
        },
        confirmationOpen: Boolean(state.deleteConfirmation),
      });

      if (action === 'delete-node') {
        event.preventDefault();
        state.deleteSelectedNodes();
        return;
      } else if (action === 'delete-edge') {
        event.preventDefault();
        if (state.selectedEdgeId) {
          const deleted = state.deleteEdge(state.selectedEdgeId);
          if (deleted) {
            setAriaFeedback('Edge deleted.');
          }
        }
        return;
      } else if (action === 'escape') {
        event.preventDefault();
        if (state.deleteConfirmation) {
          state.cancelDeleteNode();
        } else if (state.addChildChoiceOpen) {
          state.setAddChildChoiceOpen(false);
        } else if (hasAnySelected || state.selectedEdgeId) {
          state.clearSelection();
        }
        return;
      }

      // 3. Day 11 Extended Canvas Navigation & Interaction Shortcuts
      const canvasAction = resolveCanvasKeyboardAction({
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        target,
        hasSelectedNode: hasAnySelected,
        selectedNodeCount: selectedIdList.length,
        hasNodes: state.nodes.length > 0,
      });

      if (canvasAction === 'open-shortcuts') {
        event.preventDefault();
        setShortcutsModalOpen(true);
        return;
      }

      if (canvasAction === 'auto-layout') {
        event.preventDefault();
        handleAutoLayout();
        return;
      }

      if (canvasAction === 'fit-view') {
        event.preventDefault();
        handleFitView();
        return;
      }

      if (canvasAction === 'reset-view') {
        event.preventDefault();
        handleResetView();
        return;
      }

      if (canvasAction === 'toggle-minimap') {
        event.preventDefault();
        setMiniMapVisible((v) => !v);
        return;
      }

      if (canvasAction === 'toggle-grid') {
        event.preventDefault();
        setGridVisible((v) => !v);
        return;
      }

      if (canvasAction === 'toggle-diagnostics') {
        event.preventDefault();
        setDiagnosticsModalOpen((v) => !v);
        return;
      }

      if (canvasAction === 'select-all') {
        event.preventDefault();
        state.setSelectedNodeIds(state.nodes.map((n) => n.id));
        return;
      }

      if (canvasAction === 'copy-subtree') {
        event.preventDefault();
        if (selectedIdList.length >= 2) {
          state.copySelectedNodes();
        } else if (selectedIdList.length === 1) {
          state.copySubtree(selectedIdList[0]);
        }
        return;
      }

      if (canvasAction === 'paste-subtree') {
        event.preventDefault();
        const cursorPosition =
          mouseFlowPosRef.current ??
          screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
        state.pasteSubtree(null, { cursorPosition });
        return;
      }

      if (canvasAction === 'duplicate-subtree') {
        event.preventDefault();
        const targetId = selectedIdList[0];
        if (targetId) {
          state.duplicateSubtree(targetId);
        }
        return;
      }

      if (canvasAction === 'delete-subtree') {
        event.preventDefault();
        const targetId = selectedIdList[0];
        if (state.deleteConfirmation) {
          state.confirmDeleteNode('subtree');
        } else if (targetId) {
          state.deleteSubtree(targetId);
        }
        return;
      }

      if (canvasAction === 'toggle-collapse') {
        event.preventDefault();
        const targetId = selectedIdList[0];
        if (targetId) {
          state.toggleNodeCollapse(targetId);
        }
        return;
      }

      if (canvasAction === 'cycle-node-next' || canvasAction === 'cycle-node-prev') {
        event.preventDefault();
        const currentId = selectedIdList[0] ?? null;
        const nextId = getNextSelectedNodeId(
          state.nodes,
          currentId,
          canvasAction === 'cycle-node-next' ? 'next' : 'prev'
        );
        if (nextId) {
          state.setSelectedNodeId(nextId);
          state.setSelectedEdgeId(null);
        }
        return;
      }

      if (canvasAction.startsWith('nudge-node-')) {
        event.preventDefault();
        const direction = canvasAction.replace('nudge-node-', '') as
          | 'up'
          | 'down'
          | 'left'
          | 'right';
        if (selectedIdList.length > 0) {
          const targetIdSet = new Set(selectedIdList);
          state.startNodeDrag();
          state.setNodes(
            state.nodes.map((n) =>
              targetIdSet.has(n.id)
                ? { ...n, position: computeNudgedPosition(n.position, direction, 20) }
                : n
            )
          );
          state.stopNodeDrag();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleAutoLayout, handleFitView, handleResetView, screenToFlowPosition]);

  // Day 11 Custom Event Listeners
  useEffect(() => {
    const handleTriggerLayout = () => {
      handleAutoLayout();
    };
    const handleTriggerShortcuts = () => {
      setShortcutsModalOpen(true);
    };
    const handleTriggerDiagnostics = () => {
      setDiagnosticsModalOpen(true);
    };
    const handleTriggerValidation = () => {
      setValidationPanelOpen((prev) => !prev);
    };
    const handleFocusNode = (e: Event) => {
      const customEvent = e as CustomEvent<{ nodeId: string }>;
      const nodeId = customEvent.detail?.nodeId;
      if (nodeId) {
        const targetNode = useTreeStore.getState().nodes.find((n) => n.id === nodeId);
        if (targetNode) {
          setCenter(targetNode.position.x + 120, targetNode.position.y + 40, {
            zoom: 1,
            duration: 350,
          });
        }
      }
    };

    window.addEventListener('tree:trigger-autolayout', handleTriggerLayout);
    window.addEventListener('tree:trigger-shortcuts', handleTriggerShortcuts);
    window.addEventListener('tree:trigger-diagnostics', handleTriggerDiagnostics);
    window.addEventListener('tree:trigger-validation', handleTriggerValidation);
    window.addEventListener('tree:focus-node', handleFocusNode);

    return () => {
      window.removeEventListener('tree:trigger-autolayout', handleTriggerLayout);
      window.removeEventListener('tree:trigger-shortcuts', handleTriggerShortcuts);
      window.removeEventListener('tree:trigger-diagnostics', handleTriggerDiagnostics);
      window.removeEventListener('tree:trigger-validation', handleTriggerValidation);
      window.removeEventListener('tree:focus-node', handleFocusNode);
    };
  }, [handleAutoLayout, setCenter]);

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
    <div
      className="w-full h-full relative overflow-hidden bg-slate-50/60 select-none"
      onMouseDown={handlePaneMouseDown}
      onMouseMove={handlePaneMouseMove}
      onMouseUp={handlePaneMouseUp}
    >
      {/* Rubber-band drag selection box SVG overlay */}
      {isBoxSelecting && selectionBox && (() => {
        const x = Math.min(selectionBox.startX, selectionBox.endX);
        const y = Math.min(selectionBox.startY, selectionBox.endY);
        const width = Math.abs(selectionBox.endX - selectionBox.startX);
        const height = Math.abs(selectionBox.endY - selectionBox.startY);
        return (
          <div
            className="absolute z-40 pointer-events-none border border-blue-500 bg-blue-500/10 rounded-xs"
            style={{ left: x, top: y, width, height }}
          />
        );
      })()}

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

              <div className="mt-5 flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 flex-wrap">
                <button
                  type="button"
                  onClick={cancelDeleteNode}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => confirmDeleteNode('single')}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md transition cursor-pointer"
                >
                  Delete Node Only
                </button>
                {deleteConfirmation.descendantCount && deleteConfirmation.descendantCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => confirmDeleteNode('subtree')}
                    className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-md shadow-xs transition cursor-pointer"
                  >
                    Delete Subtree ({deleteConfirmation.descendantCount + 1} nodes)
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        );
      })()}

      {/* React Flow Graph Canvas */}
      <ReactFlow
        className="w-full h-full"
        style={{ width: '100%', height: '100%' }}
        onMouseMove={handleMouseMove}
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStart={handleNodeDragStart}
        onNodeDragStop={handleNodeDragStop}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        onNodeContextMenu={(event, node) => {
          event.preventDefault();
          event.stopPropagation();
          setSelectedNodeId(node.id);
          setSelectedEdgeId(null);
          setNodeContextMenu({
            isOpen: true,
            x: event.clientX,
            y: event.clientY,
            nodeId: node.id,
          });
        }}
        onPaneContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const flowPos = screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          });
          setPaneContextMenu({
            isOpen: true,
            x: event.clientX,
            y: event.clientY,
            flowPosition: flowPos,
          });
        }}
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
        multiSelectionKeyCode={['Control', 'Meta']}
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

        {/* Toggleable MiniMap Overview (Day 11) */}
        {miniMapVisible && (
          <MiniMap
            nodeColor={(n) => {
              const node = n as unknown as TreeNode;
              switch (node.type) {
                case 'root':
                  return '#2563eb';
                case 'rule':
                  return '#6366f1';
                case 'condition':
                  return '#f59e0b';
                case 'action':
                  return '#10b981';
                default:
                  return '#94a3b8';
              }
            }}
            nodeStrokeWidth={2}
            nodeBorderRadius={4}
            maskColor="rgba(241, 245, 249, 0.7)"
            position="bottom-right"
            className="!bg-white/95 !border !border-slate-200 !rounded-lg !shadow-md backdrop-blur-xs mb-3 mr-3"
            ariaLabel="MiniMap overview of tree structure"
            zoomable
            pannable
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

        {/* Auto Layout (Day 10) */}
        <button
          type="button"
          onClick={handleAutoLayout}
          disabled={nodes.length === 0 || isLayoutBusy}
          aria-busy={isLayoutBusy}
          className="p-1.5 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 transition"
          aria-label="Auto Layout"
          title="Auto Layout (arranges tree in hierarchical top-to-bottom layout)"
        >
          <Workflow className="w-4 h-4" />
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
          title={gridVisible ? 'Grid: Enabled (click to hide) [Ctrl+G]' : 'Grid: Disabled (click to show) [Ctrl+G]'}
        >
          <Grid className="w-4 h-4" />
        </button>

        {/* MiniMap Toggle (Day 11) */}
        <button
          type="button"
          onClick={() => setMiniMapVisible((prev) => !prev)}
          className={`p-1.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 transition ${
            miniMapVisible
              ? 'text-blue-600 bg-blue-50/80 hover:bg-blue-100/80 border border-blue-200/60'
              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 border border-transparent'
          }`}
          aria-label={miniMapVisible ? 'Hide MiniMap' : 'Show MiniMap'}
          aria-pressed={miniMapVisible}
          title={miniMapVisible ? 'MiniMap: Enabled (click to hide) [Ctrl+M]' : 'MiniMap: Disabled (click to show) [Ctrl+M]'}
        >
          <MapIcon className="w-4 h-4" />
        </button>

        <div className="w-px h-4 bg-slate-200 mx-0.5" />

        {/* Keyboard Shortcuts Trigger (Day 11) */}
        <button
          type="button"
          onClick={() => setShortcutsModalOpen(true)}
          className="p-1.5 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 transition"
          aria-label="Keyboard Shortcuts"
          title="Keyboard Shortcuts [?]"
        >
          <Keyboard className="w-4 h-4" />
        </button>

        <div className="w-px h-4 bg-slate-200 mx-0.5" />

        {/* Checkpoints Trigger (Day 13) */}
        <button
          type="button"
          onClick={() => setCheckpointsModalOpen(true)}
          className="p-1.5 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 transition"
          aria-label="Graph Checkpoints"
          title="Named Graph Checkpoints"
        >
          <Bookmark className="w-4 h-4" />
        </button>
      </div>

      {/* Checkpoints Modal (Day 13) */}
      <CheckpointsModal
        isOpen={checkpointsModalOpen}
        onClose={() => setCheckpointsModalOpen(false)}
      />

      {/* Keyboard Shortcuts Reference Dialog (Day 11) */}
      <KeyboardShortcutsModal
        isOpen={shortcutsModalOpen}
        onClose={() => setShortcutsModalOpen(false)}
      />

      {/* Graph Diagnostics Modal (Day 11) */}
      <GraphDiagnosticsModal
        isOpen={diagnosticsModalOpen}
        onClose={() => setDiagnosticsModalOpen(false)}
        onFocusNode={(nodeId) => {
          const targetNode = nodes.find((n) => n.id === nodeId);
          if (targetNode) {
            setCenter(targetNode.position.x + 120, targetNode.position.y + 40, {
              zoom: 1,
              duration: 350,
            });
          }
        }}
      />

      {/* Graph Validation & Quality Panel (Day 14) */}
      <ValidationPanel
        isOpen={validationPanelOpen}
        onClose={() => setValidationPanelOpen(false)}
        onFocusNode={(nodeId) => {
          const targetNode = nodes.find((n) => n.id === nodeId);
          if (targetNode) {
            setCenter(targetNode.position.x + 120, targetNode.position.y + 40, {
              zoom: 1,
              duration: 350,
            });
          }
        }}
      />

      {/* Mock Compliance Disclaimer (Persistent Subtle Note) */}
      <div className="absolute top-2.5 right-4 z-10 hidden sm:block pointer-events-none">
        <span className="text-[10px] text-slate-400 bg-white/80 backdrop-blur-2xs border border-slate-200/70 px-2 py-0.5 rounded shadow-2xs">
          Mock sample data • Does not represent official regulatory workflows
        </span>
      </div>

      {/* Floating Multi-Selection Action Toolbar */}
      {(() => {
        const rawIds = selectedNodeIds as unknown;
        const count = Array.isArray(rawIds)
          ? rawIds.length
          : rawIds instanceof Set
          ? rawIds.size
          : 0;
        if (count < 2) return null;

        return (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-xl rounded-xl px-4 py-2.5 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
            <div className="flex items-center gap-2 pr-2 border-r border-slate-200">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-semibold text-xs">
                {count}
              </span>
              <span className="text-xs font-medium text-slate-700 whitespace-nowrap">
                nodes selected
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => copySelectedNodes()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 transition shadow-2xs"
                title="Copy all selected nodes [Ctrl+C]"
              >
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Copy Selected</span>
              </button>

              <button
                type="button"
                onClick={() => deleteSelectedNodes()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 transition shadow-2xs"
                title="Delete all selected nodes [Del]"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                <span>Delete Selected</span>
              </button>

              <button
                type="button"
                onClick={() => clearSelection()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 transition"
                title="Deselect all nodes"
              >
                <X className="w-3.5 h-3.5 text-slate-400" />
                <span>Clear</span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* Accessible Context Menu for Nodes and Canvas Pane (Day 12) */}
      <ContextMenu onFitView={handleFitView} onResetView={handleResetView} />
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
