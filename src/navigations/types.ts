export type LoginFlow = 'sign' | 'create' | 'change' | 'remove';

export type RootStackParamList = {
  Login: { flow?: LoginFlow } | undefined;
  Dashboard: undefined;

  Account: { accountId?: string } | undefined;
  AddAccount: undefined;
  Transfer: { fromAccountId?: string } | undefined;
  RecentActivity: undefined;
  History: undefined;

  ReportDetail: {
    categoryKey: string;
    period: 'thisMonth' | 'lastMonth' | 'allTime' | 'month';
    monthKey?: string; // 'YYYY-MM' when period === 'month'
  };

  TxnEditor:
    | {
        id?: string;
        accountId?: string;
        type?: 'income' | 'expense';
      }
    | undefined;

  Payments: undefined;
  Recurring: undefined;

  Budgets: undefined;
  BudgetEditor: { id?: string; mode?: 'create' } | undefined;

  Notifications: undefined;
  RecurringEditor: { id?: string } | undefined;

  Settings: undefined;
  Reports: undefined;
  Help: undefined;
  About: undefined;
  PrivacyPolicy: undefined;

  DataExportImport: undefined;
  DataTransfer: undefined;
  DataExport: undefined;
  DataImport: undefined;
  ImportCSV: undefined;
};
