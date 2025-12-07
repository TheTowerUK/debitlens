// src/state/AppContext.tsx
import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from 'react';


export interface NotificationPrefs {
  enabled?: boolean;
  dailyTime?: string; // "HH:MM"
}

export interface PrefsState {
  notifications?: NotificationPrefs;
}

export interface AppState {
  accounts: Account[];
  transactions: Transaction[];
  recurring: RecurringItem[];
  budgets: Budget[];
  pin?: string | null;

  prefs?: PrefsState;    // 👈 add this
}

/** DOMAIN TYPES **/

export interface Account {
  id: string;
  name?: string;
  label?: string;
}

export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  accountId: string;
  date: string;           // ISO date string
  type: TransactionType;
  amount: number;
  description?: string;
  category?: string;
  note?: string;
}

/** Budgets **/

export type BudgetPeriod = 'monthly' | 'weekly' | 'yearly' | 'oneoff';

export interface Budget {
  id: string;
  name: string;
  amount: number;
  category?: string;
  accountId?: string | null;
  period?: BudgetPeriod;
  note?: string;
  title?: string;         // used by BudgetsScreen
}

/** Recurring **/

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurringItem {
  id: string;

  // For simple recurring items
  accountId?: string;           // optional: we can infer in addRecurring

  // For transfers
  fromAccountId?: string;
  toAccountId?: string;

  type?: TransactionType;
  amount: number;

  title?: string;
  description?: string;
  category?: string;

  frequency?: RecurringFrequency;
  schedule?: string;

  nextDueDate?: string;         // ISO date
  active?: boolean;
  isTransfer?: boolean;
}

/** STATE & ACTION TYPES **/

export interface AppState {
  accounts: Account[];
  transactions: Transaction[];
  recurring: RecurringItem[];
  budgets: Budget[];
  pin?: string | null;
}

export interface AppActions {
  // Accounts
  addAccount: (account: Partial<Account>) => void;
  updateAccount: (id: string, updates: Partial<Account>) => void;
  deleteAccount: (id: string) => void;

  // Transactions
  addTransaction: (tx: Partial<Transaction>) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;

  // Recurring
  addRecurring: (item: Partial<RecurringItem>) => void;
  updateRecurring: (id: string, updates: Partial<RecurringItem>) => void;
  deleteRecurring: (id: string) => void;

  // Budgets
  addBudget: (budget: Partial<Budget>) => void;
  updateBudget: (id: string, updates: Partial<Budget>) => void;
  deleteBudget: (id: string) => void;

  // PIN
  setPin: (pin: string | null) => void;

  
}

export interface AppContextValue {
  state: AppState;
  actions: AppActions;
  getPin: () => string | null;
  setPin: (pin: string | null) => void;
}

/** INITIAL STATE **/

const initialState: AppState = {
  accounts: [],
  transactions: [],
  recurring: [],
  budgets: [],
  pin: null,
  prefs: {
    notifications: {
      enabled: false,
      dailyTime: '09:00',
    },
  },
};


