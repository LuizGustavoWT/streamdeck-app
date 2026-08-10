import React from 'react';
import { View, StyleSheet } from 'react-native';
import { StreamDeckButton } from './StreamDeckButton';
import type { DeckButton } from '../../shared/protocol';

interface Props {
  columns: number;
  rows: number;
  buttons: DeckButton[];
  onButtonPress: (col: number, row: number) => void;
}

export function StreamDeckGrid({ columns, rows, buttons, onButtonPress }: Props) {
  const gap = 4; const pad = 8; const maxW = 360;
  const size = Math.floor((maxW - pad * 2 - gap * (columns - 1)) / columns);

  return (
    <View style={[styles.cont, { maxWidth: maxW + pad * 2 }]}>
      {Array.from({ length: rows }, (_, row) => (
        <View key={row} style={[styles.row, { gap }]}>
          {Array.from({ length: columns }, (_, col) => {
            const btn = buttons.find(b => b.column === col && b.row === row);
            return <StreamDeckButton key={`${col}-${row}`} button={btn ?? null} size={size} onPress={() => onButtonPress(col, row)} />;
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  cont: { backgroundColor: '#0d1117', borderRadius: 16, padding: 8, alignSelf: 'center' },
  row: { flexDirection: 'row', marginBottom: 4 },
});
