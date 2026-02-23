export function parseYMDLocal(ymd: string): Date | null {
  const m = String(ymd || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  dt.setHours(0, 0, 0, 0);
  return isNaN(dt.getTime()) ? null : dt;
}

export function daysUntilYMD(ymd: string): number | null {
  const target = parseYMDLocal(ymd);
  if (!target) return null;

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const diffMs = target.getTime() - now.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function shouldShowMaturityReminder(acc: {
  archived?: boolean;
  maturityDate?: string;
  maturityReminderEnabled?: boolean;
  maturityReminderDays?: number;
  maturityReminderDismissedFor?: string;
}) {
  if (acc.archived) return { show: false as const };
  if (!acc.maturityReminderEnabled) return { show: false as const };
  if (!acc.maturityDate) return { show: false as const };

  const lead = Number.isFinite(acc.maturityReminderDays)
    ? (acc.maturityReminderDays as number)
    : 60;

  const d = daysUntilYMD(acc.maturityDate);
  if (d == null) return { show: false as const };

  if (acc.maturityReminderDismissedFor === acc.maturityDate) {
    return { show: false as const };
  }

  if (d >= 0 && d <= lead) {
    return { show: true as const, daysUntil: d, leadDays: lead, overdue: false as const };
  }

  if (d < 0) {
    return { show: true as const, daysUntil: d, leadDays: lead, overdue: true as const };
  }

  return { show: false as const };
}
