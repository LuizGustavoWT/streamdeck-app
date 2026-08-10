import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { useBridge } from '../hooks/useBridge';
import { useLayout } from '../hooks/useLayout';
import type { ActionInfo } from '../services/OpenDeckBridge';
import { ACTION_UUIDS } from '../../../shared/protocol';

type Props = NativeStackScreenProps<RootStackParamList, 'ButtonEditor'>;

const ACTION_LIST: ActionInfo[] = [
  {
    uuid: ACTION_UUIDS.CUSTOM_BUTTON,
    name: 'Custom Button',
    tooltip: 'A customizable button with image and text',
    icon: 'custom-action-icon',
    states: 1,
    controllers: ['Keypad'],
    settingsSchema: [
      { key: 'label', label: 'Label', type: 'text', default: '' },
      { key: 'color', label: 'Color', type: 'color', default: '#FFFFFF' },
    ],
  },
  {
    uuid: ACTION_UUIDS.URL_OPENER,
    name: 'URL Opener',
    tooltip: 'Opens a website or application URL',
    icon: 'url-action-icon',
    states: 1,
    controllers: ['Keypad'],
    settingsSchema: [
      { key: 'url', label: 'URL', type: 'text', default: 'https://' },
    ],
  },
  {
    uuid: ACTION_UUIDS.HOTKEY,
    name: 'Hotkey',
    tooltip: 'Sends a keyboard shortcut',
    icon: 'hotkey-action-icon',
    states: 1,
    controllers: ['Keypad'],
    settingsSchema: [
      { key: 'modifiers', label: 'Modifiers (Ctrl,Alt,Shift,Win)', type: 'text', default: '' },
      { key: 'key', label: 'Key', type: 'text', default: '' },
    ],
  },
  {
    uuid: ACTION_UUIDS.TEXT_INPUT,
    name: 'Text Sender',
    tooltip: 'Types a text string',
    icon: 'text-action-icon',
    states: 1,
    controllers: ['Keypad'],
    settingsSchema: [
      { key: 'text', label: 'Text to type', type: 'text', default: '' },
    ],
  },
];

