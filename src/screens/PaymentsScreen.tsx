// src/screens/Payments.tsx
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Platform } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { useApp } from '../state/AppContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Payments'>;

export default function PaymentsScreen({ navigation }: Props) {
  const { state } = useApp();
  const txs = state.transactions || [];
  const payments = useMemo(() => {
    const list = txs.filter(t => t.type !== 'income');
    list.sort((a,b) => (b.date ? Date.parse(b.date) : 0) - (a.date ? Date.parse(a.date) : 0));
    return list;
  }, [txs]);
  const total = payments.reduce((s,t)=> s + (+t.amount || 0), 0);

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Payments</Text>
      <Text style={styles.subtle}>Your recent spending and outgoings.</Text>
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total spending</Text>
          <Text style={[styles.summaryValue, {color:'#F97373'}]}>-£{total.toFixed(2)}</Text>
        </View>
        <Pressable
          style={styles.addButton}
          onPress={() => navigation.navigate('TxnEditor', { type: 'expense' })}
        >
          <Text style={styles.addButtonText}>Add payment</Text>
        </Pressable>
      </View>
      {payments.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No payments yet</Text>
          <Text style={styles.emptyText}>Add your first expense with the button above.</Text>
        </View>
      ) : (
        <FlatList
          data={payments}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{flex:1}}>
                <Text style={styles.rowLabel}>{item.category || 'Uncategorised'}</Text>
                {item.note ? <Text style={styles.rowNote}>{item.note}</Text> : null}
                {item.date ? <Text style={styles.rowMeta}>{item.date}</Text> : null}
              </View>
              <Text style={styles.rowAmount}>-£{Number(item.amount||0).toFixed(2)}</Text>
            </View>
          )}
          contentContainerStyle={{paddingBottom:24}}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:{flex:1, backgroundColor:'#020617', paddingHorizontal:16, paddingTop: Platform.OS==='ios'?56:24},
  h1:{color:'#fff', fontSize:24, fontWeight:'800', marginBottom:4},
  subtle:{color:'#9CA3AF', marginBottom:16},
  summaryRow:{flexDirection:'row', alignItems:'stretch', marginBottom:12},
  summaryCard:{flex:1, padding:12, borderRadius:12, backgroundColor:'#020617', borderWidth:1, borderColor:'#1F2937', marginRight:8},
  summaryLabel:{color:'#9CA3AF', fontSize:12, marginBottom:4},
  summaryValue:{color:'#F9FAFB', fontSize:16, fontWeight:'800'},
  addButton:{justifyContent:'center', paddingHorizontal:14, borderRadius:12, borderWidth:1, borderColor:'#1F2937', backgroundColor:'#0F172A'},
  addButtonText:{color:'#E5E7EB', fontWeight:'800'},
  emptyBox:{marginTop:8, marginBottom:16, padding:16, borderRadius:12, backgroundColor:'#0F172A'},
  emptyTitle:{color:'#E5E7EB', fontSize:16, fontWeight:'700', marginBottom:4},
  emptyText:{color:'#9CA3AF', fontSize:14},
  row:{flexDirection:'row', alignItems:'center', paddingVertical:10, borderBottomWidth:1, borderBottomColor:'#111827'},
  rowLabel:{color:'#F9FAFB', fontSize:14, fontWeight:'700'},
  rowNote:{color:'#9CA3AF', fontSize:12},
  rowMeta:{color:'#6B7280', fontSize:11, marginTop:2},
  rowAmount:{fontSize:15, fontWeight:'800', marginLeft:12, color:'#F97373'},
});
