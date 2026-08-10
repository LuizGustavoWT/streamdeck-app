import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { useBridge } from '../hooks/useBridge';
import type { ActionInfo } from '../services/OpenDeckBridge';
import { ActionCard } from '../components/ActionCard';

type Props = NativeStackScreenProps<RootStackParamList, 'ActionPicker'>;

export function ActionPickerScreen({ navigation, route }: Props) {
  const { column, row } = route.params;
  const { actions } = useBridge();
  const [loading, setLoading] = useState(!actions.length);

  const handleSelect = (action: ActionInfo) => {
    navigation.navigate('ButtonEditor', { column, row });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.position}>
        Position: Column {column + 1}, Row {row + 1}
      </Text>

      {loading && actions.length === 0 ? (
        <ActivityIndicator color="#533483" style={styles.loader} />
      ) : (
        <FlatList
          data={actions}
          keyExtractor={(item) => item.uuid}
          renderItem={({ item }) => (
            <ActionCard action={item} onPress={() => handleSelect(item)} />
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>No actions available. Check plugin connection.</Text>
          }
        />
      )}

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  position: {
    color: '#a0a0b0',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  loader: {
    marginTop: 40,
  },
  list: {
    paddingBottom: 16,
  },
  empty: {
    color: '#a0a0b0',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
  backButton: {
    backgroundColor: '#16213e',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  backText: {
    color: '#e0e0e0',
    fontSize: 15,
    fontWeight: '600',
  },
});
