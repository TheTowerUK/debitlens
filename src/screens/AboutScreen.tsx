// src/screens/AboutScreen.tsx
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { colors as theme } from '../theme/colors';

export default function AboutScreen() {
  const version = useMemo(() => {
    const v =
      (Constants.expoConfig as any)?.version ||
      (Constants.manifest as any)?.version ||
      (Constants as any)?.nativeAppVersion ||
      '';
    const build =
      (Constants.expoConfig as any)?.ios?.buildNumber ||
      (Constants.expoConfig as any)?.android?.versionCode ||
      (Constants.manifest as any)?.ios?.buildNumber ||
      (Constants.manifest as any)?.android?.versionCode ||
      (Constants as any)?.nativeBuildVersion ||
      '';
    if (v && build) return `v${v} (${build})`;
    if (v) return `v${v}`;
    return '';
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>About DebitLens</Text>
        <Text style={styles.lead}>
          DebitLens is built around one idea: <Text style={styles.bold}>financial clarity comes from awareness — not automation.</Text>
        </Text>

        <Text style={styles.body}>
          DebitLens doesn't link directly to bank accounts. That's intentional. By keeping your data local and in your control, DebitLens helps you stay
          connected to what you spend, why you spend it, and what's coming next.
        </Text>

        <View style={styles.divider} />

        <Text style={styles.h2}>What DebitLens focuses on</Text>
        <Bullet text="Income, expenses, and transfers — clearly tracked" />
        <Bullet text="Recurring payments — visible ahead of time" />
        <Bullet text="Weekly and monthly cash-flow awareness" />
        <Bullet text="Categorisation you control" />

        <View style={styles.divider} />

        <Text style={styles.h2}>Built for trust</Text>
        <Bullet text="No bank credentials stored" />
        <Bullet text="No required third-party aggregation" />
        <Bullet text="No ads and no “data selling” incentives" />
        <Bullet text="Your data stays on your device, with export/backup options" />

        <View style={styles.divider} />

        <Text style={styles.tagline}>Your money. Your data. Your rules.</Text>

        {version ? <Text style={styles.footer}>DebitLens {version}</Text> : null}
      </View>
    </ScrollView>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 16, paddingBottom: 28 },

  card: {
    backgroundColor: theme.card,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },

  title: {
    color: theme.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },

  lead: {
    color: theme.text,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 10,
  },

  body: {
    color: theme.textDim,
    fontSize: 14,
    lineHeight: 21,
  },

  bold: { fontWeight: '800' },

  h2: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 8,
  },

  divider: {
    height: 1,
    backgroundColor: theme.border,
    marginVertical: 14,
    opacity: 0.9,
  },

  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  bulletDot: { color: theme.text, fontSize: 16, lineHeight: 20, marginRight: 8 },
  bulletText: {
    flex: 1,
    color: theme.textDim,
    fontSize: 14,
    lineHeight: 20,
  },

  tagline: {
    color: theme.link,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 4,
  },

  footer: {
    marginTop: 12,
    textAlign: 'center',
    color: theme.textDim,
    fontSize: 12,
  },
});
