import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { setButtonState, toggleButtonState, onEvent, getConnectionState } from '../services/OpenDeckBridge';
import type { DeckButton, PluginToMobileEvent } from '../../shared/protocol';

type Props = NativeStackScreenProps<RootStackParamList, 'ButtonEditor'>;

export function ButtonEditorScreen({ navigation, route }: Props) {
  const { column, row, context } = route.params;
  const [button, setButton] = useState<DeckButton | null>(null);
  const [activeState, setActiveState] = useState(0);
  const [title, setTitle] = useState('');
  const [color, setColor] = useState('#FFFFFF');

  useEffect(() => {
    const unsub = onEvent((ev: PluginToMobileEvent) => {
      if (ev.type === 'layoutUpdate') {
        const btn = ev.layout.buttons.find(b => b.context === context);
        if (btn) { setButton(btn); setActiveState(btn.stateIndex); setTitle(btn.states[btn.stateIndex]?.title ?? ''); setColor(btn.states[btn.stateIndex]?.titleColor ?? '#FFFFFF'); }
      }
      if (ev.type === 'buttonStateChanged' && ev.context === context) {
        setActiveState(ev.stateIndex);
        setTitle(ev.state.title ?? '');
        setColor(ev.state.titleColor ?? '#FFFFFF');
      }
      if (ev.type === 'buttonDisappeared' && ev.context === context) {
        navigation.goBack();
      }
    });
    return unsub;
  }, [context, navigation]);

  const handleSave = useCallback(() => {
    setButtonState(context, activeState, { title, titleColor: color, showTitle: true });
    navigation.goBack();
  }, [context, activeState, title, color, navigation]);

  const handleToggle = useCallback(() => {
    toggleButtonState(context);
  }, [context]);

  if (!button) {
    return (
      <View style={styles.loading}><Text style={styles.loadingText}>Loading button...</Text></View>
    );
  }

  return (
    <ScrollView style={styles.cont} contentContainerStyle={styles.inner}>
      <Text style={styles.pos}>Position ({column + 1}, {row + 1}) — {button.actionName}</Text>

      {/* State tabs */}
      {button.states.length > 1 && (
        <View style={styles.tabs}>
          {button.states.map((_, i) => (
            <TouchableOpacity key={i} style={[styles.tab, activeState === i && styles.tabA]}
              onPress={() => { setActiveState(i); setTitle(button.states[i]?.title ?? ''); setColor(button.states[i]?.titleColor ?? '#FFFFFF'); }}>
              <Text style={[styles.tabT, activeState === i && styles.tabTA]}>State {i + 1}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={styles.label}>Title</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Button text" placeholderTextColor="#666" />

      <Text style={styles.label}>Color</Text>
      <View style={styles.colorRow}>
        <TextInput style={[styles.input, { flex: 1 }]} value={color} onChangeText={setColor} placeholder="#FFFFFF" placeholderTextColor="#666" autoCapitalize="none" />
        <View style={[styles.preview, { backgroundColor: color }]} />
      </View>

      {/* Preview */}
      <View style={styles.previewBox}>
        <Text style={[styles.previewText, { color, fontSize: button.states[activeState]?.fontSize ?? 14 }]}>
          {title || 'Preview'}
        </Text>
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
        <Text style={styles.saveT}>Save State {activeState + 1}</Text>
      </TouchableOpacity>

      {button.states.length > 1 && (
        <TouchableOpacity style={styles.toggleBtn} onPress={handleToggle}>
          <Text style={styles.toggleT}>Toggle State (test on device)</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cont: { flex: 1 }, inner: { padding: 16, paddingBottom: 40 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#a0a0b0', fontSize: 14 },
  pos: { color: '#a0a0b0', fontSize: 13, textAlign: 'center', marginBottom: 16 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tab: { flex: 1, backgroundColor: '#16213e', borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#0f3460' },
  tabA: { borderColor: '#533483', backgroundColor: '#1e1645' },
  tabT: { color: '#a0a0b0', fontSize: 14, fontWeight: '500' },
  tabTA: { color: '#e0e0e0' },
  label: { fontSize: 12, color: '#a0a0b0', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#16213e', borderWidth: 1, borderColor: '#0f3460', borderRadius: 8, padding: 12, fontSize: 16, color: '#e0e0e0' },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  preview: { width: 44, height: 44, borderRadius: 8, borderWidth: 1, borderColor: '#0f3460' },
  previewBox: { marginTop: 20, backgroundColor: '#16213e', borderRadius: 12, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#0f3460' },
  previewText: { fontWeight: '700' },
  saveBtn: { backgroundColor: '#533483', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 24 },
  saveT: { color: '#fff', fontSize: 16, fontWeight: '600' },
  toggleBtn: { backgroundColor: '#16213e', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 12, borderWidth: 1, borderColor: '#0f3460' },
  toggleT: { color: '#e0e0e0', fontSize: 14, fontWeight: '500' },
});
