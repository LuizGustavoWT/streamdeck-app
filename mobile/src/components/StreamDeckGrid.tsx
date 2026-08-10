import React from 'react';
import { View, StyleSheet } from 'react-native';
import { StreamDeckButton } from './StreamDeckButton';
import type { ButtonConfig } from '../services/OpenDeckBridge';

interface Props {
  columns: number;
  rows: number;
  buttons: ButtonConfig[];
  onButtonPress: (col: number, row: number) => void;
}

/**
 * Renders a Stream Deck button grid matching the device dimensions.
 */
export function StreamDeckGrid({ columns, rows, buttons, onButtonPress }: Props) {
  // Calculate button size based on screen width (roughly 360px usable)
  const gap = 4;
  const containerPadding = 8;
  const maxWidth = 360;
  const buttonSize = Math.floor(
    (maxWidth - containerPadding * 2 - gap * (columns - 1)) / columns
  );

  return (
    <View style={[styles.container, { maxWidth: maxWidth + containerPadding * 2 }]}>
      {Array.from({ length: rows }, (_, row) => (
        <View key={row} style={[styles.row, { gap }]}>
          {Array.from({ length: columns }, (_, col) => {
            const button = buttons.find(
              (b) => b.position.column === col && b.position.row === row
            );
            return (
              <StreamDeckButton
                key={`${col}-${row}`}
                config={button ?? null}
                size={buttonSize}
                onPress={() => onButtonPress(col, row)}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0d1117',
    borderRadius: 16,
    padding: 8,
    alignSelf: 'center',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
});
