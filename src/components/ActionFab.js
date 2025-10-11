// src/components/ActionFab.js
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

export default function ActionFab({ items = [] }) {
  const [open, setOpen] = useState(false);

  const onPick = async (fn) => {
    setOpen(false);
    requestAnimationFrame(() => fn && fn());
  };

  return (
    <>
      {open && (
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
      )}

      {/* Menu panel */}
      {open && (
        <View style={styles.panel}>
          {items.map((it, idx) => (
             <Pressable
              key={it.key ?? it.id ?? `${idx}-${it.label}`}
              onPress={() => onPick(it.onPress)}
              style={({ pressed }) => [
                styles.item,
                pressed && { backgroundColor: '#0F172A' },
              ]}
            >
              <Text style={styles.itemText}>{it.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Main FAB */}
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => [
          styles.fab,
          pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
        ]}
        hitSlop={8}
      >
        <Text style={styles.fabIcon}>{open ? '×' : '≡'}</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  panel: {
    position: 'absolute',
    right: 20,
    bottom: 100, // sits above FAB
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingVertical: 8,
    minWidth: 180,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  item: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  itemText: {
    color: '#E5E7EB',
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  fabIcon: { color: '#fff', fontSize: 32, marginTop: -2 },
});
