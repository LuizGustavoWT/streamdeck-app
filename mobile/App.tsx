import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ConnectionScreen } from './src/screens/ConnectionScreen';
import { LayoutDesignerScreen } from './src/screens/LayoutDesignerScreen';
import { ActionPickerScreen } from './src/screens/ActionPickerScreen';
import { ButtonEditorScreen } from './src/screens/ButtonEditorScreen';
import { LivePreviewScreen } from './src/screens/LivePreviewScreen';

export type RootStackParamList = {
  Connection: undefined;
  LayoutDesigner: undefined;
  ActionPicker: { column: number; row: number };
  ButtonEditor: { column: number; row: number };
  LivePreview: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const DarkTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: '#533483',
    background: '#1a1a2e',
    card: '#16213e',
    text: '#e0e0e0',
    border: '#0f3460',
    notification: '#e94560',
  },
};

export default function App() {
  return (
    <NavigationContainer theme={DarkTheme}>
      <StatusBar style="light" />
      <Stack.Navigator
        initialRouteName="Connection"
        screenOptions={{
          headerStyle: { backgroundColor: '#16213e' },
          headerTintColor: '#e0e0e0',
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: '#1a1a2e' },
        }}
      >
        <Stack.Screen
          name="Connection"
          component={ConnectionScreen}
          options={{ title: 'Connect to OpenDeck' }}
        />
        <Stack.Screen
          name="LayoutDesigner"
          component={LayoutDesignerScreen}
          options={{ title: 'Layout Designer' }}
        />
        <Stack.Screen
          name="ActionPicker"
          component={ActionPickerScreen}
          options={{ title: 'Choose Action' }}
        />
        <Stack.Screen
          name="ButtonEditor"
          component={ButtonEditorScreen}
          options={{ title: 'Edit Button' }}
        />
        <Stack.Screen
          name="LivePreview"
          component={LivePreviewScreen}
          options={{ title: 'Live Preview' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
