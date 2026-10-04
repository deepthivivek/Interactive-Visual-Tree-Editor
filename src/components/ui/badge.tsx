import React from 'react';
import type { NodeType, NodeSeverity, NodeStatus } from '../../types/tree';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'outline' | 'secondary';
  type?: NodeType;
  severity?: NodeSeverity;
  status?: NodeStatus;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  type,
  severity,
  status,
  className = '',
}) => {
  let colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';

  if (type === 'root') {
    colorClasses = 'bg-purple-50 text-purple-700 border-purple-200';
  } else if (type === 'rule') {
    colorClasses = 'bg-blue-50 text-blue-700 border-blue-200';
  } else if (type === 'condition') {
    colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (type === 'action') {
    colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (severity === 'critical') {
    colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
  } else if (severity === 'high') {
    colorClasses = 'bg-orange-50 text-orange-700 border-orange-200';
  } else if (severity === 'medium') {
    colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (severity === 'low') {
    colorClasses = 'bg-sky-50 text-sky-700 border-sky-200';
  } else if (severity === 'info') {
    colorClasses = 'bg-slate-50 text-slate-600 border-slate-200';
  } else if (status === 'active') {
    colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (status === 'in_review') {
    colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (status === 'draft') {
    colorClasses = 'bg-zinc-100 text-zinc-600 border-zinc-200';
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colorClasses} ${className}`}
    >
      {children}
    </span>
  );
};
