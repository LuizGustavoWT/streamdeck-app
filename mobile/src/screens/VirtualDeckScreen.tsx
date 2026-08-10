import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'VirtualDeck'>;

interface ButtonData {
  index: number;
  col: number;
  row: number;
  imageBase64: string;
}

interface DeckState {
  columns: number;
  rows: number;
  buttons: ButtonData[];
}

const DAEMON_PORT = 58124;

export function VirtualDeckScreen({ route }: Props) {
  const { host } = route.params;
  const [deck, setDeck] = useState<DeckState | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(`ws://${host}:${DAEMON_PORT}`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        // Could be full state or single button update
        if (data.columns !== undefined) {
          setDeck(data as DeckState);
        } else if (data.index !== undefined) {
          setDeck(prev => {
            if (!prev) return prev;
            const buttons = [...prev.buttons];
            const idx = buttons.findIndex(b => b.index === data.index);
            if (idx >= 0) buttons[idx] = data;
            else buttons.push(data);
            return { ...prev, buttons };
          });
        }
      } catch {}
    };

    return () => ws.close();
  }, [host]);

  const handlePress = useCallback((index: number) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'buttonDown', index }));
    setTimeout(() => {
      ws.send(JSON.stringify({ type: 'buttonUp', index }));
    }, 100);
  }, []);

  if (!deck) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loading}>Waiting for Stream Deck...</Text>
        <Text style={styles.hint}>Make sure OpenDeck is running and the daemon is active on port {DAEMON_PORT}</Text>
      </View>
    );
  }

  const gap = 4;
  const maxW = 360;
  const pad = 16;
  const btnSize = Math.floor((maxW - pad * 2 - gap * (deck.columns - 1)) / deck.columns);

  return (
    <ScrollView style={styles.cont} contentContainerStyle={styles.inner}>
      <View style={styles.bar}>
        <View style={[styles.dot, { backgroundColor: connected ? '#4ade80' : '#e94560' }]} />
        <Text style={styles.barT}>{connected ? 'Connected' : 'Disconnected'}</Text>
      </View>

      <View style={[styles.grid, { maxWidth: maxW }]}>
        {Array.from({ length: deck.rows }, (_, row) => (
          <View key={row} style={[styles.row, { gap }]}>
            {Array.from({ length: deck.columns }, (_, col) => {
              const idx = col + row * deck.columns;
              const btn = deck.buttons.find(b => b.index === idx);
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.btn, { width: btnSize, height: btnSize }]}
                  onPress={() => handlePress(idx)}
                  activeOpacity={0.8}
                >
                  {btn?.imageBase64 ? (
                    <Image
                      source={{ uri: `data:image/jpeg;base64,${btn.imageBase64}` }}
                      style={[styles.img, { width: btnSize - 4, height: btnSize - 4 }]}
                      resizeMode="contain"
                    />
                  ) : (
                    <Text style={styles.emptyT}>{idx + 1}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      <Text style={styles.footer}>
        {deck.columns}x{deck.rows} — {deck.buttons.filter(b => b.imageBase64).length} buttons with images
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cont: { flex: 1, backgroundColor: '#1a1a2e' },
  inner: { padding: 16, alignItems: 'center' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, backgroundColor: '#1a1a2e' },
  loading: { color: '#e0e0e0', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  hint: { color: '#a0a0b0', fontSize: 13, textAlign: 'center' },
  bar: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', padding: 10, backgroundColor: '#16213e', borderRadius: 8, borderWidth: 1, borderColor: '#0f3460', marginBottom: 16 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  barT: { color: '#e0e0e0', fontSize: 14, fontWeight: '500' },
  grid: { backgroundColor: '#0d1117', borderRadius: 16, padding: 8 },
  row: { flexDirection: 'row', marginBottom: 4 },
  btn: { borderRadius: 6, backgroundColor: '#16213e', borderWidth: 1, borderColor: '#0f3460', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  img: { borderRadius: 4 },
  emptyT: { color: '#444', fontSize: 14 },
  footer: { color: '#555', fontSize: 12, marginTop: 16 },
});
