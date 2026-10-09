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

