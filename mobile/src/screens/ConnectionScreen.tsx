import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { useBridge } from '../hooks/useBridge';
import { getConnectionState } from '../services/OpenDeckBridge';

type Props = NativeStackScreenProps<RootStackParamList, 'Connection'>;

export function ConnectionScreen({ navigation }: Props) {
  const { status, connectionState, connectToServer, disconnectFromServer } = useBridge();
  const [host, setHost] = useState('192.168.1.100');
  const [port, setPort] = useState('58123');
  const [connecting, setConnecting] = useState(false);

  const isConnected = connectionState === 'connected';

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    try {
      await connectToServer(host, parseInt(port, 10) || 58123);
    } catch {
      Alert.alert('Connection Failed', 'Could not connect to the OpenDeck plugin. Make sure OpenDeck is running with the StreamDeck Mobile plugin installed.');
    } finally {
      setConnecting(false);
    }
  }, [host, port, connectToServer]);

  const handleDisconnect = useCallback(() => {
    disconnectFromServer();
  }, [disconnectFromServer]);

  // Auto-navigate when connected
  useEffect(() => {
    if (isConnected) {
      navigation.navigate('LivePreview');
    }
  }, [isConnected, navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>StreamDeck Mobile</Text>
        <Text style={styles.subtitle}>
          Connect to your OpenDeck desktop app to control your Stream Deck
        </Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Plugin Server Address</Text>
        <TextInput
          style={styles.input}
          value={host}
          onChangeText={setHost}
          placeholder="e.g. 192.168.1.100"
          placeholderTextColor="#666"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          editable={!isConnected}
        />

        <Text style={styles.label}>Port</Text>
        <TextInput
          style={styles.input}
          value={port}
          onChangeText={setPort}
          placeholder="58123"
          placeholderTextColor="#666"
          keyboardType="number-pad"
          editable={!isConnected}
        />

        {isConnected ? (
          <TouchableOpacity style={styles.disconnectButton} onPress={handleDisconnect}>
            <Text style={styles.buttonText}>Disconnect</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.connectButton, connecting && styles.buttonDisabled]}
            onPress={handleConnect}
            disabled={connecting}
          >
            {connecting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Connect</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {status && (
        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>Device Status</Text>
          <Text style={styles.statusText}>
            Plugin: {status.status === 'connected' ? '✅ Connected' : '❌ Disconnected'}
          </Text>
          <Text style={styles.statusText}>
            OpenDeck: {status.opendeckVersion || 'Unknown'}
          </Text>
          <Text style={styles.statusText}>
            Devices: {status.devices?.length || 0} connected
          </Text>
          {status.devices?.map((device: { id: string; name: string; size: { columns: number; rows: number } }) => (
            <View key={device.id} style={styles.deviceRow}>
              <Text style={styles.deviceText}>
                🎛️ {device.name} ({device.size.columns}x{device.size.rows})
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.helpCard}>
        <Text style={styles.helpTitle}>Setup Instructions</Text>
        <Text style={styles.helpText}>
          1. Install OpenDeck on your desktop{'\n'}
          2. Copy the plugin folder to OpenDeck's plugins directory{'\n'}
          3. Restart OpenDeck{'\n'}
          4. Enter your desktop's IP address above{'\n'}
          5. Tap Connect
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#e0e0e0',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#a0a0b0',
    textAlign: 'center',
    lineHeight: 20,
  },
  form: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    color: '#a0a0b0',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#16213e',
    borderWidth: 1,
    borderColor: '#0f3460',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#e0e0e0',
  },
  connectButton: {
    backgroundColor: '#533483',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  disconnectButton: {
    backgroundColor: '#e94560',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  virtualButton: {
    backgroundColor: '#0f3460',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#533483',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statusCard: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e0e0e0',
    marginBottom: 10,
  },
  statusText: {
    fontSize: 13,
    color: '#c0c0c0',
    marginBottom: 4,
  },
  deviceRow: {
    marginTop: 6,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#533483',
  },
  deviceText: {
    fontSize: 13,
    color: '#e0e0e0',
  },
  helpCard: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#533483',
    marginBottom: 10,
  },
  helpText: {
    fontSize: 13,
    color: '#a0a0b0',
    lineHeight: 22,
  },
});
