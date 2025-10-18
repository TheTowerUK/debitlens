// src/types/report.ts
export type ReportType = 'spend_over_time' | 'by_category';

export interface ReportFilter {
  dateFrom?: string;           // ISO "YYYY-MM-DD"
  dateTo?: string;             // ISO "YYYY-MM-DD" (inclusive)
  accountIds?: string[];
  categoryIds?: string[];
}

export interface Report {
  id: string;
  name: string;
  type: ReportType;
  params: ReportFilter;
  createdAt: string;
  updatedAt: string;
}
