/**
 * Pure type guard to verify if a keyboard event originated from a protected text-editing element
 * or an element annotated with `.nokey`.
 *
 * Protects:
 * - HTMLInputElement (<input>)
 * - HTMLTextAreaElement (<textarea>)
 * - HTMLSelectElement (<select>)
 * - Any element with `contenteditable="true"` or `isContentEditable`
 * - Any element inside a `.nokey` container (Inspector, Header, Sidebar controls)
 *
 * Used by keyboard listeners to allow standard typing, Delete, and Backspace to edit text freely
 * without triggering canvas graph operations (like edge deletion).
 */
export interface ElementLike {
  tagName?: string;
  isContentEditable?: boolean;
  getAttribute?: (attr: string) => string | null;
  closest?: (selector: string) => unknown;
}

export function isKeyboardEventTargetProtected(
  target: EventTarget | ElementLike | null | undefined
): boolean {
  if (!target || typeof target !== 'object') {
    return false;
  }

  const el = target as ElementLike;

  if (typeof el.tagName === 'string') {
    const tag = el.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      return true;
    }
  }

  if (el.isContentEditable === true) {
    return true;
  }

  if (typeof el.getAttribute === 'function' && el.getAttribute('contenteditable') === 'true') {
    return true;
  }

  if (typeof el.closest === 'function' && Boolean(el.closest('.nokey'))) {
    return true;
  }

  return false;
}

/**
 * Supported semantic actions resolved by pure keyboard safety handler (Day 6 Task K).
 */
export type KeyboardAction = 'delete-node' | 'delete-edge' | 'escape' | 'ignore';

export interface KeyboardActionTarget {
  tagName?: string;
  isContentEditable?: boolean;
  insideNoKey?: boolean;
}

export interface KeyboardActionContext {
  key: string;
  target?: KeyboardActionTarget | null;
  selection: {
    selectedNodeId: string | null;
    selectedEdgeId: string | null;
  };
  confirmationOpen: boolean;
}

/**
 * Pure keyboard safety resolver implementing Task K rules without DOM dependency.
 *
 * Rules:
 * - Delete/Backspace:
 *   - Target is input/textarea/select/content-editable/no-key -> 'ignore'
 *   - Confirmation open -> 'ignore'
 *   - Selected node -> 'delete-node'
 *   - Selected edge -> 'delete-edge'
 *   - No selection -> 'ignore'
 * - Escape:
 *   - Target is input/textarea/select -> 'ignore' (allows control to cancel text)
 *   - Otherwise -> 'escape' (signals UI to follow priority: confirmation -> add-child -> selection)
 */
export function resolveKeyboardAction(ctx: KeyboardActionContext): KeyboardAction {
  const { key, target, selection, confirmationOpen } = ctx;

  const isDeleteKey = key === 'Delete' || key === 'Backspace';
  const isEscapeKey = key === 'Escape';

  if (!isDeleteKey && !isEscapeKey) {
    return 'ignore';
  }

  const tagName = target?.tagName?.toLowerCase();
  const isTextControl =
    tagName === 'input' || tagName === 'textarea' || tagName === 'select';
  const isContentEditable = Boolean(target?.isContentEditable);
  const isInsideNoKey = Boolean(target?.insideNoKey);

  if (isEscapeKey) {
    if (isTextControl) {
      return 'ignore';
    }
    return 'escape';
  }

  if (isDeleteKey) {
    if (isTextControl || isContentEditable || isInsideNoKey) {
      return 'ignore';
    }

    if (confirmationOpen) {
      return 'ignore';
    }

    if (selection.selectedNodeId) {
      return 'delete-node';
    }

    if (selection.selectedEdgeId) {
      return 'delete-edge';
    }

    return 'ignore';
  }

  return 'ignore';
}

/**
 * Supported Undo/Redo actions resolved by pure keyboard safety handler (Day 8).
 */
export type UndoRedoAction = 'undo' | 'redo' | 'ignore';

export interface UndoRedoActionContext {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  target?: EventTarget | ElementLike | null;
}

/**
 * Pure keyboard resolver for Undo and Redo shortcuts (Day 8).
 *
 * Rules:
 * - Target is inside input/textarea/select/content-editable/no-key -> 'ignore'
 *   (preserves native browser input undo/redo while editing text)
 * - Ctrl+Z / Cmd+Z (without shift) -> 'undo'
 * - Ctrl+Shift+Z / Cmd+Shift+Z -> 'redo'
 * - Ctrl+Y / Cmd+Y -> 'redo'
 * - Any other combination -> 'ignore'
 */
export function resolveUndoRedoAction(ctx: UndoRedoActionContext): UndoRedoAction {
  if (isKeyboardEventTargetProtected(ctx.target)) {
    return 'ignore';
  }

  const isModifier = Boolean(ctx.ctrlKey || ctx.metaKey);
  if (!isModifier) {
    return 'ignore';
  }

  const keyLower = ctx.key.toLowerCase();
  if (keyLower === 'z') {
    if (ctx.shiftKey) {
      return 'redo';
    }
    return 'undo';
  }

  if (keyLower === 'y') {
    return 'redo';
  }

  return 'ignore';
}

/**
 * Extended canvas action types supported by Day 11 keyboard engine.
 */
export type CanvasKeyboardAction =
  | 'open-shortcuts'
  | 'focus-search'
  | 'auto-layout'
  | 'fit-view'
  | 'reset-view'
  | 'toggle-minimap'
  | 'toggle-grid'
  | 'toggle-diagnostics'
  | 'copy-subtree'
  | 'paste-subtree'
  | 'duplicate-subtree'
  | 'delete-subtree'
  | 'toggle-collapse'
  | 'nudge-node-up'
  | 'nudge-node-down'
  | 'nudge-node-left'
  | 'nudge-node-right'
  | 'cycle-node-next'
  | 'cycle-node-prev'
  | 'ignore';

