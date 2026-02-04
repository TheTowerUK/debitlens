// src/screens/PrivacyPolicyScreen.tsx
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { colors as theme } from '../theme/colors';

export default function PrivacyPolicyScreen() {
  const lastUpdated = useMemo(() => {
    // Keep this as a static string you update on release.
    // Example: '10 Feb 2026'
    return 'TBD';
  }, []);

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
        <Text style={styles.title}>Privacy Policy</Text>

        <Text style={styles.meta}>
          {lastUpdated !== 'TBD' ? `Last updated: ${lastUpdated}` : 'Last updated: (set on release)'}
        </Text>

        <Text style={styles.body}>
          DebitLens is designed with privacy and data ownership as core principles. This policy explains what data the app uses,
          how it is handled, and what control you have.
        </Text>

        <Divider />

        <Section title="1. Data you enter">
          <P>
            DebitLens stores the financial information you choose to enter into the app, such as accounts, transactions, categories,
            recurring payments, and budgets.
          </P>
          <P>Your data is stored locally on your device.</P>
          <P>DebitLens does not automatically access your bank accounts and does not require bank credentials.</P>
        </Section>

        <Divider />

        <Section title="2. Data storage and control">
          <P>
            Your financial data remains on your device. It is not uploaded to DebitLens servers and is not shared with third parties
            by default.
          </P>
          <P>
            Any sharing or exporting of data is explicitly initiated by you (for example via export or backup actions).
          </P>
        </Section>

        <Divider />

        <Section title="3. Network access">
          <P>
            DebitLens does not require continuous internet access to function.
          </P>
          <P>
            The app may make limited network requests for app updates or platform services. No financial data is transmitted
            automatically as part of normal app usage.
          </P>
        </Section>

        <Divider />

        <Section title="4. Analytics and diagnostics">
          <P>DebitLens does not use advertising trackers.</P>
          <P>
            Basic diagnostic information (such as crash reports) may be collected by your operating system or platform services
            to help improve app stability. This does not include your financial records.
          </P>
        </Section>

        <Divider />

        <Section title="5. Third-party services">
          <P>DebitLens does not use third-party financial aggregation services.</P>
          <P>
            Some operating system or platform features (for example, file selection or sharing) may be provided by your device or
            app platform and operate under their own privacy policies.
          </P>
        </Section>

        <Divider />

        <Section title="6. Data retention and deletion">
          <P>
            Because your data is stored locally, you can delete your financial data at any time by clearing app data,
            uninstalling the app, or using in-app reset options (where available).
          </P>
        </Section>

        <Divider />

        <Section title="7. Children's privacy">
          <P>DebitLens is not intended for use by children under the age of 13.</P>
        </Section>

        <Divider />

        <Section title="8. Changes to this policy">
          <P>
            If this Privacy Policy changes, the updated version will be made available within the app and through official
            distribution channels.
          </P>
        </Section>

        <Divider />

        <Section title="9. Contact">
          <P>If you have questions about this Privacy Policy, contact:</P>
          <P>
            <Text style={styles.bold}>Email:</Text> (add your support email)
          </P>
        </Section>

        {version ? <Text style={styles.footer}>DebitLens {version}</Text> : null}
      </View>
    </ScrollView>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.h2}>{title}</Text>
      {children}
    </View>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <Text style={styles.body}>{children}</Text>;
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
    marginBottom: 4,
  },

  meta: {
    color: theme.textDim,
    fontSize: 12,
    marginBottom: 10,
  },

  section: { marginTop: 2 },

  h2: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 8,
  },

  body: {
    color: theme.textDim,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 8,
  },

  bold: { fontWeight: '800' as const, color: theme.text },

  divider: {
    height: 1,
    backgroundColor: theme.border,
    marginVertical: 12,
    opacity: 0.9,
  },

  footer: {
    marginTop: 12,
    textAlign: 'center',
    color: theme.textDim,
    fontSize: 12,
  },
});
