// src/components/ActionFab.tsx
import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
  AccessibilityRole,
} from 'react-native';

import { colors as theme } from '../theme/colors';

type ActionItem = {
  key: string;
  label: string;
  onPress: () => void;
};

type ActionFabProps = {
  items: ActionItem[];
  footer?: { label: string; onPress: () => void } | null;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
};

const AnimatedView = Animated.View;

export default function ActionFab({
  items,
  footer = null,
  accessibilityRole,
  accessibilityLabel,
}: ActionFabProps) {
  const anim = React.useRef(new Animated.Value(0)).current;
  const [open, setOpen] = React.useState(false);

  const toggle = React.useCallback(() => {
    const toValue = open ? 0 : 1;
    Animated.timing(anim, {
      toValue,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      setOpen((prev) => !prev);
    });
    // Optimistically flip open state so pointerEvents/etc react immediately
    setOpen((prev) => !prev);
  }, [anim, open]);

  const rotate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  return (
    <View pointerEvents="box-none" style={styles.container}>
      <View style={styles.menu}>
        {items.map((it, i) => {
          const offset = (i + 1) * -60;
          const translateY = anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, offset],
          });
          const opacity = anim.interpolate({
            inputRange: [0, 0.6, 1],
            outputRange: [0, 0.5, 1],
          });

          return (
            <AnimatedView
              key={it.key}
              style={[styles.itemWrapper, { transform: [{ translateY }], opacity }]}
              pointerEvents={open ? 'auto' : 'none'}
            >
              <Pressable onPress={it.onPress} style={styles.itemButton} accessibilityRole="button">
                <Text style={styles.itemLabel}>{it.label}</Text>
              </Pressable>
            </AnimatedView>
          );
        })}

        {footer ? (
          <View style={styles.footer}>
            <Pressable onPress={footer.onPress} style={styles.footerButton} accessibilityRole="button">
              <Text style={styles.footerText}>{footer.label}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <Pressable
        onPress={toggle}
        style={styles.fabButton}
        accessibilityRole={accessibilityRole ?? 'button'}
        accessibilityLabel={accessibilityLabel ?? 'Open menu'}
      >
        <Animated.View style={[styles.plus, { transform: [{ rotate }] }]}>
          <Text style={styles.plusText}>+</Text>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 18,
    bottom: 28,
    alignItems: 'center',
  },
  menu: {
    marginBottom: 12,
    alignItems: 'center',
  },
  itemWrapper: {
    position: 'absolute',
    right: 0,
    width: 160,
    alignItems: 'flex-end',
  },
  itemButton: {
    backgroundColor: theme.cardAlt,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  itemLabel: {
    color: '#fff',
    fontWeight: '700',
  },
  footer: {
    marginBottom: 8,
  },
  footerButton: {
    backgroundColor: '#0ea5a4',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  footerText: {
    color: '#fff',
    fontWeight: '700',
  },
  fabButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  plus: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusText: {
    color: '#fff',
    fontSize: 28,
    lineHeight: 28,
    fontWeight: '800',
  },
});
