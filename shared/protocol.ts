/**
 * Shared protocol types between the React Native app and the OpenDeck plugin.
 * These define the JSON structure for all REST API and WebSocket messages.
 */

// ─── Device Info ──────────────────────────────────────────────────────────────

/** Information about a connected Stream Deck device */
export interface DeviceInfo {
  id: string;
  name: string;
  size: {
    columns: number;
    rows: number;
  };
}

// ─── Button / Action ──────────────────────────────────────────────────────────

/** Position of a button on the Stream Deck grid */
export interface ButtonPosition {
  column: number; // 0-based
  row: number; // 0-based
}

/** Configuration for a single button on the Stream Deck */
export interface ButtonConfig {
  /** Unique identifier for this button instance */
  id: string;
  /** Grid position */
  position: ButtonPosition;
  /** The action UUID (e.g., "com.streamdeckapp.mobile.customaction") */
  actionUuid: string;
  /** Settings passed to the action */
  settings: Record<string, unknown>;
  /** Display state */
  state: ButtonState;
  /** Whether the button is enabled */
  enabled: boolean;
}

/** Visual state of a button */
export interface ButtonState {
  /** Base64-encoded PNG image, or empty for no custom image */
  imageBase64: string | null;
  /** Text displayed on the button */
  title: string;
  /** Title color (hex) */
  titleColor: string;
  /** Font size in pixels */
  fontSize: number;
  /** Font style */
  fontStyle: 'Regular' | 'Bold' | 'Italic' | 'Bold Italic';
  /** Whether to show the title */
  showTitle: boolean;
  /** Title vertical alignment */
  titleAlignment: 'top' | 'middle' | 'bottom';
}

// ─── Layout ───────────────────────────────────────────────────────────────────

/** The full layout of a Stream Deck profile */
export interface StreamDeckLayout {
  /** ID of the device this layout is for */
  deviceId: string;
  /** Device dimensions */
  dimensions: {
    columns: number;
    rows: number;
  };
  /** All configured buttons */
  buttons: ButtonConfig[];
  /** Layout name (profile name) */
  name: string;
}

// ─── Action Catalog ───────────────────────────────────────────────────────────

/** Description of an available action that can be placed on a button */
export interface ActionInfo {
  /** Unique UUID in reverse-DNS format */
  uuid: string;
  /** Display name */
  name: string;
  /** Short description */
  tooltip: string;
  /** Icon reference (relative path in plugin) */
  icon: string;
  /** Number of states (1 or 2) */
  states: number;
  /** Which controller types this action supports */
  controllers: string[];
  /** Settings schema for the property inspector */
  settingsSchema?: ActionSetting[];
}

/** A single setting field for an action */
export interface ActionSetting {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'color';
  default: unknown;
  options?: { label: string; value: string }[];
}

// ─── REST API Types ───────────────────────────────────────────────────────────

/** GET /status response */
export interface PluginStatus {
  status: 'connected' | 'disconnected' | 'no_device';
  pluginVersion: string;
  opendeckVersion: string;
  devices: DeviceInfo[];
  activeDeviceId: string | null;
}

/** POST /layout request body */
export type PushLayoutRequest = StreamDeckLayout;

/** POST /layout response */
export interface PushLayoutResponse {
  success: boolean;
  message: string;
}

/** GET /layout response */
export interface GetLayoutResponse {
  layout: StreamDeckLayout | null;
}

/** GET /actions response */
export interface GetActionsResponse {
  actions: ActionInfo[];
}

// ─── WebSocket Events ─────────────────────────────────────────────────────────

/** Events sent from plugin → mobile app */
export type PluginToMobileEvent =
  | { type: 'keyDown'; buttonId: string; position: ButtonPosition }
  | { type: 'keyUp'; buttonId: string; position: ButtonPosition }
  | { type: 'buttonStateChanged'; buttonId: string; state: ButtonState }
  | { type: 'deviceConnected'; device: DeviceInfo }
  | { type: 'deviceDisconnected'; deviceId: string }
  | { type: 'layoutChanged'; layout: StreamDeckLayout };

/** Events sent from mobile app → plugin */
export type MobileToPluginEvent =
  | { type: 'pushLayout'; layout: StreamDeckLayout }
  | { type: 'updateButton'; buttonId: string; config: Partial<ButtonConfig> }
  | { type: 'removeButton'; buttonId: string }
  | { type: 'addButton'; button: ButtonConfig }
  | { type: 'requestLayout' };

// ─── Constants ────────────────────────────────────────────────────────────────

/** Default port for the plugin's HTTP/WebSocket server */
export const PLUGIN_SERVER_PORT = 58123;

/** Plugin UUID (reverse-DNS format) */
export const PLUGIN_UUID = 'com.streamdeckapp.mobile';

/** Action UUIDs provided by this plugin */
export const ACTION_UUIDS = {
  CUSTOM_BUTTON: `${PLUGIN_UUID}.custombutton`,
  URL_OPENER: `${PLUGIN_UUID}.urlopener`,
  HOTKEY: `${PLUGIN_UUID}.hotkey`,
  TEXT_INPUT: `${PLUGIN_UUID}.textinput`,
} as const;
