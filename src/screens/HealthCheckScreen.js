// src/screens/HealthCheckScreen.js
import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { getDb } from '../db/db';
import { runMigrations } from '../db/migrate';


export default function HealthCheckScreen({ navigation }) {
  const [logs, setLogs] = React.useState([]);
  const log = (msg) => setLogs((l) => [...l, msg]);

  React.useEffect(() => {
    (async () => {
      try {
        log('Running migrations…');
        await runMigrations();
        log('Migrations OK');

        const db = await getDb();

        const tables = await db.getAllAsync("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
        log('Tables: ' + tables.map(t => t.name).join(', '));

        const info = async (name) => {
          const r = await db.getAllAsync(`PRAGMA table_info(${name})`);
          log(`Schema ${name}: ` + (r.map(c => `${c.name}:${c.type}`).join(', ') || '—'));
        };

        await info('transactions');
        await info('accounts');
        await info('reports');
        const txCount = await db.getFirstAsync('SELECT COUNT(1) as n FROM transactions').catch(() => null);
        log('transactions count: ' + (txCount?.n ?? 'N/A'));

        log('Health check done. You can continue.');
      } catch (e) {
        log('ERROR: ' + String(e && e.message || e));
      }
    })();
  }, []);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
      <Text style={{ fontWeight: '700', fontSize: 18 }}>Health Check</Text>
      {logs.map((l, i) => <Text key={i} style={{ fontFamily: 'System' }}>{l}</Text>)}

      <View style={{ height: 16 }} />
      <Pressable
        onPress={() => navigation.replace('Dashboard')}
        style={{ borderWidth: 1, borderRadius: 10, padding: 12, alignSelf: 'flex-start' }}
      >
        <Text>Go to app</Text>
      </Pressable>
    </ScrollView>
  );
}
