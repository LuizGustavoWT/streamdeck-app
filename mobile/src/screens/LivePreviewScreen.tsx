import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { onEvent, onConnectionStateChange, requestLayout, getConnectionState } from '../services/OpenDeckBridge';
import { StreamDeckGrid } from '../components/StreamDeckGrid';
import type { DeckLayout, PluginToMobileEvent } from '../../shared/protocol';

type Props = NativeStackScreenProps<RootStackParamList, 'LivePreview'>;

export function LivePreviewScreen({ navigation }: Props) {
  const [layout, setLayout] = useState<DeckLayout | null>(null);
  const [cs, setCs] = useState(getConnectionState());
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    const u1 = onConnectionStateChange(setCs);
    const u2 = onEvent((ev: PluginToMobileEvent) => {
      const ts = new Date().toLocaleTimeString();
      switch (ev.type) {
        case 'layoutUpdate': setLayout(ev.layout); break;
        case 'buttonAppeared': setLog(l => [`[${ts}] + ${ev.button.actionName} (${ev.button.column},${ev.button.row})`, ...l].slice(0, 30)); break;
        case 'buttonDisappeared': setLog(l => [`[${ts}] - btn`, ...l].slice(0, 30)); break;
        case 'keyDown': setLog(l => [`[${ts}] ▼ key (${ev.column},${ev.row})`, ...l].slice(0, 30)); break;
        case 'keyUp': setLog(l => [`[${ts}] ▲ key (${ev.column},${ev.row})`, ...l].slice(0, 30)); break;
      }
    });
    if (cs === 'connected') requestLayout();
    return () => { u1(); u2(); };
  }, [cs]);

  const handlePress = useCallback((col: number, row: number) => {
    const btn = layout?.buttons.find(b => b.column === col && b.row === row);
    if (btn) navigation.navigate('ButtonEditor', { column: col, row, context: btn.context });
  }, [layout, navigation]);

  return (
    <ScrollView style={styles.cont} contentContainerStyle={styles.inner}>
      <View style={styles.bar}>
        <View style={[styles.dot, { backgroundColor: cs === 'connected' ? '#4ade80' : '#e94560' }]} />
        <Text style={styles.barT}>{cs === 'connected' ? 'Connected' : cs}{layout ? ` — ${layout.buttons.length} buttons` : ''}</Text>
      </View>
      {layout && layout.buttons.length > 0 ? (
        <View style={styles.gw}><StreamDeckGrid columns={layout.dimensions.columns} rows={layout.dimensions.rows} buttons={layout.buttons} onButtonPress={handlePress} /></View>
      ) : (
        <View style={styles.place}>
          <Text style={styles.pIcon}>🎛️</Text>
          <Text style={styles.pT}>No buttons on the Stream Deck yet</Text>
          <Text style={styles.pSub}>Open OpenDeck, create a profile, and drag "StreamDeck Mobile" actions onto buttons.</Text>
          <TouchableOpacity style={styles.refBtn} onPress={() => requestLayout()}><Text style={styles.refT}>Refresh</Text></TouchableOpacity>
        </View>
      )}
      <View style={styles.logSec}>
        <Text style={styles.logT}>Events</Text>
        <View style={styles.logB}>
          {log.length === 0 ? <Text style={styles.logE}>Press buttons on your Stream Deck...</Text>
            : log.map((e, i) => <Text key={i} style={styles.logL}>{e}</Text>)}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cont: { flex: 1 }, inner: { padding: 16, paddingBottom: 40 },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 10, backgroundColor: '#16213e', borderRadius: 8, borderWidth: 1, borderColor: '#0f3460', marginBottom: 16 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 }, barT: { color: '#e0e0e0', fontSize: 14, fontWeight: '500' },
  gw: { alignItems: 'center', marginBottom: 16 },
  place: { alignItems: 'center', padding: 40, backgroundColor: '#16213e', borderRadius: 12, borderWidth: 1, borderColor: '#0f3460', marginBottom: 16 },
  pIcon: { fontSize: 48, marginBottom: 12 }, pT: { fontSize: 16, fontWeight: '600', color: '#e0e0e0', marginBottom: 8 },
  pSub: { fontSize: 13, color: '#a0a0b0', textAlign: 'center', lineHeight: 20 },
  refBtn: { marginTop: 16, backgroundColor: '#533483', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 }, refT: { color: '#fff', fontSize: 14, fontWeight: '600' },
  logSec: { marginTop: 8 }, logT: { fontSize: 12, color: '#a0a0b0', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  logB: { backgroundColor: '#0d1117', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#0f3460', minHeight: 150, maxHeight: 300 },
  logE: { color: '#555', fontSize: 13, textAlign: 'center', marginTop: 40, fontStyle: 'italic' },
  logL: { color: '#4ade80', fontSize: 11, fontFamily: 'monospace', marginBottom: 3 },
});
