'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  Copy,
  ClipboardPaste,
  Files,
  Trash2,
  GitBranch,
  Layers,
  Shield,
  Zap,
  FolderTree,
  ChevronDown,
  ChevronUp,
  Maximize2,
  RotateCcw,
  Workflow,
  AlertTriangle,
  X,
} from 'lucide-react';
import { useTreeStore } from '../../store/treeStore';
import {
  resolveNodeContextMenuItems,
  resolvePaneContextMenuItems,
  clampMenuPosition,
  type ContextMenuItem,
} from '../../lib/contextMenu';
import { getDescendantCount, getSubtreeNodeIds } from '../../lib/subtree';

interface ContextMenuProps {
  onFitView?: () => void;
  onResetView?: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  onFitView,
  onResetView,
}) => {
  const nodeContextMenu = useTreeStore((state) => state.nodeContextMenu);
  const paneContextMenu = useTreeStore((state) => state.paneContextMenu);
  const closeAllContextMenus = useTreeStore(
    (state) => state.closeAllContextMenus
  );

  const nodes = useTreeStore((state) => state.nodes);
  const edges = useTreeStore((state) => state.edges);
  const clipboard = useTreeStore((state) => state.clipboard);
  const selectedNodeIds = useTreeStore((state) => state.selectedNodeIds);
  const copySelectedNodes = useTreeStore((state) => state.copySelectedNodes);
  const deleteSelectedNodes = useTreeStore((state) => state.deleteSelectedNodes);
  const clearSelection = useTreeStore((state) => state.clearSelection);

  const addChild = useTreeStore((state) => state.addChild);
  const copySubtree = useTreeStore((state) => state.copySubtree);
  const pasteSubtree = useTreeStore((state) => state.pasteSubtree);
  const duplicateSubtree = useTreeStore((state) => state.duplicateSubtree);
  const toggleNodeCollapse = useTreeStore((state) => state.toggleNodeCollapse);
  const deleteSingleNode = useTreeStore((state) => state.deleteSingleNode);
  const requestDeleteNode = useTreeStore((state) => state.requestDeleteNode);
  const deleteSubtree = useTreeStore((state) => state.deleteSubtree);
  const createNode = useTreeStore((state) => state.createNode);
  const setSelectedSubtreeRootId = useTreeStore(
    (state) => state.setSelectedSubtreeRootId
  );

  const menuRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);

  const isNodeMenu = Boolean(nodeContextMenu?.isOpen && nodeContextMenu.nodeId);
  const isPaneMenu = Boolean(paneContextMenu?.isOpen);
  const isOpen = isNodeMenu || isPaneMenu;

  // Resolve items
  const targetNode = isNodeMenu
    ? nodes.find((n) => n.id === nodeContextMenu!.nodeId)
    : undefined;

  const descendantCount = targetNode
    ? getDescendantCount(targetNode.id, edges)
    : 0;

  const isCollapsed = Boolean(targetNode?.data?.collapsed);

  const multiSelectedCount = useMemo(() => {
    const raw = selectedNodeIds as unknown;
    const arr = Array.isArray(raw)
      ? (raw as string[])
      : raw instanceof Set
      ? Array.from(raw as Set<string>)
      : [];
    return arr.length;
  }, [selectedNodeIds]);

  const items: ContextMenuItem[] = useMemo(() => {
    return isNodeMenu && targetNode
      ? resolveNodeContextMenuItems(targetNode, {
          hasClipboard: Boolean(clipboard && clipboard.nodes.length > 0),
          descendantCount,
          isCollapsed,
          multiSelectedCount,
        })
      : isPaneMenu
      ? resolvePaneContextMenuItems({
          hasClipboard: Boolean(clipboard && clipboard.nodes.length > 0),
        })
      : [];
  }, [isNodeMenu, targetNode, isPaneMenu, clipboard, descendantCount, isCollapsed, multiSelectedCount]);

  const targetNodeId = targetNode?.id ?? nodeContextMenu?.nodeId ?? null;

  const executeAction = useCallback(
    (e: React.MouseEvent | React.PointerEvent | null, item: ContextMenuItem, explicitNodeId?: string | null) => {
      e?.stopPropagation();
      const state = useTreeStore.getState();
      const resolvedNodeId = explicitNodeId ?? targetNodeId ?? state.nodeContextMenu?.nodeId ?? null;
      const currentTargetNode = resolvedNodeId
        ? state.nodes.find((n) => n.id === resolvedNodeId) ?? null
        : null;
      const currentPaneMenu = state.paneContextMenu ?? paneContextMenu;

      switch (item.id) {
        case 'add-child-rule':
        case 'add-child-condition':
        case 'add-child-action': {
          if (currentTargetNode && item.childType) {
            state.addChild(currentTargetNode.id, item.childType);
          }
          break;
        }

        case 'select-subtree': {
          if (currentTargetNode) {
            const subtreeIds = Array.from(getSubtreeNodeIds(currentTargetNode.id, state.edges));
            state.setSelectedNodeIds(subtreeIds);
            state.setSelectedSubtreeRootId(currentTargetNode.id);
          }
          break;
        }

        case 'copy-subtree': {
          if (currentTargetNode) {
            state.copySubtree(currentTargetNode.id);
          }
          break;
        }

        case 'paste-subtree-child': {
          if (currentTargetNode) {
            state.pasteSubtree(currentTargetNode.id);
          }
          break;
        }

        case 'paste-subtree-pane': {
          if (currentPaneMenu?.flowPosition) {
            state.pasteSubtree(null, {
              cursorPosition: currentPaneMenu.flowPosition,
            });
          }
          break;
        }

        case 'duplicate-subtree': {
          if (currentTargetNode) {
            state.duplicateSubtree(currentTargetNode.id);
          }
          break;
        }

        case 'toggle-collapse': {
          if (currentTargetNode) {
            state.toggleNodeCollapse(currentTargetNode.id);
          }
          break;
        }

        case 'delete-single': {
          if (currentTargetNode) {
            state.deleteSingleNode(currentTargetNode.id);
          }
          break;
        }

        case 'delete-subtree': {
          if (currentTargetNode) {
            state.deleteSubtree(currentTargetNode.id);
          }
          break;
        }

        case 'copy-selected': {
          state.copySelectedNodes();
          break;
        }

        case 'delete-selected': {
          state.deleteSelectedNodes();
          break;
        }

        case 'clear-selection': {
          state.clearSelection();
          break;
        }

        case 'add-root': {
          if (currentPaneMenu?.flowPosition) {
            state.createNode('root', currentPaneMenu.flowPosition);
          }
          break;
        }

        case 'add-rule': {
          if (currentPaneMenu?.flowPosition) {
            state.createNode('rule', currentPaneMenu.flowPosition);
          }
          break;
        }

        case 'auto-layout': {
          window.dispatchEvent(new CustomEvent('tree:trigger-autolayout'));
          break;
        }

        case 'fit-view': {
          onFitView?.();
          break;
        }

        case 'reset-view': {
          onResetView?.();
          break;
        }
      }

      state.closeAllContextMenus();
    },
    [targetNodeId, paneContextMenu, onFitView, onResetView]
  );

  const itemsRef = useRef(items);
  const focusedIndexRef = useRef(focusedIndex);

  useEffect(() => {
    itemsRef.current = items;
    focusedIndexRef.current = focusedIndex;
  });

  // Reset focus index when opened (using queueMicrotask to avoid sync setState in effect)
  useEffect(() => {
    if (isOpen) {
      queueMicrotask(() => setFocusedIndex(0));
    }
  }, [isOpen]);

  // Click outside and keydown listeners
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeAllContextMenus();
        return;
      }

      const currentItems = itemsRef.current;
      if (currentItems.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => {
          let next = (prev + 1) % currentItems.length;
          while (currentItems[next]?.disabled && next !== prev) {
            next = (next + 1) % currentItems.length;
          }
          return next;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => {
          let next = (prev - 1 + currentItems.length) % currentItems.length;
          while (currentItems[next]?.disabled && next !== prev) {
            next = (next - 1 + currentItems.length) % currentItems.length;
          }
          return next;
        });
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const activeItem = currentItems[focusedIndexRef.current];
        if (activeItem && !activeItem.disabled) {
          executeAction(null, activeItem, targetNodeId);
        }
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (menuRef.current) {
        if (target && menuRef.current.contains(target)) {
          return;
        }
        if (typeof e.composedPath === 'function' && e.composedPath().includes(menuRef.current)) {
          return;
        }
      }
      closeAllContextMenus();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, closeAllContextMenus, executeAction, targetNodeId]);

  if (!isOpen) return null;

  const rawX = isNodeMenu ? nodeContextMenu!.x : paneContextMenu!.x;
  const rawY = isNodeMenu ? nodeContextMenu!.y : paneContextMenu!.y;
  const { x, y } = clampMenuPosition(rawX, rawY);

  const getActionIcon = (id: string) => {
    switch (id) {
      case 'add-child-rule':
        return <Shield className="w-3.5 h-3.5 text-indigo-500" />;
      case 'add-child-condition':
        return <GitBranch className="w-3.5 h-3.5 text-amber-500" />;
      case 'add-child-action':
        return <Zap className="w-3.5 h-3.5 text-emerald-500" />;
      case 'copy-subtree':
      case 'copy-selected':
        return <Copy className="w-3.5 h-3.5 text-slate-500" />;
      case 'paste-subtree-child':
      case 'paste-subtree-pane':
        return <ClipboardPaste className="w-3.5 h-3.5 text-blue-500" />;
      case 'duplicate-subtree':
        return <Files className="w-3.5 h-3.5 text-slate-500" />;
      case 'toggle-collapse':
        return isCollapsed ? (
          <ChevronDown className="w-3.5 h-3.5 text-amber-600" />
        ) : (
          <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
        );
      case 'delete-single':
      case 'delete-subtree':
      case 'delete-selected':
        return <Trash2 className="w-3.5 h-3.5 text-red-500" />;
      case 'clear-selection':
        return <X className="w-3.5 h-3.5 text-slate-400" />;
      case 'add-root':
        return <Layers className="w-3.5 h-3.5 text-blue-500" />;
      case 'add-rule':
        return <Shield className="w-3.5 h-3.5 text-indigo-500" />;
      case 'auto-layout':
        return <Workflow className="w-3.5 h-3.5 text-blue-600" />;
      case 'fit-view':
        return <Maximize2 className="w-3.5 h-3.5 text-slate-500" />;
      case 'reset-view':
        return <RotateCcw className="w-3.5 h-3.5 text-slate-500" />;
      default:
        return null;
    }
  };

  return (
    <>
      {/* Overlay to catch outside clicks */}
      <div className="fixed inset-0 z-40" onClick={closeAllContextMenus} />
      
      <div
        ref={menuRef}
        role="menu"
        aria-label={isNodeMenu ? 'Node context actions' : 'Canvas pane actions'}
        style={{ left: `${x}px`, top: `${y}px` }}
        className="fixed z-50 min-w-[210px] max-w-[280px] bg-white rounded-lg shadow-xl border border-slate-200 py-1 text-xs text-slate-700 animate-in fade-in-0 zoom-in-95 duration-100 select-none font-sans context-menu"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
      {/* Optional header indicating target */}
      {isNodeMenu && targetNode && (
        <div className="px-3 py-1.5 border-b border-slate-100 mb-1 text-[11px] font-semibold text-slate-800 bg-slate-50/70 truncate flex items-center justify-between">
          <span className="truncate max-w-[150px]">
            {targetNode.data?.label || 'Node'}
          </span>
          <span className="text-[10px] text-slate-400 font-normal uppercase tracking-wider">
            {targetNode.type}
          </span>
        </div>
      )}

      {items.map((item, idx) => (
        <React.Fragment key={item.id}>
          <button
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              executeAction(e, item, targetNodeId);
            }}
            onMouseEnter={() => setFocusedIndex(idx)}
            className={`w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors cursor-pointer ${
              item.disabled
                ? 'opacity-40 cursor-not-allowed text-slate-400'
                : item.danger
                ? focusedIndex === idx
                  ? 'bg-red-50 text-red-700'
                  : 'text-red-600 hover:bg-red-50/80'
                : focusedIndex === idx
                ? 'bg-slate-100 text-slate-900 font-medium'
                : 'hover:bg-slate-50 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              {getActionIcon(item.id)}
              <span className="truncate">{item.label}</span>
            </div>
            {item.shortcut && (
              <span className="ml-3 text-[10px] text-slate-400 font-mono">
                {item.shortcut}
              </span>
            )}
          </button>
          {item.separatorAfter && (
            <div className="my-1 border-t border-slate-100" />
          )}
        </React.Fragment>
      ))}
      </div>
    </>
  );
};
