/**
 * OpenDeckBridge — Communication service between the React Native app
 * and the OpenDeck plugin running on the desktop.
 *
 * Discovery: The app attempts to connect to the plugin's HTTP server.
 * Communication: REST API for CRUD operations + WebSocket for real-time events.
 */

// Re-export shared types for convenience
export type {
  ButtonConfig,
  ButtonPosition,
  ButtonState,
  DeviceInfo,
  StreamDeckLayout,
  ActionInfo,
  ActionSetting,
  PluginStatus,
  PluginToMobileEvent,
  MobileToPluginEvent,
} from '../../shared/protocol';

import type {
  PluginStatus,
  StreamDeckLayout,
  GetActionsResponse,
  PushLayoutResponse,
  PluginToMobileEvent,
} from '../../shared/protocol';

const PLUGIN_DEFAULT_PORT = 58123;

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';
type EventCallback = (event: PluginToMobileEvent) => void;

/** Host:port string (e.g., "192.168.1.5:58123") */
let serverHost = '';
let ws: WebSocket | null = null;
let connectionState: ConnectionState = 'disconnected';
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<EventCallback>();
const stateListeners = new Set<(state: ConnectionState) => void>();

// ─── Connection Management ──────────────────────────────────────────────────

/** Get the base URL for REST API calls */
function baseUrl(): string {
  return `http://${serverHost}`;
}

/** Get the WebSocket URL */
function wsUrl(): string {
  return `ws://${serverHost}/ws`;
}

function setConnectionState(state: ConnectionState) {
  connectionState = state;
  stateListeners.forEach(fn => fn(state));
}

/**
 * Connect to the OpenDeck plugin server.
 * @param host - IP address or hostname of the desktop running OpenDeck
 * @param port - Plugin HTTP/WS server port (default 58123)
 */
export function connect(host: string, port: number = PLUGIN_DEFAULT_PORT): void {
  if (connectionState === 'connecting' || connectionState === 'connected') {
    disconnect();
  }

  serverHost = `${host}:${port}`;
  setConnectionState('connecting');

  // Verify REST API is reachable first
  fetch(`${baseUrl()}/status`)
    .then(res => res.json())
    .then((_status: PluginStatus) => {
      // REST works, now open WebSocket
      openWebSocket();
    })
    .catch(() => {
      // Try WebSocket directly (might be standalone mode)
      openWebSocket();
    });
}

/** Disconnect from the plugin server */
export function disconnect(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
  setConnectionState('disconnected');
}

function openWebSocket(): void {
  if (ws) {
    ws.close();
    ws = null;
  }

  try {
    ws = new WebSocket(wsUrl());

    ws.onopen = () => {
      setConnectionState('connected');
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg: PluginToMobileEvent = JSON.parse(event.data as string);
        listeners.forEach(fn => fn(msg));
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onerror = () => {
      setConnectionState('error');
    };

    ws.onclose = () => {
      setConnectionState('disconnected');
      // Attempt reconnect after 3 seconds
      reconnectTimer = setTimeout(() => {
        if (serverHost) {
          openWebSocket();
        }
      }, 3000);
    };
  } catch {
    setConnectionState('error');
  }
}

// ─── Event Subscriptions ────────────────────────────────────────────────────

/** Subscribe to real-time events from the plugin */
export function onEvent(callback: EventCallback): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/** Subscribe to connection state changes */
export function onConnectionStateChange(callback: (state: ConnectionState) => void): () => void {
  stateListeners.add(callback);
  return () => stateListeners.delete(callback);
}

export function getConnectionState(): ConnectionState {
  return connectionState;
}

// ─── REST API ───────────────────────────────────────────────────────────────

/** Get the current plugin and device status */
export async function getStatus(): Promise<PluginStatus> {
  const res = await fetch(`${baseUrl()}/status`);
  return res.json();
}

/** Push a layout to the Stream Deck */
export async function pushLayout(layout: StreamDeckLayout): Promise<PushLayoutResponse> {
  const res = await fetch(`${baseUrl()}/layout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(layout),
  });
  return res.json();
}

/** Get the current layout from the plugin */
export async function getLayout(): Promise<StreamDeckLayout | null> {
  const res = await fetch(`${baseUrl()}/layout`);
  const data = await res.json();
  return data.layout;
}

/** Get the catalog of available actions */
export async function getActions(): Promise<GetActionsResponse> {
  const res = await fetch(`${baseUrl()}/actions`);
  return res.json();
}

// ─── Device Discovery Helpers ────────────────────────────────────────────────

/**
 * Try to discover the plugin server on the local network.
 * Scans common IPs in the current subnet.
 * @param baseIp - The first three octets of the local IP (e.g., "192.168.1")
 * @returns Array of reachable host:port strings
 */
export async function discoverServers(baseIp: string): Promise<string[]> {
  const found: string[] = [];
  const promises: Promise<void>[] = [];

  // Scan .1 through .50 (common DHCP range)
  for (let i = 1; i <= 50; i++) {
    const host = `${baseIp}.${i}`;
    promises.push(
      fetch(`http://${host}:${PLUGIN_DEFAULT_PORT}/status`, {
        signal: AbortSignal.timeout(1500),
      })
        .then(res => res.json())
        .then((data: PluginStatus) => {
          if (data.status) {
            found.push(host);
          }
        })
        .catch(() => {
          // Host unreachable, skip
        })
    );
  }

  await Promise.allSettled(promises);
  return found;
}

// ─── WebSocket Send ──────────────────────────────────────────────────────────

/** Send an event to the plugin via WebSocket */
export function sendEvent(event: Record<string, unknown>): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(event));
  }
}
