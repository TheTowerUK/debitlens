// NOTE: Transfer and recurring invariants are locked.
// See: DATA_MODEL_LOCK.md
// src/utils/recurring.ts
import type { RecurringItem, RecurringFrequency } from '../state/AppContext';

/** True when item has at least one transfer account field set. */
export function hasAnyTransferFields(item: RecurringItem): boolean {
  return !!(item.fromAccountId || item.toAccountId);
}

/** True when item has both transfer account fields set (valid recurring transfer). */
export function isValidTransferFields(item: RecurringItem): boolean {
  return !!(item.fromAccountId && item.toAccountId);
}

export type UpcomingOccurrence = {
  itemId: string;
  title: string;
  dueDate: Date;
  amount: number;

  // occurrence can be a transfer even though RecurringItem.type is only income/expense
  type: 'income' | 'expense' | 'transfer';

  frequency: RecurringFrequency;

  // non-transfer
  accountId?: string;

  // transfer-only (when type === 'transfer')
  fromAccountId?: string;
  toAccountId?: string;

  category?: string;
  description?: string;
};

/**
 * Safely parses a YYYY-MM-DD date string as a local date (avoids timezone shifts).
 */
function parseYMDLocal(ymd: string): Date | null {
  const m = String(ymd || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  dt.setHours(0, 0, 0, 0);
  return isNaN(dt.getTime()) ? null : dt;
}

/**
 * Advances a date by the given frequency, handling date clamping for monthly/yearly.
 */
function advanceDateByFrequency(date: Date, frequency: RecurringFrequency): Date {
  const d = new Date(date);
  switch (frequency) {
    case 'daily':
      d.setDate(d.getDate() + 1);
      break;
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'fortnightly':
      d.setDate(d.getDate() + 14);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + 1);
      break;
    case 'yearly':
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d;
}

export type UpcomingOccurrencesWithStats = {
  occurrences: UpcomingOccurrence[];
  skippedIncompleteTransfers: number;
};

/**
 * Gets upcoming occurrences for recurring items within a date range, plus count of skipped incomplete transfers.
 */
export function getUpcomingOccurrencesWithStats(
  recurringItems: RecurringItem[],
  fromDate: Date,
  daysAhead: number
): UpcomingOccurrencesWithStats {
  const start = new Date(fromDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + daysAhead);
  end.setHours(23, 59, 59, 999);

  const occurrences: UpcomingOccurrence[] = [];
  let skippedIncompleteTransfers = 0;

  for (const item of recurringItems) {
    // Only exclude explicitly paused items (treat missing/undefined as active)
    if (item.active === false) {
      continue;
    }

    // Skip items without nextDueDate
    if (!item.nextDueDate) {
      continue;
    }

    // Parse and validate nextDueDate as local date (avoid timezone shifts)
    const nextDue = parseYMDLocal(item.nextDueDate);
    if (!nextDue) {
      continue;
    }

    const hasAny = hasAnyTransferFields(item);
    const isValid = isValidTransferFields(item);

    // Skip malformed recurring transfers (half-configured)
    if (hasAny && !isValid) {
      skippedIncompleteTransfers++;
      continue;
    }

    const isTransfer = isValid;

    // Default frequency to 'monthly' for backward compatibility
    const frequency = item.frequency || 'monthly';
    let currentDate = new Date(nextDue);

    // If nextDueDate is in the past, "catch up" by advancing until today or later
    while (currentDate < start) {
      currentDate = advanceDateByFrequency(currentDate, frequency);
    }

    while (currentDate <= end) {
      const occType: UpcomingOccurrence['type'] = isTransfer ? 'transfer' : item.type;

      occurrences.push({
        itemId: item.id,
        title: item.title || (isTransfer ? 'Recurring transfer' : 'Recurring item'),
        dueDate: new Date(currentDate),
        amount: Number(item.amount) || 0,
        type: occType,
        frequency,

        // normal items
        accountId: isTransfer ? undefined : item.accountId,

        // transfer-only
        fromAccountId: isTransfer ? item.fromAccountId : undefined,
        toAccountId: isTransfer ? item.toAccountId : undefined,

        category: item.category,
        description: item.description,
      });

      currentDate = advanceDateByFrequency(currentDate, frequency);
    }
  }

  // Sort: ascending by date, then expenses before income before transfer, then stable sort by title
  occurrences.sort((a, b) => {
    const dateDiff = a.dueDate.getTime() - b.dueDate.getTime();
    if (dateDiff !== 0) return dateDiff;

    const rank = (t: UpcomingOccurrence['type']) => (t === 'expense' ? 0 : t === 'income' ? 1 : 2);
    const rdiff = rank(a.type) - rank(b.type);
    if (rdiff !== 0) return rdiff;

    // Same type: stable sort by title
    return a.title.localeCompare(b.title);
  });

  return { occurrences, skippedIncompleteTransfers };
}

/**
 * Gets upcoming occurrences for recurring items within a date range.
 * Backward-compatible wrapper; use getUpcomingOccurrencesWithStats when you need skippedIncompleteTransfers.
 */
export function getUpcomingOccurrences(
  recurringItems: RecurringItem[],
  fromDate: Date,
  daysAhead: number
): UpcomingOccurrence[] {
  return getUpcomingOccurrencesWithStats(recurringItems, fromDate, daysAhead).occurrences;
}
