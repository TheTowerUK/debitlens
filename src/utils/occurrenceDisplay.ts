// src/utils/occurrenceDisplay.ts
import type { UpcomingOccurrence } from './recurring';

export type AccountLite = { id: string; name: string };

export type OccurrenceDisplay = {
  title: string;
  subtitle: string;
  amountText: string; // includes sign for income/expense; transfers have no sign
  tone: 'income' | 'expense' | 'transfer'; // lets screens choose styling/colors
};

/**
 * Pure formatting helper for showing an UpcomingOccurrence in the UI.
 * - Keeps Dashboard/Recurring screens simple.
 * - Encodes consistent rules for transfers vs income vs expense.
 */
export function getOccurrenceDisplay(
  occ: UpcomingOccurrence,
  accountById: Record<string, AccountLite | undefined>,
  formatMoney: (v: number) => string,
  dateFormatter?: (d: Date) => string
): OccurrenceDisplay {
  const isTransfer = occ.type === 'transfer';

  const dateText = dateFormatter ? dateFormatter(occ.dueDate) : occ.dueDate.toLocaleDateString();
  const freqText =
    String(occ.frequency).charAt(0).toUpperCase() + String(occ.frequency).slice(1);

  const title = occ.title;

  let subtitle: string;
  if (isTransfer) {
    const fromName =
      (occ.fromAccountId && accountById[occ.fromAccountId]?.name) || 'From account';
    const toName =
      (occ.toAccountId && accountById[occ.toAccountId]?.name) || 'To account';
    subtitle = `${fromName} → ${toName} · ${dateText}`;
  } else {
    subtitle = `${freqText} · ${dateText}`;
  }

  const absAmount = Math.abs(Number(occ.amount) || 0);
  const money = formatMoney(absAmount);

  if (isTransfer) {
    return { title, subtitle, amountText: money, tone: 'transfer' };
  }
  if (occ.type === 'income') {
    return { title, subtitle, amountText: `+${money}`, tone: 'income' };
  }
  return { title, subtitle, amountText: `-${money}`, tone: 'expense' };
}