export interface CanvasKeyboardContext {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  target?: EventTarget | ElementLike | null;
  hasSelectedNode?: boolean;
  hasNodes?: boolean;
  hasClipboard?: boolean;
}

/**
 * Pure resolver for Day 11 and Day 12 advanced keyboard navigation and shortcuts.
 * Shields all inputs, textareas, selects, and contenteditable elements.
 */
export function resolveCanvasKeyboardAction(ctx: CanvasKeyboardContext): CanvasKeyboardAction {
  if (isKeyboardEventTargetProtected(ctx.target)) {
    return 'ignore';
  }

  const isMod = Boolean(ctx.ctrlKey || ctx.metaKey);
  const key = ctx.key;

  // Shortcuts Dialog (? or Shift+/)
  if (key === '?' || (key === '/' && ctx.shiftKey)) {
    return 'open-shortcuts';
  }

  // Focus Search (Ctrl+K / Cmd+K)
  if (isMod && key.toLowerCase() === 'k') {
    return 'focus-search';
  }

  // Auto-Layout (Ctrl+Shift+L / Cmd+Shift+L or Alt+L)
  if ((isMod && ctx.shiftKey && key.toLowerCase() === 'l') || (ctx.altKey && key.toLowerCase() === 'l')) {
    return 'auto-layout';
  }

  // Toggle Diagnostics (Ctrl+Shift+D / Cmd+Shift+D or Alt+D)
  if ((isMod && ctx.shiftKey && key.toLowerCase() === 'd') || (ctx.altKey && key.toLowerCase() === 'd')) {
    return 'toggle-diagnostics';
  }

  // Copy Subtree (Ctrl+C / Cmd+C when node selected)
  if (isMod && !ctx.shiftKey && key.toLowerCase() === 'c' && ctx.hasSelectedNode) {
    return 'copy-subtree';
  }

  // Paste Subtree (Ctrl+V / Cmd+V)
  if (isMod && !ctx.shiftKey && key.toLowerCase() === 'v') {
    return 'paste-subtree';
  }

  // Duplicate Subtree (Ctrl+D / Cmd+D when node selected)
  if (isMod && !ctx.shiftKey && key.toLowerCase() === 'd' && ctx.hasSelectedNode) {
    return 'duplicate-subtree';
  }

  // Delete Subtree (Shift+Delete / Shift+Backspace when node selected)
  if (ctx.shiftKey && (key === 'Delete' || key === 'Backspace') && ctx.hasSelectedNode) {
    return 'delete-subtree';
  }

  // Toggle Collapse (Ctrl+E / Cmd+E when node selected)
  if (isMod && !ctx.shiftKey && key.toLowerCase() === 'e' && ctx.hasSelectedNode) {
    return 'toggle-collapse';
  }

  // Fit View (Ctrl+0 / Cmd+0 or Alt+0)
  if ((isMod || ctx.altKey) && key === '0') {
    return 'fit-view';
  }

  // Reset View (Ctrl+1 / Cmd+1 or Alt+1)
  if ((isMod || ctx.altKey) && key === '1') {
    return 'reset-view';
  }

  // Toggle MiniMap (Ctrl+M / Cmd+M or Alt+M)
  if ((isMod || ctx.altKey) && key.toLowerCase() === 'm') {
    return 'toggle-minimap';
  }

  // Toggle Grid (Ctrl+G / Cmd+G or Alt+G)
  if ((isMod || ctx.altKey) && key.toLowerCase() === 'g') {
    return 'toggle-grid';
  }

  // Node Selection Cycle via Tab / Shift+Tab (when canvas has nodes and no input focused)
  if (key === 'Tab' && ctx.hasNodes) {
    return ctx.shiftKey ? 'cycle-node-prev' : 'cycle-node-next';
  }

  // Arrow Key Node Nudging (only if a node is currently selected)
  if (ctx.hasSelectedNode && !isMod && !ctx.altKey) {
    if (key === 'ArrowUp') return 'nudge-node-up';
    if (key === 'ArrowDown') return 'nudge-node-down';
    if (key === 'ArrowLeft') return 'nudge-node-left';
    if (key === 'ArrowRight') return 'nudge-node-right';
  }

  return 'ignore';
}

/**
 * Pure helper to calculate new position when nudging a node.
 */
export function computeNudgedPosition(
  current: { x: number; y: number },
  direction: 'up' | 'down' | 'left' | 'right',
  step = 20
): { x: number; y: number } {
  switch (direction) {
    case 'up':
      return { x: current.x, y: current.y - step };
    case 'down':
      return { x: current.x, y: current.y + step };
    case 'left':
      return { x: current.x - step, y: current.y };
    case 'right':
      return { x: current.x + step, y: current.y };
  }
}

/**
 * Pure helper to cycle through node selection in order.
 */
export function getNextSelectedNodeId(
  nodes: Array<{ id: string }>,
  currentId: string | null,
  direction: 'next' | 'prev'
): string | null {
  if (nodes.length === 0) return null;
  if (!currentId) return nodes[0].id;

  const currentIndex = nodes.findIndex((n) => n.id === currentId);
  if (currentIndex === -1) return nodes[0].id;

  if (direction === 'next') {
    const nextIndex = (currentIndex + 1) % nodes.length;
    return nodes[nextIndex].id;
  } else {
    const prevIndex = (currentIndex - 1 + nodes.length) % nodes.length;
    return nodes[prevIndex].id;
  }
}


