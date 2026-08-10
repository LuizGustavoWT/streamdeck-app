/**
 * HTTP + WebSocket server for the React Native app.
 *
 * REST: GET /status, GET /layout, GET /actions, GET /ping
 * WebSocket: ws://host:PORT/ws — bidirectional real-time events
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { WebSocketServer, type WebSocket as WsClient } from 'ws';
import { EventEmitter } from 'node:events';
import { networkInterfaces } from 'node:os';

// ─── Re-export types used by index.ts ─────────────────────────────────────────

export interface ButtonState {
  imageBase64: string | null;
  title: string;
  titleColor: string;
  fontSize: number;
  fontStyle: string;
  showTitle: boolean;
  titleAlignment: string;
}

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

export interface DeckLayout {
  deviceId: string;
  dimensions: { columns: number; rows: number };
  buttons: DeckButton[];
  profileName: string;
}

export interface MobileBridge {
  getStatus(): {
    status: 'connected' | 'disconnected';
    pluginVersion: string;
    opendeckVersion: string;
    devices: { id: string; name: string; size: { columns: number; rows: number } }[];
    activeDeviceId: string | null;
  };
  getActionCatalog(): {
    actions: {
      uuid: string; name: string; tooltip: string; icon: string;
      stateCount: number; controllers: string[]; supportsMultiButton: boolean;
      settingsSchema?: { key: string; label: string; type: string; default: unknown; options?: { label: string; value: string }[] }[];
    }[];
  };
  getLayout(): DeckLayout;
  setButtonState(context: string, stateIndex: number, state: Partial<ButtonState>): void;
  toggleButtonState(context: string): void;
  setGroupState(groupId: string, stateIndex: number, state: Partial<ButtonState>): void;
  setButtonSettings(context: string, settings: Record<string, unknown>): void;
}

interface ServerConfig {
  pluginUUID: string;
  devices: { id: string; name: string; size: { columns: number; rows: number } }[];
  bridge?: MobileBridge;
}

// ─── Default no-op bridge ────────────────────────────────────────────────────

function noopBridge(): MobileBridge {
  return {
    getStatus: () => ({ status: 'disconnected', pluginVersion: '1.0.0', opendeckVersion: 'standalone', devices: [], activeDeviceId: null }),
    getActionCatalog: () => ({ actions: [] }),
    getLayout: () => ({ deviceId: '', dimensions: { columns: 5, rows: 3 }, buttons: [], profileName: '' }),
    setButtonState: () => {},
    toggleButtonState: () => {},
    setGroupState: () => {},
    setButtonSettings: () => {},
  };
}

// ─── Server ───────────────────────────────────────────────────────────────────

export function startMobileServer(config: ServerConfig) {
  const PORT = 58123;
  const emitter = new EventEmitter();
  const bridge = config.bridge ?? noopBridge();

  const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

    try {
      switch (url.pathname) {
        case '/ping':
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ pong: true, timestamp: Date.now() }));
          break;

        case '/status': {
          const status = bridge.getStatus();
          const ips = getLocalIPs();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ...status, serverIPs: ips, serverPort: PORT }));
          break;
        }

        case '/layout':
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ layout: bridge.getLayout() }));
          break;

        case '/actions':
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(bridge.getActionCatalog()));
          break;

        default:
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not found' }));
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }));
    }
  });

  // ─── WebSocket ────────────────────────────────────────────────────────────

  const wss = new WebSocketServer({ server: httpServer });
  const mobileClients = new Set<WsClient>();

  wss.on('connection', (ws: WsClient, req: IncomingMessage) => {
    if (req.url !== '/ws') { ws.close(4000, 'Use /ws endpoint'); return; }

    console.log('[StreamDeckMobile] Mobile client connected');
    mobileClients.add(ws);

    ws.send(JSON.stringify({
      type: 'connected',
      status: { ...bridge.getStatus(), serverIPs: getLocalIPs(), serverPort: PORT },
    }));

    // Send current layout immediately
    ws.send(JSON.stringify({ type: 'layoutUpdate', layout: bridge.getLayout() }));

    ws.on('message', (raw: Buffer) => {
      let msg: Record<string, unknown>;
      try { msg = JSON.parse(raw.toString()) as Record<string, unknown>; } catch { return; }

      switch (msg.type) {
        case 'requestLayout':
          ws.send(JSON.stringify({ type: 'layoutUpdate', layout: bridge.getLayout() }));
          break;
        case 'setButtonState':
          bridge.setButtonState(msg.context as string, msg.stateIndex as number, msg.state as Partial<ButtonState>);
          break;
        case 'setButtonSettings':
          bridge.setButtonSettings(msg.context as string, msg.settings as Record<string, unknown>);
          break;
        case 'toggleButtonState':
          bridge.toggleButtonState(msg.context as string);
          break;
        case 'setGroupState':
          bridge.setGroupState(msg.groupId as string, msg.stateIndex as number, msg.state as Partial<ButtonState>);
          break;
      }
    });

    ws.on('close', () => { mobileClients.delete(ws); console.log('[StreamDeckMobile] Mobile client disconnected'); });
    ws.on('error', (err: Error) => { mobileClients.delete(ws); console.error('[StreamDeckMobile] Mobile WS error:', err.message); });
  });

  // ─── Forward events to mobile ─────────────────────────────────────────────

  emitter.on('toMobile', (event: unknown) => {
    const data = JSON.stringify(event);
    for (const client of mobileClients) {
      if (client.readyState === 1) client.send(data);
    }
  });

  // ─── Start listening ───────────────────────────────────────────────────────

  httpServer.listen(PORT, '0.0.0.0', () => {
    const ips = getLocalIPs();
    console.log(`[StreamDeckMobile] Server listening on port ${PORT}`);
    ips.forEach(ip => console.log(`[StreamDeckMobile]   http://${ip}:${PORT}`));
  });

  return { emitter, httpServer, wss };
}

function getLocalIPs(): string[] {
  const ips: string[] = [];
  const interfaces = networkInterfaces();
  for (const [, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) ips.push(addr.address);
    }
  }
  return ips;
}
