// src/components/ActionFab.js
import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
  Platform,
} from 'react-native';

export default function ActionFab({
  items = [],
  footer,                 // { label, onPress }
  bottom = 28,
  right = 28,
  testID = 'action-fab',
}) {
  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current; // 0 closed, 1 open

  const toggle = () => {
    const to = open ? 0 : 1;
    setOpen(!open);
    Animated.timing(anim, {
      toValue: to,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const close = () => {
    if (!open) return;
    setOpen(false);
    Animated.timing(anim, {
      toValue: 0,
      duration: 150,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  // Animated styles
  const backdropStyle = {
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.25] }),
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) }],
    pointerEvents: open ? 'auto' : 'none',
  };

  const menuStyle = {
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
    transform: [
      { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
      { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) },
    ],
  };

  const plusRotate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  // Render list of items
  const entries = useMemo(() => items.filter(Boolean), [items]);

  return (
    <View style={[styles.root, { bottom, right }]} pointerEvents="box-none" testID={testID}>
      {/* Backdrop */}
      <Animated.View
        pointerEvents={open ? 'auto' : 'none'}
        style={[styles.backdrop, backdropStyle]}
      >
        <Pressable style={{ flex: 1 }} onPress={close} />
      </Animated.View>

      {/* Menu card */}
      <Animated.View style={[styles.menuCard, menuStyle]} pointerEvents={open ? 'auto' : 'none'}>
        {entries.map((it, idx) => (
          <Pressable
            key={it.key ?? String(idx)}
            style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
            onPress={() => {
              close();
              try { it.onPress?.(); } catch {}
            }}
            accessibilityRole="button"
            accessibilityLabel={it.label}
          >
            {/* Optional emoji icon support via it.icon */}
            {!!it.icon && <Text style={styles.menuIcon}>{it.icon}</Text>}
            <Text style={styles.menuText}>{it.label}</Text>
          </Pressable>
        ))}

        {/* Footer (e.g., Settings) */}
        {footer ? (
          <>
            <View style={styles.menuDivider} />
            <Pressable
              style={({ pressed }) => [styles.menuItem, styles.menuFooter, pressed && styles.pressed]}
              onPress={() => {
                close();
                try { footer.onPress?.(); } catch {}
              }}
              accessibilityRole="button"
              accessibilityLabel={footer.label}
            >
              <Text style={[styles.menuText, styles.menuTextDim]}>{footer.label}</Text>
            </Pressable>
          </>
        ) : null}
      </Animated.View>

      {/* FAB */}
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={open ? 'Close menu' : 'Open menu'}
      >
        <Animated.Text style={[styles.fabPlus, { transform: [{ rotate: plusRotate }] }]}>＋</Animated.Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    // We’ll position children (backdrop, card, fab) relative to bottom/right via inline style
  },

  // Dim the rest of the screen when open
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    borderRadius: 16, // not visible, just keeps perf hints
  },

  menuCard: {
    position: 'absolute',
    right: 0,
    bottom: (64 + 12), // stay above the FAB
    backgroundColor: '#111827',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 6,
    minWidth: 200,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  menuIcon: { color: '#E5E7EB', marginRight: 8, fontSize: 16 },
  menuText: { color: '#fff', fontWeight: '700' },
  menuTextDim: { color: '#D1D5DB' },

  pressed: { backgroundColor: '#1F2937' },

  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#1F2937',
    marginVertical: 4,
    marginHorizontal: 6,
  },
  menuFooter: {
    // optional: style to differentiate footer
  },

  fab: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: '#2563EB',
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  fabPlus: { color: '#fff', fontSize: 36, marginTop: Platform.OS === 'ios' ? -2 : -1 },
});


