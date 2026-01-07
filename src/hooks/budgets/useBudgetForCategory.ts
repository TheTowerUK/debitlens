import { useMemo } from 'react';
import { useApp } from '../../state/AppContext';

// tolerant helpers (in case your Budget shape differs)
function getBudgetCategoryKey(b: any): string {
  return String(b?.categoryKey ?? b?.category ?? '').trim();
}

function getBudgetLimit(b: any): number {
  const n = Number(b?.limit ?? b?.amount ?? b?.monthlyLimit ?? b?.value);
  return Number.isFinite(n) ? n : 0;
}

export function useBudgetForCategory(categoryKey: string) {
  const { state } = useApp();
  const budgets: any[] = (state as any).budgets || [];

  return useMemo(() => {
    const hit = budgets.find((b) => getBudgetCategoryKey(b) === categoryKey);
    if (!hit) return null;

    const limit = getBudgetLimit(hit);
    if (!limit) return null;

    return { raw: hit, limit };
  }, [budgets, categoryKey]);
}
