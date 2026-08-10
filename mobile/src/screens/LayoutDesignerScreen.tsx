import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { useBridge } from '../hooks/useBridge';
import { useLayout } from '../hooks/useLayout';
import { StreamDeckGrid } from '../components/StreamDeckGrid';

type Props = NativeStackScreenProps<RootStackParamList, 'LayoutDesigner'>;

/** Common Stream Deck layouts */
const LAYOUT_PRESETS = [
  { label: 'Mini (3×2)', columns: 3, rows: 2 },
  { label: 'MK.2 (5×3)', columns: 5, rows: 3 },
  { label: 'XL (8×4)', columns: 8, rows: 4 },
  { label: 'Neo (2×1 + Touch)', columns: 2, rows: 1 },
];

export function LayoutDesignerScreen({ navigation }: Props) {
  const { pushLayoutToDeck, status } = useBridge();
  const {
    layout,
    setSelectedPosition,
    setDimensions,
    clearLayout,
    setLayoutName,
  } = useLayout(5, 3);

  const [pushing, setPushing] = useState(false);

  const handleButtonPress = useCallback(
    (col: number, row: number) => {
      setSelectedPosition({ column: col, row });
      navigation.navigate('ButtonEditor', { column: col, row });
    },
    [navigation, setSelectedPosition]
  );

  const handlePushLayout = useCallback(async () => {
    setPushing(true);
    try {
      const layoutToPush = {
        ...layout,
        deviceId: status?.activeDeviceId || status?.devices?.[0]?.id || '',
      };
      const result = await pushLayoutToDeck(layoutToPush);
      if (result.success) {
        Alert.alert('Success', 'Layout pushed to Stream Deck!');
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to push layout. Is the plugin connected?');
    } finally {
      setPushing(false);
    }
  }, [layout, status, pushLayoutToDeck]);

  const handleClear = useCallback(() => {
    Alert.alert('Clear Layout', 'Remove all buttons from the layout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: clearLayout },
    ]);
  }, [clearLayout]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Device selector */}
      <View style={styles.presetRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {LAYOUT_PRESETS.map((preset) => (
            <TouchableOpacity
              key={preset.label}
              style={[
                styles.presetButton,
                layout.dimensions.columns === preset.columns &&
                  layout.dimensions.rows === preset.rows &&
                  styles.presetActive,
              ]}
              onPress={() => setDimensions(preset.columns, preset.rows)}
            >
              <Text
                style={[
                  styles.presetText,
                  layout.dimensions.columns === preset.columns &&
                    layout.dimensions.rows === preset.rows &&
                    styles.presetTextActive,
                ]}
              >
                {preset.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Stream Deck Grid */}
      <View style={styles.gridContainer}>
        <StreamDeckGrid
          columns={layout.dimensions.columns}
          rows={layout.dimensions.rows}
          buttons={layout.buttons}
          onButtonPress={handleButtonPress}
        />
      </View>

      <Text style={styles.buttonCount}>
        {layout.buttons.length} button{layout.buttons.length !== 1 ? 's' : ''} configured
      </Text>

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.pushButton} onPress={handlePushLayout} disabled={pushing}>
          <Text style={styles.pushText}>
            {pushing ? 'Pushing...' : '🚀 Push to Stream Deck'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.previewButton} onPress={() => navigation.navigate('LivePreview')}>
          <Text style={styles.previewText}>👁️ Live Preview</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
        <Text style={styles.clearText}>Clear All Buttons</Text>
      </TouchableOpacity>

      {/* Connected device info */}
      {status?.devices && status.devices.length > 0 && (
        <View style={styles.deviceInfo}>
          <Text style={styles.deviceTitle}>Connected Devices</Text>
          {status.devices.map((d) => (
            <Text key={d.id} style={styles.deviceText}>
              🎛️ {d.name} ({d.size.columns}×{d.size.rows})
            </Text>
          ))}
        </View>
      )}
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
  presetRow: {
    marginBottom: 16,
  },
  presetButton: {
    backgroundColor: '#16213e',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  presetActive: {
    borderColor: '#533483',
    backgroundColor: '#1e1645',
  },
  presetText: {
    color: '#a0a0b0',
    fontSize: 13,
    fontWeight: '500',
  },
  presetTextActive: {
    color: '#e0e0e0',
  },
  gridContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonCount: {
    color: '#a0a0b0',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  pushButton: {
    flex: 1,
    backgroundColor: '#533483',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  pushText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  previewButton: {
    flex: 1,
    backgroundColor: '#16213e',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  previewText: {
    color: '#e0e0e0',
    fontSize: 15,
    fontWeight: '600',
  },
  clearButton: {
    backgroundColor: 'transparent',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e94560',
  },
  clearText: {
    color: '#e94560',
    fontSize: 14,
    fontWeight: '500',
  },
  deviceInfo: {
    marginTop: 20,
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  deviceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e0e0e0',
    marginBottom: 8,
  },
  deviceText: {
    fontSize: 13,
    color: '#c0c0c0',
    marginBottom: 4,
  },
});
