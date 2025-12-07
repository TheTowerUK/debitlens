import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
} from 'react';

// ---- Basic types (kept loose so we don't explode TS everywhere) ----

export type Account = {
  id: string;
  name: string;
  // optional extras so other screens don't choke
  type?: string;
  currency?: string;
  initialBalance?: number;
  archived?: boolean;
  [key: string]: any;
};

export type Transaction = {
  id: string;
  accountId: string;
  date: string; // YYYY-MM-DD
  amount: number;
  type: 'income' | 'expense';
  description: string;
  category?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
};

// Keep AppState permissive so other code reading extra keys won't scream
export type AppState = {
  accounts: Account[];
  transactions: Transaction[];
  // any other legacy fields can live here without type errors
  [key: string]: any;
};

// Actions we actually implement; extra keys allowed too via index signature
export type AppActions = {
  addAccount: (account: Partial<Account>) => void;
  updateAccount: (id: string, patch: Partial<Account>) => void;
  deleteAccount: (id: string) => void;

  addTransaction: (tx: Partial<Transaction>) => void;
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;

  fullRestoreFromBackup: (payload: {
    accounts: Account[];
    transactions: Transaction[];
  }) => void;

  // allow other actions to be hung on later without TS misery
  [key: string]: any;
};

type AppContextValue = {
  state: AppState;
  actions: AppActions;
};

// ---- Helpers ----

function makeId(prefix: string): string {
  return (
    prefix +
    '_' +
    Date.now().toString(36) +
    '_' +
    Math.random().toString(36).slice(2, 8)
  );
}

function normaliseDate(raw: unknown): string {
  if (raw == null) return new Date().toISOString().slice(0, 10);
  const s = String(raw).trim();
  if (!s) return new Date().toISOString().slice(0, 10);

  // If looks like YYYY-MM-DD or YYYY-MM-DDT..., keep first 10 chars
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.slice(0, 10);
  }

  // Naive fallback: use today
  return new Date().toISOString().slice(0, 10);
}

// ---- Initial state ----

const initialState: AppState = {
  accounts: [],
  transactions: [],
};

// ---- Context + hooks ----

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used within AppProvider');
  }
  return ctx;
}

// ---- Provider ----

type AppProviderProps = {
  children: ReactNode;
};

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [state, setState] = useState<AppState>(initialState);

  // ---- Account actions ----

  const addAccount: AppActions['addAccount'] = (accountPartial) => {
    setState((prev) => {
      const id = accountPartial.id ?? makeId('acc');
      const name = accountPartial.name ?? 'Unnamed account';

      const account: Account = {
        id,
        name,
        ...accountPartial,
      };

      return {
        ...prev,
        accounts: [...(prev.accounts || []), account],
      };
    });
  };

  const updateAccount: AppActions['updateAccount'] = (id, patch) => {
    setState((prev) => ({
      ...prev,
      accounts: (prev.accounts || []).map((a) =>
        a.id === id ? { ...a, ...patch } : a,
      ),
    }));
  };

  const deleteAccount: AppActions['deleteAccount'] = (id) => {
    setState((prev) => ({
      ...prev,
      accounts: (prev.accounts || []).filter((a) => a.id !== id),
      // Also remove transactions for that account to keep things sane
      transactions: (prev.transactions || []).filter(
        (t) => t.accountId !== id,
      ),
    }));
  };

  // ---- Transaction actions ----

  const addTransaction: AppActions['addTransaction'] = (txPartial) => {
    setState((prev) => {
      const id = txPartial.id ?? makeId('tx');
      const date = normaliseDate(txPartial.date);
      const amountNum = Number(txPartial.amount ?? 0);
      const amount = Number.isFinite(amountNum) ? amountNum : 0;

      const type: 'income' | 'expense' =
        (txPartial.type as any) ??
        (amount >= 0 ? 'income' : 'expense');

      const description =
        txPartial.description ?? 'New transaction';

      const tx: Transaction = {
        id,
        accountId: String(txPartial.accountId ?? ''),
        date,
        amount,
        type,
        description,
        category: txPartial.category,
        createdAt:
          txPartial.createdAt ?? new Date().toISOString(),
        updatedAt:
          txPartial.updatedAt ?? new Date().toISOString(),
        ...txPartial,
      };

      return {
        ...prev,
        transactions: [...(prev.transactions || []), tx],
      };
    });
  };

  const updateTransaction: AppActions['updateTransaction'] = (
    id,
    patch,
  ) => {
    setState((prev) => ({
      ...prev,
      transactions: (prev.transactions || []).map((t) =>
        t.id === id
          ? {
              ...t,
              ...patch,
              updatedAt: new Date().toISOString(),
            }
          : t,
      ),
    }));
  };

  const deleteTransaction: AppActions['deleteTransaction'] = (id) => {
    setState((prev) => ({
      ...prev,
      transactions: (prev.transactions || []).filter(
        (t) => t.id !== id,
      ),
    }));
  };

  // ---- Full restore from backup (used by DataExportImportScreen) ----

  const fullRestoreFromBackup: AppActions['fullRestoreFromBackup'] = ({
    accounts,
    transactions,
  }) => {
    setState((prev) => ({
      ...prev,
      accounts: accounts ?? [],
      transactions: transactions ?? [],
    }));
  };

  const actions: AppActions = {
    addAccount,
    updateAccount,
    deleteAccount,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    fullRestoreFromBackup,
  };

  return (
    <AppContext.Provider value={{ state, actions }}>
      {children}
    </AppContext.Provider>
  );
};
