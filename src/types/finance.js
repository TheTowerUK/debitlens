export type TxnType = 'income' | 'expense';

export interface Transaction {
  id: string;
  accountId: string;
  accountName?: string;
  date: string;         // ISO: "2025-10-01"
  amount: number;       // positive number
  type: TxnType;        // 'income' | 'expense'
  category: string;     // e.g. "Groceries", "Salary"
  note?: string;
}
