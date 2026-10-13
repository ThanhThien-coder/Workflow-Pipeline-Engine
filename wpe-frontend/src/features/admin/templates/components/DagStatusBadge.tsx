import React from 'react';
import type { DagValidationResult } from '../../../../types/template.types';
import { Check, AlertTriangle } from 'lucide-react';

interface DagStatusBadgeProps {
  validation: DagValidationResult | null;
}

export const DagStatusBadge: React.FC<DagStatusBadgeProps> = ({ validation }) => {
  if (!validation) return null;

  if (validation.valid) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
        <Check className="h-3.5 w-3.5" />
        <span>DAG Valid · 0 Cycles</span>
      </span>
    );
  }

  const violationCount = validation.violations.reduce(
    (acc, v) => acc + v.nodeIds.length,
    0
  );

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 animate-pulse">
      <AlertTriangle className="h-3.5 w-3.5" />
      <span>
        Cycle Detected · {violationCount} {violationCount > 1 ? 'nodes' : 'node'}
      </span>
    </span>
  );
};
