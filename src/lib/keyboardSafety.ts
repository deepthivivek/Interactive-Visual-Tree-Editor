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
