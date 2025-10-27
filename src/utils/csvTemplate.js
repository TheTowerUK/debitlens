// src/utils/csvTemplate.ts

export const CSV_HEADERS = ['date', 'amount', 'type', 'account', 'category', 'note'];

export const CSV_TEMPLATE = [
  CSV_HEADERS.join(','),
  '2025-10-01,12.50,expense,Main,Groceries,Milk & bread',
  '2025-10-03,2500,income,Main,Salary,October',
].join('\n');