export function ButtonEditorScreen({ navigation, route }: Props) {
  const { column, row } = route.params;
  const { findButton, addOrUpdateButton, removeButton } = useLayout(5, 3);

  const existing = findButton(column, row);
  const [selectedAction, setSelectedAction] = useState<string>(
    existing?.actionUuid ?? ACTION_UUIDS.CUSTOM_BUTTON
  );
  const [title, setTitle] = useState(existing?.state?.title ?? '');
  const [titleColor, setTitleColor] = useState(existing?.state?.titleColor ?? '#FFFFFF');
  const [fontSize, setFontSize] = useState(String(existing?.state?.fontSize ?? 14));
  const [fontStyle, setFontStyle] = useState<'Regular' | 'Bold'>(
    existing?.state?.fontStyle as 'Regular' | 'Bold' ?? 'Regular'
  );

  const handleSave = useCallback(() => {
    const currentAction = ACTION_LIST.find(a => a.uuid === selectedAction);
    const settings: Record<string, unknown> = {};
    if (currentAction?.settingsSchema) {
      // Settings would be collected from the PI, use defaults here
      currentAction.settingsSchema.forEach(s => {
        settings[s.key] = s.default;
      });
    }

    addOrUpdateButton(column, row, selectedAction, settings, {
      title,
      titleColor,
      fontSize: parseInt(fontSize, 10) || 14,
      fontStyle,
      showTitle: true,
      titleAlignment: 'middle',
    });

    navigation.goBack();
  }, [column, row, selectedAction, title, titleColor, fontSize, fontStyle, addOrUpdateButton, navigation]);

  const handleRemove = useCallback(() => {
    Alert.alert('Remove Button', 'Remove this button from the layout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          removeButton(column, row);
          navigation.goBack();
        },
      },
    ]);
  }, [column, row, removeButton, navigation]);

  const currentAction = ACTION_LIST.find(a => a.uuid === selectedAction);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.position}>
        Editing position ({column + 1}, {row + 1})
      </Text>

      {/* Action selector */}
      <Text style={styles.label}>Action Type</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.actionScroll}>
        {ACTION_LIST.map((action) => (
          <TouchableOpacity
            key={action.uuid}
            style={[
              styles.actionChip,
              selectedAction === action.uuid && styles.actionChipActive,
            ]}
            onPress={() => setSelectedAction(action.uuid)}
          >
            <Text
              style={[
                styles.actionChipText,
                selectedAction === action.uuid && styles.actionChipTextActive,
              ]}
            >
              {action.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {currentAction && (
        <Text style={styles.tooltip}>{currentAction.tooltip}</Text>
      )}

      {/* Button appearance */}
      <Text style={styles.sectionTitle}>Appearance</Text>

      <Text style={styles.label}>Button Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Enter button text"
        placeholderTextColor="#666"
      />

      <Text style={styles.label}>Title Color</Text>
      <View style={styles.colorRow}>
        <TextInput
          style={[styles.input, styles.colorInput]}
          value={titleColor}
          onChangeText={setTitleColor}
          placeholder="#FFFFFF"
          placeholderTextColor="#666"
          autoCapitalize="none"
        />
        <View style={[styles.colorPreview, { backgroundColor: titleColor }]} />
      </View>

      <Text style={styles.label}>Font Size</Text>
      <TextInput
        style={styles.input}
        value={fontSize}
        onChangeText={setFontSize}
        placeholder="14"
        placeholderTextColor="#666"
        keyboardType="number-pad"
      />

      <Text style={styles.label}>Font Style</Text>
      <View style={styles.fontRow}>
        <TouchableOpacity
          style={[styles.fontChip, fontStyle === 'Regular' && styles.fontChipActive]}
          onPress={() => setFontStyle('Regular')}
        >
          <Text style={[styles.fontText, fontStyle === 'Regular' && styles.fontTextActive]}>
            Regular
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.fontChip, fontStyle === 'Bold' && styles.fontChipActive]}
          onPress={() => setFontStyle('Bold')}
        >
          <Text style={[styles.fontText, fontStyle === 'Bold' && styles.fontTextActive]}>
            Bold
          </Text>
        </TouchableOpacity>
      </View>

      {/* Action buttons */}
      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveText}>Save Button</Text>
      </TouchableOpacity>

      {existing && (
        <TouchableOpacity style={styles.removeButton} onPress={handleRemove}>
          <Text style={styles.removeText}>Remove Button</Text>
        </TouchableOpacity>
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
  position: {
    color: '#a0a0b0',
    fontSize: 13,
    textAlign: 'center',
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
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  colorInput: {
    flex: 1,
  },
  colorPreview: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e0e0e0',
    marginTop: 24,
    marginBottom: 4,
  },
  actionScroll: {
    marginBottom: 8,
  },
  actionChip: {
    backgroundColor: '#16213e',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  actionChipActive: {
    borderColor: '#533483',
    backgroundColor: '#1e1645',
  },
  actionChipText: {
    color: '#a0a0b0',
    fontSize: 13,
    fontWeight: '500',
  },
  actionChipTextActive: {
    color: '#e0e0e0',
  },
  tooltip: {
    color: '#a0a0b0',
    fontSize: 12,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  fontRow: {
    flexDirection: 'row',
    gap: 10,
  },
  fontChip: {
    backgroundColor: '#16213e',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  fontChipActive: {
    borderColor: '#533483',
    backgroundColor: '#1e1645',
  },
  fontText: {
    color: '#a0a0b0',
    fontSize: 14,
  },
  fontTextActive: {
    color: '#e0e0e0',
  },
  saveButton: {
    backgroundColor: '#533483',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  saveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  removeButton: {
    backgroundColor: 'transparent',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e94560',
  },
  removeText: {
    color: '#e94560',
    fontSize: 14,
    fontWeight: '500',
  },
});
