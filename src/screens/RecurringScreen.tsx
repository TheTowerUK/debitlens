// src/screens/RecurringScreen.tsx
import React from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  useApp,
  type RecurringItem,
  type RecurringFrequency,
} from '../state/AppProvider';

const FREQUENCY_LABEL: Record<RecurringFrequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

const advanceDate = (date: Date, frequency: RecurringFrequency): Date => {
  const d = new Date(date.getTime());
  switch (frequency) {
    case "daily":
      d.setDate(d.getDate() + 1);
      break;
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    case "yearly":
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d;
};

const RecurringScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { state, actions } = useApp();

  const recurring: RecurringItem[] = state.recurring || [];
  const accounts = state.accounts || [];

  const handleToggleActive = (item: RecurringItem) => {
    actions.updateRecurring(item.id, { active: !item.active });
  };

  const handleDelete = (item: RecurringItem) => {
    actions.deleteRecurring(item.id);
  };

  const handleEdit = (item: RecurringItem) => {
    navigation.navigate("RecurringEditor", { id: item.id });
  };

  const handleAddNew = () => {
    navigation.navigate("RecurringEditor");
  };

  const handleApplyDueNow = () => {
    if (!accounts.length) {
      Alert.alert(
        "No accounts",
        "You need at least one account before applying recurring items."
      );
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let created = 0;

    recurring.forEach((r) => {
      if (r.active === false) return;

      const nextDate = r.nextDueDate ? new Date(r.nextDueDate) : today;
      nextDate.setHours(0, 0, 0, 0);

      if (nextDate > today) return;

      const amountNum = Number(r.amount) || 0;
      if (!amountNum) return;

      // --- Recurring transfer ---
      if (r.isTransfer && r.fromAccountId && r.toAccountId) {
        if (accounts.length < 2) return;
        if (r.fromAccountId === r.toAccountId) return;

        const fromAcc = accounts.find((a: any) => a.id === r.fromAccountId);
        const toAcc = accounts.find((a: any) => a.id === r.toAccountId);
        if (!fromAcc || !toAcc) return;

        const now = new Date();
        const isoDate = now.toISOString();

        const outNote = r.title || "Transfer out";
        const inNote = r.title || "Transfer in";

        // Outgoing (expense)
        actions.addTransaction({
          accountId: r.fromAccountId,
          amount: amountNum,
          type: "expense",
          date: isoDate,
          category: "Transfer",
          note: outNote,
        });

        // Incoming (income)
        actions.addTransaction({
          accountId: r.toAccountId,
          amount: amountNum,
          type: "income",
          date: isoDate,
          category: "Transfer",
          note: inNote,
        });

        const newNext = advanceDate(nextDate, r.frequency);
        actions.updateRecurring(r.id, {
          nextDueDate: newNext.toISOString(),
        });

        created += 2;
        return;
      }

      // --- Single-account recurring ---
      const fallbackAccountId = accounts[0].id;
      const accountId = r.accountId || fallbackAccountId;
      const txType: "income" | "expense" = r.type ?? "expense";

      actions.addTransaction({
        accountId,
        amount: amountNum,
        type: txType,
        date: new Date().toISOString(),
        note: r.title,
        category: null,
      });

      const newNext = advanceDate(nextDate, r.frequency);
      actions.updateRecurring(r.id, {
        nextDueDate: newNext.toISOString(),
      });

      created += 1;
    });

    if (created === 0) {
      Alert.alert("Nothing due", "No recurring items were due today.");
    } else {
      Alert.alert(
        "Recurring applied",
        `Created ${created} transaction${created === 1 ? "" : "s"}.`
      );
    }
  };

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ paddingBottom: 32 }}>
      <Text style={styles.h1}>Recurring Payments</Text>

      <Pressable style={styles.applyButton} onPress={handleApplyDueNow}>
        <Text style={styles.applyButtonText}>Apply due now</Text>
      </Pressable>

      {recurring.length === 0 && (
        <Text style={styles.subtle}>
          No recurring items yet. Tap "Add Recurring" to create one.
        </Text>
      )}

      {recurring.map((r) => {
        const isTransfer = !!r.isTransfer;
        const amountStr = `£${Number(r.amount).toFixed(2)}`;
        const freqStr = FREQUENCY_LABEL[r.frequency];

        let extraStr = "";
        if (isTransfer && r.fromAccountId && r.toAccountId) {
          const fromAcc = accounts.find((a: any) => a.id === r.fromAccountId);
          const toAcc = accounts.find((a: any) => a.id === r.toAccountId);
          const fromName = fromAcc?.name || "From";
          const toName = toAcc?.name || "To";
          extraStr = `Transfer ${fromName} → ${toName}`;
        } else if (r.type) {
          extraStr = r.type === "income" ? "Income" : "Expense";
        }

        const subtitleParts = [amountStr, freqStr];
        if (extraStr) subtitleParts.push(extraStr);
        const subtitle = subtitleParts.join(" • ");

        return (
          <View key={r.id} style={styles.card}>
            <Pressable onPress={() => handleEdit(r)}>
              <Text style={styles.itemTitle}>
                {r.title || (isTransfer ? "Recurring transfer" : "Recurring item")}
              </Text>
              <Text style={styles.itemSubtitle}>{subtitle}</Text>
              {r.nextDueDate && (
                <Text style={styles.subtle}>
                  Next due: {new Date(r.nextDueDate).toLocaleDateString()}
                </Text>
              )}
            </Pressable>

            <View style={styles.rowActions}>
              <Pressable onPress={() => handleToggleActive(r)}>
                <Text
                  style={[
                    styles.badge,
                    r.active !== false ? styles.badgeActive : styles.badgePaused,
                  ]}
                >
                  {r.active !== false ? "Active" : "Paused"}
                </Text>
              </Pressable>

              <Pressable onPress={() => handleDelete(r)}>
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        );
      })}

      <Pressable style={styles.button} onPress={handleAddNew}>
        <Text style={styles.buttonText}>Add Recurring</Text>
      </Pressable>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: "#050816",
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  h1: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 16,
  },
  subtle: {
    color: "#9ca3af",
    marginBottom: 8,
  },
  applyButton: {
    backgroundColor: "#0f172a",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2563eb",
    marginBottom: 16,
  },
  applyButtonText: {
    color: "#bfdbfe",
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  itemSubtitle: {
    color: "#9ca3af",
    marginTop: 4,
  },
  rowActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 10,
    columnGap: 16,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 12,
    overflow: "hidden",
  },
  badgeActive: {
    color: "#22c55e",
  },
  badgePaused: {
    color: "#fbbf24",
  },
  deleteText: {
    color: "#f87171",
    fontSize: 14,
  },
  button: {
    marginTop: 24,
    backgroundColor: "#2563eb",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 32,
  },
  buttonText: {
    color: "#f9fafb",
    fontWeight: "600",
    fontSize: 16,
  },
});

export default RecurringScreen;
