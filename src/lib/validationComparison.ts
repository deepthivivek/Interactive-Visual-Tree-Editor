/**
 * Pure Validation Result Comparison & Regression Detection Helper (Day 13).
 *
 * Compares two validation snapshots (before vs after an edit) to deterministically identify:
 * - Newly introduced issues / regressions
 * - Resolved defects
 * - Persistent issues
 * - Metric & score improvements/degradations
 *
 * Pure and non-mutating: does not alter inputs or Zustand state.
 */

import type {
  ValidationResult,
  ValidationIssue,
  ValidationSeverity,
  GraphQualityMetrics,
} from './validation';

export interface SeverityChange {
  issueId: string;
  previousSeverity: ValidationSeverity;
  currentSeverity: ValidationSeverity;
  issue: ValidationIssue;
}

export interface ValidationComparison {
  hasRegressed: boolean;
  hasImproved: boolean;
  newIssues: ValidationIssue[];
  resolvedIssues: ValidationIssue[];
  persistentIssues: ValidationIssue[];
  severityChanges: SeverityChange[];
  newCriticalCount: number;
  newErrorCount: number;
  newWarningCount: number;
  resolvedCriticalCount: number;
  resolvedErrorCount: number;
  resolvedWarningCount: number;
  remainingCriticalCount: number;
  remainingErrorCount: number;
  metricDeltas: Record<keyof GraphQualityMetrics, number>;
  scoreDelta: number;
  summary: string;
}

/**
 * Compares two validation results deterministically using stable issue IDs.
 * Never matches on message text alone.
 */
export function compareValidationResults(
  previous: ValidationResult,
  current: ValidationResult
): ValidationComparison {
  const prevMap = new Map<string, ValidationIssue>();
  for (const issue of previous.issues) {
    prevMap.set(issue.id, issue);
  }

  const currMap = new Map<string, ValidationIssue>();
  for (const issue of current.issues) {
    currMap.set(issue.id, issue);
  }

  const newIssues: ValidationIssue[] = [];
  const persistentIssues: ValidationIssue[] = [];
  const severityChanges: SeverityChange[] = [];

  for (const currIssue of current.issues) {
    const prevMatch = prevMap.get(currIssue.id);
    if (!prevMatch) {
      newIssues.push(currIssue);
    } else {
      persistentIssues.push(currIssue);
      if (prevMatch.severity !== currIssue.severity) {
        severityChanges.push({
          issueId: currIssue.id,
          previousSeverity: prevMatch.severity,
          currentSeverity: currIssue.severity,
          issue: currIssue,
        });
      }
    }
  }

  const resolvedIssues: ValidationIssue[] = [];
  for (const prevIssue of previous.issues) {
    if (!currMap.has(prevIssue.id)) {
      resolvedIssues.push(prevIssue);
    }
  }

  // Count severities
  const newCriticalCount = newIssues.filter((i) => i.severity === 'CRITICAL').length;
  const newErrorCount = newIssues.filter((i) => i.severity === 'ERROR').length;
  const newWarningCount = newIssues.filter((i) => i.severity === 'WARNING').length;

  const resolvedCriticalCount = resolvedIssues.filter((i) => i.severity === 'CRITICAL').length;
  const resolvedErrorCount = resolvedIssues.filter((i) => i.severity === 'ERROR').length;
  const resolvedWarningCount = resolvedIssues.filter((i) => i.severity === 'WARNING').length;

  const remainingCriticalCount = current.issues.filter((i) => i.severity === 'CRITICAL').length;
  const remainingErrorCount = current.issues.filter((i) => i.severity === 'ERROR').length;

  // Metric deltas
  const metricDeltas: Record<keyof GraphQualityMetrics, number> = {
    nodeCount: current.metrics.nodeCount - previous.metrics.nodeCount,
    edgeCount: current.metrics.edgeCount - previous.metrics.edgeCount,
    rootCount: current.metrics.rootCount - previous.metrics.rootCount,
    orphanCount: current.metrics.orphanCount - previous.metrics.orphanCount,
    cycleCount: current.metrics.cycleCount - previous.metrics.cycleCount,
    connectedComponentCount:
      current.metrics.connectedComponentCount - previous.metrics.connectedComponentCount,
    reachableNodeCount:
      current.metrics.reachableNodeCount - previous.metrics.reachableNodeCount,
    unreachableNodeCount:
      current.metrics.unreachableNodeCount - previous.metrics.unreachableNodeCount,
    completenessWarningCount:
      current.metrics.completenessWarningCount - previous.metrics.completenessWarningCount,
  };

  const scoreDelta = current.score - previous.score;

  // Regression / Improvement classification
  const hasRegressed =
    newCriticalCount > 0 ||
    newErrorCount > 0 ||
    (newWarningCount > 0 && resolvedErrorCount === 0 && resolvedCriticalCount === 0) ||
    scoreDelta < 0;

  const hasImproved =
    (resolvedCriticalCount > 0 || resolvedErrorCount > 0 || resolvedWarningCount > 0) &&
    newCriticalCount === 0 &&
    newErrorCount === 0;

  // Human-readable summary
  let summary = 'Graph validation state unchanged.';
  if (hasRegressed) {
    const regressedParts: string[] = [];
    if (newCriticalCount > 0) regressedParts.push(`${newCriticalCount} new critical issue(s)`);
    if (newErrorCount > 0) regressedParts.push(`${newErrorCount} new error(s)`);
    if (newWarningCount > 0) regressedParts.push(`${newWarningCount} new warning(s)`);
    summary = `Quality regressed: ${regressedParts.join(', ')} introduced.`;
  } else if (hasImproved) {
    const fixedParts: string[] = [];
    if (resolvedCriticalCount > 0) fixedParts.push(`${resolvedCriticalCount} critical issue(s) resolved`);
    if (resolvedErrorCount > 0) fixedParts.push(`${resolvedErrorCount} error(s) resolved`);
    if (resolvedWarningCount > 0) fixedParts.push(`${resolvedWarningCount} warning(s) resolved`);
    summary = `Quality improved: ${fixedParts.join(', ')}.`;
  }

  return {
    hasRegressed,
    hasImproved,
    newIssues,
    resolvedIssues,
    persistentIssues,
    severityChanges,
    newCriticalCount,
    newErrorCount,
    newWarningCount,
    resolvedCriticalCount,
    resolvedErrorCount,
    resolvedWarningCount,
    remainingCriticalCount,
    remainingErrorCount,
    metricDeltas,
    scoreDelta,
    summary,
  };
}
