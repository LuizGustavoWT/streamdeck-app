import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { useBridge } from '../hooks/useBridge';
import { useLayout } from '../hooks/useLayout';
import { StreamDeckGrid } from '../components/StreamDeckGrid';
import type { PluginToMobileEvent } from '../services/OpenDeckBridge';

type Props = NativeStackScreenProps<RootStackParamList, 'LivePreview'>;

export function LivePreviewScreen({ navigation }: Props) {
  const { lastEvent, connectionState } = useBridge();
  const { layout, updateButtonState } = useLayout(5, 3);
  const [eventLog, setEventLog] = useState<string[]>([]);

  useEffect(() => {
    if (lastEvent) {
      const timestamp = new Date().toLocaleTimeString();
      let logLine = `[${timestamp}] ${lastEvent.type}`;

      if (lastEvent.type === 'keyDown') {
        logLine += ` — button ${lastEvent.buttonId}`;
        // Flash the button visual
        updateButtonState(lastEvent.buttonId as string, {
          titleColor: '#e94560',
        });
        setTimeout(() => {
          updateButtonState(lastEvent.buttonId as string, {
            titleColor: '#FFFFFF',
          });
        }, 200);
      }

      if (lastEvent.type === 'keyUp') {
        logLine += ` — button ${lastEvent.buttonId}`;
      }

      if (lastEvent.type === 'deviceConnected') {
        logLine += ` — ${(lastEvent as PluginToMobileEvent & { device: { name: string } }).device?.name ?? 'Unknown'}`;
      }

      setEventLog(prev => [logLine, ...prev].slice(0, 20));
    }
  }, [lastEvent, updateButtonState]);

  const handleButtonPress = (col: number, row: number) => {
    // In preview mode, taps are just for show
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Connection indicator */}
      <View style={styles.statusBar}>
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor:
                connectionState === 'connected' ? '#4ade80' : '#e94560',
            },
          ]}
        />
        <Text style={styles.statusText}>
          {connectionState === 'connected' ? 'Connected' : 'Disconnected'}
        </Text>
      </View>

      {/* Stream Deck Mirror */}
      <View style={styles.gridContainer}>
        <Text style={styles.sectionTitle}>Stream Deck Mirror</Text>
        <StreamDeckGrid
          columns={layout.dimensions.columns}
          rows={layout.dimensions.rows}
          buttons={layout.buttons}
          onButtonPress={handleButtonPress}
        />
      </View>

      {/* Event Log */}
      <View style={styles.logContainer}>
        <Text style={styles.sectionTitle}>Event Log</Text>
        <View style={styles.logBox}>
          {eventLog.length === 0 ? (
            <Text style={styles.logEmpty}>
              Press buttons on your Stream Deck to see events here...
            </Text>
          ) : (
            eventLog.map((entry, i) => (
              <Text key={i} style={styles.logEntry}>
                {entry}
              </Text>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    padding: 10,
    backgroundColor: '#16213e',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    color: '#e0e0e0',
    fontSize: 14,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#a0a0b0',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    textAlign: 'center',
  },
  gridContainer: {
    marginBottom: 24,
  },
  logContainer: {
    flex: 1,
  },
  logBox: {
    backgroundColor: '#0d1117',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#0f3460',
    minHeight: 200,
    maxHeight: 300,
  },
  logEmpty: {
    color: '#555',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 40,
    fontStyle: 'italic',
  },
  logEntry: {
    color: '#4ade80',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 3,
    lineHeight: 18,
  },
});
