import type {
  PluginStatus, DeckLayout, DeckButton, ButtonState,
  ActionInfo, PluginToMobileEvent,
} from '../../shared/protocol';

const DEFAULT_PORT = 58123;
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';
type EventCallback = (event: PluginToMobileEvent) => void;

let serverHost = '';
let ws: WebSocket | null = null;
let connectionState: ConnectionState = 'disconnected';
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<EventCallback>();
const stateListeners = new Set<(s: ConnectionState) => void>();

function baseUrl() { return `http://${serverHost}`; }
function wsUrl() { return `ws://${serverHost}/ws`; }

function setState(s: ConnectionState) { connectionState = s; stateListeners.forEach(fn => fn(s)); }

export function connect(host: string, port = DEFAULT_PORT) {
  if (connectionState === 'connecting' || connectionState === 'connected') disconnect();
  serverHost = `${host}:${port}`; setState('connecting');
  fetch(`${baseUrl()}/ping`).then(() => openWs()).catch(() => openWs());
}

export function disconnect() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (ws) { ws.close(); ws = null; } setState('disconnected');
}

function openWs() {
  if (ws) { ws.close(); ws = null; }
  try {
    ws = new WebSocket(wsUrl());
    ws.onopen = () => { setState('connected'); if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; } };
    ws.onmessage = (e) => { try { listeners.forEach(fn => fn(JSON.parse(e.data as string))); } catch { /* */ } };
    ws.onerror = () => setState('error');
    ws.onclose = () => { setState('disconnected'); reconnectTimer = setTimeout(openWs, 3000); };
  } catch { setState('error'); }
}

export function onEvent(cb: EventCallback) { listeners.add(cb); return () => { listeners.delete(cb); }; }
export function onConnectionStateChange(cb: (s: ConnectionState) => void) { stateListeners.add(cb); return () => { stateListeners.delete(cb); }; }
export function getConnectionState() { return connectionState; }

export async function getStatus(): Promise<PluginStatus> { const r = await fetch(`${baseUrl()}/status`); return r.json(); }
export async function getActions(): Promise<{ actions: ActionInfo[] }> { const r = await fetch(`${baseUrl()}/actions`); return r.json(); }

function send(e: Record<string, unknown>) { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(e)); }
export function requestLayout() { send({ type: 'requestLayout' }); }
export function setButtonState(context: string, stateIndex: number, state: Partial<ButtonState>) {
  send({ type: 'setButtonState', context, stateIndex, state });
}
export function toggleButtonState(context: string) { send({ type: 'toggleButtonState', context }); }
export function setGroupState(groupId: string, stateIndex: number, state: Partial<ButtonState>) {
  send({ type: 'setGroupState', groupId, stateIndex, state });
}
