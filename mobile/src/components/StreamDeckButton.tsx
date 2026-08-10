import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import type { DeckButton } from '../../shared/protocol';

interface Props { button: DeckButton | null; size: number; onPress: () => void; }

export function StreamDeckButton({ button, size, onPress }: Props) {
  if (!button) {
    return (
      <TouchableOpacity style={[styles.btn, styles.empty, { width: size, height: size }]} onPress={onPress} activeOpacity={0.7}>
        <Text style={styles.emptyT}>·</Text>
      </TouchableOpacity>
    );
  }

  const st = button.states[button.stateIndex] ?? button.states[0];
  const fontSize = Math.max(8, size / 5);

  return (
    <TouchableOpacity style={[styles.btn, styles.filled, { width: size, height: size }]} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.title, { color: st?.titleColor ?? '#fff', fontSize, fontWeight: (st?.fontStyle === 'Bold' ? '700' : '400') as '700' | '400' }]} numberOfLines={3} ellipsizeMode="tail">
        {st?.title || button.actionName}
      </Text>
      {button.groupSize !== '1x1' && <Text style={styles.groupBadge}>{button.groupSize}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { borderRadius: 6, justifyContent: 'center', alignItems: 'center', padding: 4 },
  empty: { backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#0f3460', borderStyle: 'dashed' },
  emptyT: { color: '#333', fontSize: 16 },
  filled: { backgroundColor: '#16213e', borderWidth: 1, borderColor: '#533483' },
  title: { textAlign: 'center' },
  groupBadge: { position: 'absolute', bottom: 2, right: 4, color: '#533483', fontSize: 8, fontWeight: '700' },
});
