/**
 * Theme Synchronization Helper for Interactive Visual Tree Editor.
 *
 * Ensures synchronous class toggling on document.documentElement for
 * class-based Tailwind v4 dark mode, supports 'light', 'dark', and 'system'
 * modes, and prevents FOUC (Flash of Unstyled Content).
 */

export function applyThemeToDocument(theme?: string): void {
  if (typeof document === 'undefined') return;
  const target = theme || 'light';
  let isDark = false;

  if (target === 'dark') {
    isDark = true;
  } else if (target === 'system') {
    isDark =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export function isDarkActive(theme?: string): boolean {
  const target = theme || 'light';
  if (target === 'dark') return true;
  if (target === 'system') {
    return (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    );
  }
  return false;
}
