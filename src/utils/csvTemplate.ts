// src/utils/csvTemplate.ts
// Canonical import format. Required: Date, Amount, Description, Category, Type, and Account A or Account B (at least one).
// Amount is always positive. Type: expense, income, or transfer. For transfers, include both Account A and Account B (from → to).

export const CSV_HEADERS = [
  'Date',
  'Amount',
  'Description',
  'Category',
  'Type',
  'Account A',
  'Account B',
] as const;

export const CSV_TEMPLATE = [
  CSV_HEADERS.join(','),
  '2026-02-01,24.99,"Tesco weekly shop",Groceries,expense,Monzo,',
  '2026-02-01,2000,"Monthly salary",Salary,income,HSBC,',
  '2026-02-02,150,"Move funds to spending",Transfers,transfer,HSBC,Monzo',
].join('\n') + '\n';
