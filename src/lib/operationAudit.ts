/**
 * Pure Session-Level Operation Audit History Module (Day 13).
 *
 * Maintains a lightweight in-memory log of graph operations, transaction statuses,
 * and before/after validation summaries.
 *
 * Decoupled: Kept purely in transient session UI state; never pollutes
 * graph documents or Zundo undo/redo history.
 */

export interface OperationAuditEntry {
  id: string;
  operationType: string;
  timestamp: number;
  affectedNodeIds: string[];
  affectedEdgeIds: string[];
  status: 'confirmed' | 'rejected' | 'cancelled';
  validationSummaryBefore?: string;
  validationSummaryAfter?: string;
  notes?: string;
}

export const MAX_AUDIT_LOG_ENTRIES = 50;

/**
 * Creates an immutable audit log entry.
 */
export function createAuditEntryPure(
  operationType: string,
  status: 'confirmed' | 'rejected' | 'cancelled',
  affectedNodeIds: string[],
  affectedEdgeIds: string[],
  options?: {
    validationSummaryBefore?: string;
    validationSummaryAfter?: string;
    notes?: string;
  }
): OperationAuditEntry {
  return {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    operationType,
    timestamp: Date.now(),
    affectedNodeIds: [...affectedNodeIds],
    affectedEdgeIds: [...affectedEdgeIds],
    status,
    validationSummaryBefore: options?.validationSummaryBefore,
    validationSummaryAfter: options?.validationSummaryAfter,
    notes: options?.notes,
  };
}

/**
 * Appends an entry to the audit log while capping history size.
 */
export function appendAuditEntryPure(
  entries: readonly OperationAuditEntry[],
  newEntry: OperationAuditEntry
): OperationAuditEntry[] {
  const next = [newEntry, ...entries];
  if (next.length > MAX_AUDIT_LOG_ENTRIES) {
    return next.slice(0, MAX_AUDIT_LOG_ENTRIES);
  }
  return next;
}
