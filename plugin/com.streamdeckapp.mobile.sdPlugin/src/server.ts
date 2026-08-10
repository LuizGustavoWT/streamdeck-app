/**
 * HTTP + WebSocket server that the React Native app connects to.
 *
 * REST API:
 *   GET  /status   → PluginStatus
 *   GET  /layout   → GetLayoutResponse
 *   POST /layout   → PushLayoutResponse (pushes layout to Stream Deck)
 *   GET  /actions  → GetActionsResponse
 *
 * WebSocket (same port):
 *   ws://host:PORT/ws → bidirectional real-time events
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { WebSocketServer, type WebSocket as WsClient } from 'ws';
import { EventEmitter } from 'node:events';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DeviceInfo {
  id: string;
  name: string;
  size: { columns: number; rows: number };
}

export interface StreamDeckLayout {
  deviceId: string;
  dimensions: { columns: number; rows: number };
  buttons: ButtonConfig[];
  name: string;
}

export interface ButtonConfig {
  id: string;
  position: { column: number; row: number };
  actionUuid: string;
  settings: Record<string, unknown>;
  state: ButtonState;
  enabled: boolean;
}

export interface ButtonState {
  imageBase64: string | null;
  title: string;
  titleColor: string;
  fontSize: number;
  fontStyle: string;
  showTitle: boolean;
  titleAlignment: string;
}

export interface PluginStatus {
  status: 'connected' | 'disconnected' | 'no_device';
  pluginVersion: string;
  opendeckVersion: string;
  devices: DeviceInfo[];
  activeDeviceId: string | null;
}

export interface ActionInfo {
  uuid: string;
  name: string;
  tooltip: string;
  icon: string;
  states: number;
  controllers: string[];
  settingsSchema?: ActionSetting[];
}

export interface ActionSetting {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'color';
  default: unknown;
  options?: { label: string; value: string }[];
}

export interface PushLayoutResponse {
  success: boolean;
  message: string;
}

export interface MobileBridge {
  pushLayout(layout: StreamDeckLayout): PushLayoutResponse;
  updateButton(buttonId: string, config: Partial<ButtonConfig>): void;
  removeButton(buttonId: string): void;
  getStatus(): PluginStatus;
  getActionCatalog(): { actions: ActionInfo[] };
}

interface ServerConfig {
  opendeckWs: unknown | null;
  pluginUUID: string;
  devices: DeviceInfo[];
  bridge?: MobileBridge;
}

// ─── Server ───────────────────────────────────────────────────────────────────

export function startMobileServer(config: ServerConfig) {
  const PORT = 58123;
  const emitter = new EventEmitter();

  // Default no-op bridge for standalone mode
  const bridge: MobileBridge = config.bridge ?? {
    pushLayout: () => ({ success: false, message: 'Standalone mode - no OpenDeck connection' }),
    updateButton: () => {},
    removeButton: () => {},
    getStatus: () => ({
      status: 'disconnected',
      pluginVersion: '1.0.0',
      opendeckVersion: 'standalone',
      devices: config.devices,
      activeDeviceId: null,
    }),
    getActionCatalog: () => ({
      actions: [],
    }),
  };

  // ─── HTTP Server ─────────────────────────────────────────────────────────

  const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    // CORS headers for mobile app
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

    try {
      switch (url.pathname) {
        case '/status': {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(bridge.getStatus()));
          break;
        }

        case '/layout': {
          if (req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ layout: null }));
          } else if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
            req.on('end', () => {
              try {
                const layout = JSON.parse(body) as StreamDeckLayout;
                const result = bridge.pushLayout(layout);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
                emitter.emit('toMobile', { type: 'layoutChanged', layout });
              } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  success: false,
                  message: err instanceof Error ? err.message : 'Invalid JSON',
                }));
              }
            });
          }
          break;
        }

        case '/actions': {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(bridge.getActionCatalog()));
          break;
        }

        default: {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not found' }));
        }
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: err instanceof Error ? err.message : 'Internal error',
      }));
    }
  });

  // ─── WebSocket Server ───────────────────────────────────────────────────

  const wss = new WebSocketServer({ server: httpServer });

  /** Connected mobile clients */
  const mobileClients = new Set<WsClient>();

  wss.on('connection', (ws: WsClient, req: IncomingMessage) => {
    if (req.url !== '/ws') {
      ws.close(4000, 'Use /ws endpoint for WebSocket');
      return;
    }

    console.log('[StreamDeckMobile] Mobile client connected');
    mobileClients.add(ws);

    // Send initial status
    ws.send(JSON.stringify({
      type: 'connected',
      status: bridge.getStatus(),
    }));

    ws.on('message', (raw: Buffer) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw.toString()) as Record<string, unknown>;
      } catch {
        return;
      }

      switch (msg.type) {
        case 'pushLayout':
          bridge.pushLayout(msg.layout as StreamDeckLayout);
          break;

        case 'updateButton':
          bridge.updateButton(msg.buttonId as string, msg.config as Partial<ButtonConfig>);
          break;

        case 'removeButton':
          bridge.removeButton(msg.buttonId as string);
          break;

        case 'addButton':
          bridge.pushLayout({
            deviceId: bridge.getStatus().activeDeviceId ?? '',
            dimensions: { columns: 5, rows: 3 },
            buttons: [msg.button as ButtonConfig],
            name: 'Mobile Layout',
          });
          break;

        case 'requestLayout':
          ws.send(JSON.stringify({ type: 'layoutChanged', layout: null }));
          break;

        default:
          break;
      }
    });

    ws.on('close', () => {
      console.log('[StreamDeckMobile] Mobile client disconnected');
      mobileClients.delete(ws);
    });

    ws.on('error', (err: Error) => {
      console.error('[StreamDeckMobile] Mobile WS error:', err.message);
      mobileClients.delete(ws);
    });
  });

  // ─── Forward events from OpenDeck → Mobile clients ──────────────────────

  emitter.on('toMobile', (event: unknown) => {
    const data = JSON.stringify(event);
    for (const client of mobileClients) {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(data);
      }
    }
  });

  // ─── Start listening ─────────────────────────────────────────────────────

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[StreamDeckMobile] HTTP+WS server listening on port ${PORT}`);
    console.log(`[StreamDeckMobile] Mobile app can connect at http://<host-ip>:${PORT}`);
  });

  return { emitter, httpServer, wss };
}