const AppContext = createContext<AppContextValue | undefined>(undefined);

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(initialState);

  const actions: AppActions = useMemo(
    () => ({
      // ----- ACCOUNTS -----
      addAccount(account) {
        setState((prev) => {
          const id = account.id ?? generateId('acct');
          const newAccount: Account = {
            id,
            name: account.name ?? '',
            label: account.label ?? account.name ?? '',
          };
          return {
            ...prev,
            accounts: [...prev.accounts, newAccount],
          };
        });
      },

      updateAccount(id, updates) {
        setState((prev) => ({
          ...prev,
          accounts: prev.accounts.map((a) =>
            a.id === id ? { ...a, ...updates } : a
          ),
        }));
      },

      deleteAccount(id) {
        setState((prev) => ({
          ...prev,
          accounts: prev.accounts.filter((a) => a.id !== id),
          transactions: prev.transactions.filter((t) => t.accountId !== id),
          recurring: prev.recurring.filter(
            (r) =>
              r.accountId !== id &&
              r.fromAccountId !== id &&
              r.toAccountId !== id
          ),
          budgets: prev.budgets.filter((b) => b.accountId !== id),
        }));
      },

      // ----- TRANSACTIONS -----
      addTransaction(tx) {
        setState((prev) => {
          const id = tx.id ?? generateId('tx');

          const accountId =
            tx.accountId ??
            prev.accounts[0]?.id ??
            generateId('missingAccount');

          const amount =
            typeof tx.amount === 'number'
              ? tx.amount
              : Number(tx.amount ?? 0);

          const newTx: Transaction = {
            id,
            accountId,
            date: tx.date ?? new Date().toISOString().slice(0, 10),
            type: tx.type === 'income' ? 'income' : 'expense',
            amount,
            description: tx.description ?? '',
            category: tx.category ?? '',
            note: tx.note ?? '',
          };

          return {
            ...prev,
            transactions: [...prev.transactions, newTx],
          };
        });
      },

      updateTransaction(id, updates) {
        setState((prev) => ({
          ...prev,
          transactions: prev.transactions.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        }));
      },

      deleteTransaction(id) {
        setState((prev) => ({
          ...prev,
          transactions: prev.transactions.filter((t) => t.id !== id),
        }));
      },

      // ----- RECURRING -----
      addRecurring(item) {
        setState((prev) => {
          const id = item.id ?? generateId('rec');

          const accountId =
            item.accountId ??
            item.fromAccountId ??
            prev.accounts[0]?.id ??
            generateId('missingAccount');

          const amount =
            typeof item.amount === 'number'
              ? item.amount
              : Number(item.amount ?? 0);

          const rec: RecurringItem = {
            id,
            accountId,
            fromAccountId: item.fromAccountId,
            toAccountId: item.toAccountId,
            type: item.type === 'income' ? 'income' : 'expense',
            amount,
            title: item.title ?? '',
            description: item.description ?? '',
            category: item.category ?? '',
            frequency: item.frequency ?? 'monthly',
            schedule: item.schedule ?? undefined,
            nextDueDate:
              item.nextDueDate ?? new Date().toISOString().slice(0, 10),
            active: item.active ?? true,
            isTransfer: item.isTransfer ?? false,
          };

          return {
            ...prev,
            recurring: [...prev.recurring, rec],
          };
        });
      },

      updateRecurring(id, updates) {
        setState((prev) => ({
          ...prev,
          recurring: prev.recurring.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        }));
      },

      deleteRecurring(id) {
        setState((prev) => ({
          ...prev,
          recurring: prev.recurring.filter((r) => r.id !== id),
        }));
      },

      // ----- BUDGETS -----
      addBudget(budget) {
        setState((prev) => {
          const id = budget.id ?? generateId('bud');
          const newBudget: Budget = {
            id,
            name: budget.name ?? 'Untitled budget',
            amount:
              typeof budget.amount === 'number'
                ? budget.amount
                : Number(budget.amount ?? 0),
            category: budget.category,
            accountId: budget.accountId ?? null,
            period: budget.period ?? 'monthly',
            note: budget.note ?? '',
            title: budget.title ?? budget.name ?? 'Untitled budget',
          };

          return {
            ...prev,
            budgets: [...prev.budgets, newBudget],
          };
        });
      },

      updateBudget(id, updates) {
        setState((prev) => ({
          ...prev,
          budgets: prev.budgets.map((b) =>
            b.id === id ? { ...b, ...updates } : b
          ),
        }));
      },

      deleteBudget(id) {
        setState((prev) => ({
          ...prev,
          budgets: prev.budgets.filter((b) => b.id !== id),
        }));
      },

      // ----- PIN -----
      setPin(pin) {
        setState((prev) => ({
          ...prev,
          pin,
        }));
      },
    }),
    []
  );

  const getPin = () => state.pin ?? null;

  const value: AppContextValue = useMemo(
    () => ({
      state,
      actions,
      getPin,
      setPin: actions.setPin,
    }),
    [state, actions]
  );

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextValue => {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used within AppProvider');
  }
  return ctx;
};

