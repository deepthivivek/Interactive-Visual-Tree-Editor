/**
 * Status Message Timer Manager (Day 6 Task J).
 *
 * Guarantees:
 * - A newer message immediately replaces the previous one.
 * - Any previous timer is cleared before a replacement timer is scheduled.
 * - A stale timer cannot clear a newer message.
 * - All pending timers can be safely cancelled upon unmount.
 * - Completely decoupled from graph state; accepts injected timer functions for testing.
 */

export type TimeoutFn = (handler: () => void, timeout: number) => unknown;
export type ClearTimeoutFn = (handle: unknown) => void;

export interface StatusTimerOptions {
  durationMs?: number;
  setTimeoutFn?: TimeoutFn;
  clearTimeoutFn?: ClearTimeoutFn;
  onClear: () => void;
}

export class StatusTimerManager {
  private activeTimerId: unknown = null;
  private currentMessageId = 0;
  private readonly durationMs: number;
  private readonly setTimeoutFn: TimeoutFn;
  private readonly clearTimeoutFn: ClearTimeoutFn;
  private readonly onClear: () => void;

  constructor(options: StatusTimerOptions) {
    this.durationMs = options.durationMs ?? 4500;
    this.setTimeoutFn =
      options.setTimeoutFn ??
      ((handler, ms) => setTimeout(handler, ms));
    this.clearTimeoutFn =
      options.clearTimeoutFn ??
      ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
    this.onClear = options.onClear;
  }

  /**
   * Schedules an auto-dismiss timer for a new status message.
   * Cancels any previously active timer first.
   */
  public schedule(): void {
    this.cancel();

    const messageId = ++this.currentMessageId;

    this.activeTimerId = this.setTimeoutFn(() => {
      // Guard against stale callback: only trigger if this is still the active message
      if (this.currentMessageId === messageId) {
        this.activeTimerId = null;
        this.onClear();
      }
    }, this.durationMs);
  }

  /**
   * Cancels any currently pending dismiss timer.
   */
  public cancel(): void {
    if (this.activeTimerId !== null) {
      this.clearTimeoutFn(this.activeTimerId);
      this.activeTimerId = null;
    }
  }

  /**
   * Disposes the manager (alias for cancel).
   */
  public dispose(): void {
    this.cancel();
  }
}
