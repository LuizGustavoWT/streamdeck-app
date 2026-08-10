import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import type { ActionInfo } from '../services/OpenDeckBridge';

interface Props {
  action: ActionInfo;
  onPress: () => void;
}

/**
 * Card component for displaying an available action in the picker.
 */
export function ActionCard({ action, onPress }: Props) {
  const iconEmoji = getIconForAction(action.uuid);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>{iconEmoji}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{action.name}</Text>
        <Text style={styles.tooltip}>{action.tooltip}</Text>
      </View>
      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  );
}

function getIconForAction(uuid: string): string {
  if (uuid.includes('custombutton')) return '🔘';
  if (uuid.includes('urlopener')) return '🔗';
  if (uuid.includes('hotkey')) return '⌨️';
  if (uuid.includes('textinput')) return '📝';
  return '⚡';
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 20,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#e0e0e0',
    marginBottom: 2,
  },
  tooltip: {
    fontSize: 12,
    color: '#a0a0b0',
  },
  arrow: {
    fontSize: 22,
    color: '#555',
    marginLeft: 8,
  },
});
