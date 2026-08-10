/**
 * Shared protocol types — React Native app ↔ OpenDeck plugin.
 * All communication uses these JSON structures over WebSocket + REST.
 */

// ─── Device ───────────────────────────────────────────────────────────────────

export interface DeviceInfo {
  id: string;
  name: string;
  size: { columns: number; rows: number };
}

// ─── Button State (visual appearance for one state) ───────────────────────────

export interface ButtonState {
  imageBase64: string | null;
  title: string;
  titleColor: string;
  fontSize: number;
  fontStyle: 'Regular' | 'Bold' | 'Italic' | 'Bold Italic';
  showTitle: boolean;
  titleAlignment: 'top' | 'middle' | 'bottom';
}

// ─── Deck Button (one action instance on the Stream Deck grid) ────────────────

export interface DeckButton {
  context: string;
  actionUuid: string;
  actionName: string;
  column: number;
  row: number;
  stateIndex: number;
  states: ButtonState[];
  settings: Record<string, unknown>;
  groupId: string | null;
  groupSize: '1x1' | '2x1' | '1x2' | '2x2';
  groupOffset: { col: number; row: number };
}

export interface ButtonPosition {
  column: number;
  row: number;
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export interface DeckLayout {
  deviceId: string;
  dimensions: { columns: number; rows: number };
  buttons: DeckButton[];
  profileName: string;
}

// ─── Action Catalog ───────────────────────────────────────────────────────────

export interface ActionInfo {
  uuid: string;
  name: string;
  tooltip: string;
  icon: string;
  stateCount: number;
  controllers: string[];
  settingsSchema?: ActionSetting[];
  supportsMultiButton: boolean;
}

export interface ActionSetting {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'color';
  default: unknown;
  options?: { label: string; value: string }[];
}

// ─── REST ─────────────────────────────────────────────────────────────────────

export interface PluginStatus {
  status: 'connected' | 'disconnected' | 'no_device';
  pluginVersion: string;
  opendeckVersion: string;
  devices: DeviceInfo[];
  activeDeviceId: string | null;
  serverIPs: string[];
  serverPort: number;
}

// ─── WebSocket: Plugin → Mobile ───────────────────────────────────────────────

export type PluginToMobileEvent =
  | { type: 'connected'; status: PluginStatus }
  | { type: 'layoutUpdate'; layout: DeckLayout }
  | { type: 'buttonAppeared'; button: DeckButton }
  | { type: 'buttonDisappeared'; context: string }
  | { type: 'keyDown'; context: string; column: number; row: number }
  | { type: 'keyUp'; context: string; column: number; row: number }
  | { type: 'buttonStateChanged'; context: string; stateIndex: number; state: ButtonState }
  | { type: 'deviceConnected'; device: DeviceInfo }
  | { type: 'deviceDisconnected'; deviceId: string };

// ─── WebSocket: Mobile → Plugin ───────────────────────────────────────────────

export type MobileToPluginEvent =
  | { type: 'requestLayout' }
  | { type: 'setButtonState'; context: string; stateIndex: number; state: Partial<ButtonState> }
  | { type: 'setButtonSettings'; context: string; settings: Record<string, unknown> }
  | { type: 'toggleButtonState'; context: string }
  | { type: 'setGroupState'; groupId: string; stateIndex: number; state: Partial<ButtonState> };

// ─── Constants ────────────────────────────────────────────────────────────────

export const PLUGIN_SERVER_PORT = 58123;
export const PLUGIN_UUID = 'com.streamdeckapp.mobile';

export const ACTION_UUIDS = {
  CUSTOM_BUTTON: `${PLUGIN_UUID}.custombutton`,
  URL_OPENER: `${PLUGIN_UUID}.urlopener`,
  HOTKEY: `${PLUGIN_UUID}.hotkey`,
  TEXT_INPUT: `${PLUGIN_UUID}.textinput`,
  MULTI_BUTTON: `${PLUGIN_UUID}.multibutton`,
} as const;
