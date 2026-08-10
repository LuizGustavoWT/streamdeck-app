import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import type { ButtonConfig } from '../services/OpenDeckBridge';

interface Props {
  config: ButtonConfig | null;
  size: number;
  onPress: () => void;
}

/**
 * Individual Stream Deck button on the grid.
 * Shows the button's title and color if configured, or a placeholder.
 */
export function StreamDeckButton({ config, size, onPress }: Props) {
  if (!config) {
    return (
      <TouchableOpacity
        style={[styles.button, styles.emptyButton, { width: size, height: size }]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Text style={styles.plusText}>+</Text>
      </TouchableOpacity>
    );
  }

  const { state, actionUuid } = config;
  const actionName = actionUuid.split('.').pop()?.replace(/([A-Z])/g, ' $1').trim() ?? actionUuid;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        styles.configuredButton,
        { width: size, height: size },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.title,
          {
            color: state.titleColor,
            fontSize: Math.max(8, size / 5),
            fontWeight: state.fontStyle === 'Bold' ? '700' : '400',
          },
        ]}
        numberOfLines={3}
        ellipsizeMode="tail"
      >
        {state.title || actionName}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  emptyButton: {
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#0f3460',
    borderStyle: 'dashed',
  },
  configuredButton: {
    backgroundColor: '#16213e',
    borderWidth: 1,
    borderColor: '#533483',
  },
  plusText: {
    color: '#444',
    fontSize: 20,
    fontWeight: '300',
  },
  title: {
    textAlign: 'center',
    lineHeight: undefined,
  },
});
