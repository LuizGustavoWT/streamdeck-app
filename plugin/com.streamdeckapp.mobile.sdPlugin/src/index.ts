/**
 * OpenDeck Plugin Entry Point — StreamDeck Mobile Bridge
 *
 * Architecture:
 *   1. Connects to OpenDeck's WebSocket server (dynamic port from CLI args)
 *   2. Registers as a plugin with the OpenAction API
 *   3. Starts an HTTP + WebSocket server for the React Native app
 *   4. Translates mobile app commands → OpenDeck actions
 *   5. Forwards Stream Deck events → mobile app
 *
 * Launch: OpenDeck spawns this with:
 *   node dist/index.js -port PORT -pluginUUID UUID -registerEvent EVENT -info INFO_JSON
 */

import { WebSocket } from 'ws';
import { startMobileServer, type MobileBridge } from './server.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CliArgs {
  port: number;
  pluginUUID: string;
  registerEvent: string;
  info: OpenDeckInfo;
}

interface OpenDeckInfo {
  application?: {
    font?: string;
    language?: string;
    platform?: string;
    platformVersion?: string;
    version?: string;
  };
  plugin?: {
    uuid?: string;
    version?: string;
  };
  devices?: DeviceInfo[];
}

interface DeviceInfo {
  id: string;
  name: string;
  size: {
    columns: number;
    rows: number;
  };
}

interface ButtonConfig {
  id: string;
  position: { column: number; row: number };
  actionUuid: string;
  settings: Record<string, unknown>;
  state: ButtonState;
  enabled: boolean;
}

interface ButtonState {
  imageBase64: string | null;
  title: string;
  titleColor: string;
  fontSize: number;
  fontStyle: string;
  showTitle: boolean;
  titleAlignment: string;
}

interface StreamDeckLayout {
  deviceId: string;
  dimensions: { columns: number; rows: number };
  buttons: ButtonConfig[];
  name: string;
}

interface PluginToMobileEvent {
  type: string;
  [key: string]: unknown;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTION_UUIDS = {
  CUSTOM_BUTTON: 'com.streamdeckapp.mobile.custombutton',
  URL_OPENER: 'com.streamdeckapp.mobile.urlopener',
  HOTKEY: 'com.streamdeckapp.mobile.hotkey',
  TEXT_INPUT: 'com.streamdeckapp.mobile.textinput',
} as const;

// ─── CLI Arg Parsing ──────────────────────────────────────────────────────────

function parseArgs(argv: string[]): Partial<CliArgs> {
  const args: Partial<CliArgs> = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '-port' && i + 1 < argv.length) {
      args.port = parseInt(argv[++i], 10);
    } else if (argv[i] === '-pluginUUID' && i + 1 < argv.length) {
      args.pluginUUID = argv[++i];
    } else if (argv[i] === '-registerEvent' && i + 1 < argv.length) {
      args.registerEvent = argv[++i];
    } else if (argv[i] === '-info' && i + 1 < argv.length) {
      try {
        args.info = JSON.parse(argv[++i]) as OpenDeckInfo;
      } catch {
        args.info = {};
      }
    }
  }
  return args;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const cliArgs = parseArgs(process.argv);

if (!cliArgs.port || !cliArgs.pluginUUID || !cliArgs.registerEvent) {
  // Running standalone (dev mode without OpenDeck) — start mobile server only
  console.log('[StreamDeckMobile] Running in standalone mode (no OpenDeck args)');
  const { emitter } = startMobileServer({
    opendeckWs: null,
    pluginUUID: 'dev-mode',
    devices: [],
  });
} else {
  console.log(`[StreamDeckMobile] Connecting to OpenDeck on port ${cliArgs.port}...`);

  const ws = new WebSocket(`ws://localhost:${cliArgs.port}`);

  /** Map of context → buttonId (for tracking action instances) */
  const contextMap = new Map<string, string>();
  /** Map of buttonId → context */
  const buttonMap = new Map<string, string>();
  /** Current device info */
  let devices: DeviceInfo[] = cliArgs.info?.devices ?? [];
  /** Active device ID */
  let activeDeviceId: string | null = devices.length > 0 ? devices[0].id : null;
  /** Next button index for generating IDs */
  let buttonCounter = 0;

  // ─── WebSocket event handlers ──────────────────────────────────────────────

  ws.on('open', () => {
    console.log('[StreamDeckMobile] WebSocket connected, registering...');
    ws.send(JSON.stringify({
      event: cliArgs.registerEvent,
      uuid: cliArgs.pluginUUID,
    }));
    console.log('[StreamDeckMobile] Plugin registered');
  });

  ws.on('message', (raw: Buffer) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw.toString()) as Record<string, unknown>;
    } catch {
      return;
    }

    switch (msg.event) {
      case 'deviceDidConnect': {
        const device: DeviceInfo = {
          id: msg.device as string,
          name: (msg.deviceInfo as Record<string, unknown>)?.name as string ?? `Device ${msg.device}`,
          size: (msg.deviceInfo as Record<string, unknown>)?.size as DeviceInfo['size'] ?? { columns: 5, rows: 3 },
        };
        devices = [...devices.filter(d => d.id !== device.id), device];
        if (!activeDeviceId) activeDeviceId = device.id;
        mobileEventEmitter.emit('toMobile', { type: 'deviceConnected', device });
        break;
      }

      case 'deviceDidDisconnect': {
        devices = devices.filter(d => d.id !== (msg.device as string));
        if (activeDeviceId === (msg.device as string)) {
          activeDeviceId = devices.length > 0 ? devices[0].id : null;
        }
        mobileEventEmitter.emit('toMobile', { type: 'deviceDisconnected', deviceId: msg.device });
        break;
      }

      case 'willAppear': {
        const ctx = msg.context as string;
        if (contextMap.has(ctx)) {
          const buttonId = contextMap.get(ctx)!;
          mobileEventEmitter.emit('toMobile', {
            type: 'buttonStateChanged',
            buttonId,
            state: extractState(msg.payload as Record<string, unknown> | undefined),
          });
        }
        break;
      }

      case 'willDisappear': {
        const ctx = msg.context as string;
        contextMap.delete(ctx);
        break;
      }

      case 'keyDown': {
        const ctx = msg.context as string;
        if (contextMap.has(ctx)) {
          const buttonId = contextMap.get(ctx)!;
          const payload = msg.payload as Record<string, unknown> | undefined;
          mobileEventEmitter.emit('toMobile', {
            type: 'keyDown',
            buttonId,
            position: payload?.coordinates ?? { column: 0, row: 0 },
          });
        }
        break;
      }

      case 'keyUp': {
        const ctx = msg.context as string;
        if (contextMap.has(ctx)) {
          const buttonId = contextMap.get(ctx)!;
          const payload = msg.payload as Record<string, unknown> | undefined;
          mobileEventEmitter.emit('toMobile', {
            type: 'keyUp',
            buttonId,
            position: payload?.coordinates ?? { column: 0, row: 0 },
          });
        }
        break;
      }
    }
  });

  ws.on('error', (err: Error) => {
    console.error('[StreamDeckMobile] WebSocket error:', err.message);
  });

  ws.on('close', () => {
    console.log('[StreamDeckMobile] Disconnected from OpenDeck');
  });

  // ─── Bridge implementation ─────────────────────────────────────────────────

  const bridge: MobileBridge = {
    pushLayout(layout: StreamDeckLayout) {
      if (ws.readyState !== WebSocket.OPEN) {
        return { success: false, message: 'Not connected to OpenDeck' };
      }

      // Clear old mappings
      contextMap.clear();
      buttonMap.clear();

      if (layout.deviceId && layout.deviceId !== activeDeviceId) {
        activeDeviceId = layout.deviceId;
      }

      const columns = layout.dimensions?.columns ?? 5;
      const rows = layout.dimensions?.rows ?? 3;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
          const button = layout.buttons?.find(
            b => b.position.column === col && b.position.row === row
          );

          if (button?.actionUuid) {
            const ctx = `${cliArgs.pluginUUID}_${Date.now()}_${buttonCounter++}`;
            contextMap.set(ctx, button.id);
            buttonMap.set(button.id, ctx);
          }
        }
      }

      return { success: true, message: `Layout pushed: ${layout.buttons?.length ?? 0} buttons` };
    },

    updateButton(buttonId: string, config: Partial<ButtonConfig>) {
      const ctx = buttonMap.get(buttonId);
      if (!ctx || ws.readyState !== WebSocket.OPEN) return;

      if (config.state) {
        const st = config.state;
        if (st.imageBase64) {
          ws.send(JSON.stringify({
            event: 'setImage',
            context: ctx,
            payload: { image: st.imageBase64, target: 0 },
          }));
        }
        if (st.title !== undefined) {
          ws.send(JSON.stringify({
            event: 'setTitle',
            context: ctx,
            payload: { title: st.title, target: 0 },
          }));
        }
      }

      if (config.settings) {
        ws.send(JSON.stringify({
          event: 'setSettings',
          context: ctx,
          payload: config.settings,
        }));
      }
    },

    removeButton(buttonId: string) {
      const ctx = buttonMap.get(buttonId);
      if (ctx) {
        contextMap.delete(ctx);
        buttonMap.delete(buttonId);
      }
    },

    getStatus() {
      return {
        status: (ws.readyState === WebSocket.OPEN ? 'connected' : 'disconnected') as const,
        pluginVersion: '1.0.0',
        opendeckVersion: (cliArgs.info?.application?.version as string) ?? 'unknown',
        devices,
        activeDeviceId,
      };
    },

    getActionCatalog() {
      return {
        actions: [
          {
            uuid: ACTION_UUIDS.CUSTOM_BUTTON,
            name: 'Custom Button',
            tooltip: 'A customizable button with image and text',
            icon: 'custom-action-icon',
            states: 1,
            controllers: ['Keypad'],
            settingsSchema: [
              { key: 'label', label: 'Label', type: 'text' as const, default: '' },
              { key: 'color', label: 'Color', type: 'color' as const, default: '#FFFFFF' },
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
              { key: 'url', label: 'URL', type: 'text' as const, default: 'https://' },
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
              { key: 'modifiers', label: 'Modifiers (Ctrl,Alt,Shift,Win)', type: 'text' as const, default: '' },
              { key: 'key', label: 'Key', type: 'text' as const, default: '' },
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
              { key: 'text', label: 'Text to type', type: 'text' as const, default: '' },
            ],
          },
        ],
      };
    },
  };

  // ─── Start mobile HTTP/WS server ───────────────────────────────────────────

  const { emitter: mobileEventEmitter } = startMobileServer({
    opendeckWs: ws,
    pluginUUID: cliArgs.pluginUUID,
    devices,
    bridge,
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractState(payload?: Record<string, unknown>): ButtonState {
  return {
    imageBase64: (payload?.image as string) ?? null,
    title: (payload?.title as string) ?? '',
    titleColor: (payload?.titleColor as string) ?? '#FFFFFF',
    fontSize: parseInt(String(payload?.fontSize ?? '14'), 10) || 14,
    fontStyle: (payload?.fontStyle as string) ?? 'Regular',
    showTitle: payload?.showTitle !== false,
    titleAlignment: (payload?.titleAlignment as string) ?? 'middle',
  };
}
