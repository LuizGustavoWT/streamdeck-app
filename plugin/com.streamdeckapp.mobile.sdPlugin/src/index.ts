/**
 * OpenDeck Plugin — StreamDeck Mobile Bridge
 *
 * Flow:
 *   1. Plugin registers with OpenDeck via WebSocket
 *   2. User drags actions onto Stream Deck buttons in OpenDeck UI
 *   3. Plugin receives willAppear for each button → builds layout → sends to mobile
 *   4. Mobile app configures button states → plugin sends setImage/setTitle to OpenDeck
 *   5. Button presses (keyDown/keyUp) forwarded to mobile → mobile can toggle states
 *   6. Plugin runs HTTP+WS server for mobile app communication
 */

import { WebSocket } from 'ws';
import { startMobileServer, type MobileBridge, type DeckButton, type ButtonState, type DeckLayout } from './server.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CliArgs {
  port: number;
  pluginUUID: string;
  registerEvent: string;
  info: OpenDeckInfo;
}

interface OpenDeckInfo {
  application?: { version?: string };
  devices?: { id: string; name: string; size: { columns: number; rows: number } }[];
}

const ACTION_UUIDS = {
  CUSTOM_BUTTON: 'com.streamdeckapp.mobile.custombutton',
  URL_OPENER: 'com.streamdeckapp.mobile.urlopener',
  HOTKEY: 'com.streamdeckapp.mobile.hotkey',
  TEXT_INPUT: 'com.streamdeckapp.mobile.textinput',
  MULTI_BUTTON: 'com.streamdeckapp.mobile.multibutton',
} as const;

const ACTION_NAMES: Record<string, string> = {
  [ACTION_UUIDS.CUSTOM_BUTTON]: 'Custom Button',
  [ACTION_UUIDS.URL_OPENER]: 'URL Opener',
  [ACTION_UUIDS.HOTKEY]: 'Hotkey',
  [ACTION_UUIDS.TEXT_INPUT]: 'Text Sender',
  [ACTION_UUIDS.MULTI_BUTTON]: 'Multi Button',
};

function parseArgs(argv: string[]): Partial<CliArgs> {
  const args: Partial<CliArgs> = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '-port' && i + 1 < argv.length) args.port = parseInt(argv[++i], 10);
    else if (argv[i] === '-pluginUUID' && i + 1 < argv.length) args.pluginUUID = argv[++i];
    else if (argv[i] === '-registerEvent' && i + 1 < argv.length) args.registerEvent = argv[++i];
    else if (argv[i] === '-info' && i + 1 < argv.length) {
      try { args.info = JSON.parse(argv[++i]) as OpenDeckInfo; } catch { args.info = {}; }
    }
  }
  return args;
}

// ─── State helpers ────────────────────────────────────────────────────────────

function defaultState(overrides?: Partial<ButtonState>): ButtonState {
  return {
    imageBase64: null,
    title: '',
    titleColor: '#FFFFFF',
    fontSize: 14,
    fontStyle: 'Regular',
    showTitle: true,
    titleAlignment: 'middle',
    ...overrides,
  };
}

function sendSetImage(ws: WebSocket, context: string, imageBase64: string, stateIndex = 0) {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ event: 'setImage', context, payload: { image: imageBase64, target: stateIndex } }));
}

function sendSetTitle(ws: WebSocket, context: string, title: string, stateIndex = 0) {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ event: 'setTitle', context, payload: { title, target: stateIndex } }));
}

function sendToDeck(ws: WebSocket, event: string, context: string, payload: Record<string, unknown>) {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ event, context, payload }));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const cliArgs = parseArgs(process.argv);
console.log(`[StreamDeckMobile] Plugin started (PID ${process.pid})`);

if (!cliArgs.port || !cliArgs.pluginUUID || !cliArgs.registerEvent) {
  console.log('[StreamDeckMobile] Mode: standalone — mobile server only');
  const { emitter } = startMobileServer({ pluginUUID: 'dev-mode', devices: [], bridge: undefined });
} else {
  console.log(`[StreamDeckMobile] Connecting to OpenDeck WS on port ${cliArgs.port}`);

  const ws = new WebSocket(`ws://localhost:${cliArgs.port}`);
  let devices: OpenDeckInfo['devices'] = cliArgs.info?.devices ?? [];
  let activeDeviceId = devices[0]?.id ?? null;

  // Layout tracking: context → DeckButton
  const buttonsByContext = new Map<string, DeckButton>();
  let currentProfile = 'Default';

  function buildLayout(): DeckLayout {
    const devs = devices ?? [];
    const dev = devs.find(d => d.id === activeDeviceId) ?? devs[0];
    return {
      deviceId: activeDeviceId ?? '',
      dimensions: dev?.size ?? { columns: 5, rows: 3 },
      buttons: [...buttonsByContext.values()],
      profileName: currentProfile,
    };
  }

  function emitLayout() {
    mobileEmitter.emit('toMobile', { type: 'layoutUpdate', layout: buildLayout() });
  }

  // ─── OpenDeck WebSocket handlers ──────────────────────────────────────────

  ws.on('open', () => {
    console.log('[StreamDeckMobile] Connected to OpenDeck, registering...');
    ws.send(JSON.stringify({ event: cliArgs.registerEvent, uuid: cliArgs.pluginUUID }));
  });

  ws.on('message', (raw: Buffer) => {
    let msg: Record<string, unknown>;
    try { msg = JSON.parse(raw.toString()) as Record<string, unknown>; } catch { return; }

    switch (msg.event) {
      case 'deviceDidConnect': {
        const dev = {
          id: msg.device as string,
          name: (msg.deviceInfo as Record<string, unknown>)?.name as string ?? `Device ${msg.device}`,
          size: (msg.deviceInfo as Record<string, unknown>)?.size as { columns: number; rows: number } ?? { columns: 5, rows: 3 },
        };
        devices = [...(devices ?? []).filter(d => d.id !== dev.id), dev];
        if (!activeDeviceId) activeDeviceId = dev.id;
        mobileEmitter.emit('toMobile', { type: 'deviceConnected', device: dev });
        break;
      }

      case 'deviceDidDisconnect':
        devices = (devices ?? []).filter(d => d.id !== (msg.device as string));
        if (activeDeviceId === (msg.device as string)) activeDeviceId = devices[0]?.id ?? null;
        mobileEmitter.emit('toMobile', { type: 'deviceDisconnected', deviceId: msg.device });
        break;

      case 'willAppear': {
        const ctx = msg.context as string;
        const action = msg.action as string;
        const payload = msg.payload as Record<string, unknown> | undefined;
        const coords = (payload?.coordinates as { column: number; row: number }) ?? { column: 0, row: 0 };
        const settings = (payload?.settings as Record<string, unknown>) ?? {};

        const actionName = ACTION_NAMES[action] ?? action.split('.').pop() ?? action;

        // Parse group info from settings
        const groupId = (settings.groupId as string) ?? null;
        const groupSize = (settings.groupSize as DeckButton['groupSize']) ?? '1x1';
        const groupOffset = (settings.groupOffset as DeckButton['groupOffset']) ?? { col: 0, row: 0 };

        const button: DeckButton = {
          context: ctx,
          actionUuid: action,
          actionName,
          column: coords.column,
          row: coords.row,
          stateIndex: (payload?.state as number) ?? 0,
          states: [defaultState({ title: actionName }), defaultState({ title: actionName, titleColor: '#e94560' })],
          settings,
          groupId,
          groupSize,
          groupOffset,
        };

        buttonsByContext.set(ctx, button);
        mobileEmitter.emit('toMobile', { type: 'buttonAppeared', button });
        emitLayout();

        // Apply existing state to deck
        const st = button.states[button.stateIndex];
        if (st.title) sendSetTitle(ws, ctx, st.title, button.stateIndex);
        if (st.imageBase64) sendSetImage(ws, ctx, st.imageBase64, button.stateIndex);

        console.log(`[StreamDeckMobile] Button appeared: ${actionName} at (${coords.column},${coords.row})`);
        break;
      }

      case 'willDisappear': {
        const ctx = msg.context as string;
        buttonsByContext.delete(ctx);
        mobileEmitter.emit('toMobile', { type: 'buttonDisappeared', context: ctx });
        emitLayout();
        break;
      }

      case 'keyDown': {
        const ctx = msg.context as string;
        const payload = msg.payload as Record<string, unknown> | undefined;
        const coords = payload?.coordinates as { column: number; row: number } ?? { column: 0, row: 0 };
        mobileEmitter.emit('toMobile', { type: 'keyDown', context: ctx, column: coords.column, row: coords.row });
        break;
      }

      case 'keyUp': {
        const ctx = msg.context as string;
        const payload = msg.payload as Record<string, unknown> | undefined;
        const coords = payload?.coordinates as { column: number; row: number } ?? { column: 0, row: 0 };
        mobileEmitter.emit('toMobile', { type: 'keyUp', context: ctx, column: coords.column, row: coords.row });

        // Auto-toggle for custom/multi buttons
        const button = buttonsByContext.get(ctx);
        if (button && (button.actionUuid === ACTION_UUIDS.CUSTOM_BUTTON || button.actionUuid === ACTION_UUIDS.MULTI_BUTTON)) {
          if (button.states.length >= 2) {
            const newIdx = button.stateIndex === 0 ? 1 : 0;
            button.stateIndex = newIdx;
            const st = button.states[newIdx];

            sendToDeck(ws, 'setState', ctx, { state: newIdx });
            if (st.title) sendSetTitle(ws, ctx, st.title, newIdx);
            if (st.imageBase64) sendSetImage(ws, ctx, st.imageBase64, newIdx);

            mobileEmitter.emit('toMobile', { type: 'buttonStateChanged', context: ctx, stateIndex: newIdx, state: st });
          }
        }
        break;
      }

      case 'didReceiveSettings': {
        const ctx = msg.context as string;
        const payload = msg.payload as Record<string, unknown> | undefined;
        const button = buttonsByContext.get(ctx);
        if (button && payload?.settings) {
          button.settings = { ...button.settings, ...(payload.settings as Record<string, unknown>) };
        }
        break;
      }

      case 'sendToPlugin': {
        // Property inspector → plugin data
        break;
      }
    }
  });

  ws.on('error', (err: Error) => console.error('[StreamDeckMobile] WS error:', err.message));
  ws.on('close', () => console.log('[StreamDeckMobile] OpenDeck disconnected'));

  // ─── Mobile bridge ─────────────────────────────────────────────────────────

  const bridge: MobileBridge = {
    getStatus() {
      return {
        status: (ws.readyState === WebSocket.OPEN ? 'connected' : 'disconnected') as 'connected' | 'disconnected',
        pluginVersion: '1.0.0',
        opendeckVersion: cliArgs.info?.application?.version ?? 'unknown',
        devices: devices ?? [],
        activeDeviceId,
      };
    },

    getActionCatalog() {
      return {
        actions: [
          { uuid: ACTION_UUIDS.CUSTOM_BUTTON, name: 'Custom Button', tooltip: 'Configurable button with 2 states', icon: 'custom-action-icon', stateCount: 2, controllers: ['Keypad'], supportsMultiButton: false },
          { uuid: ACTION_UUIDS.URL_OPENER, name: 'URL Opener', tooltip: 'Opens a URL', icon: 'url-action-icon', stateCount: 1, controllers: ['Keypad'], supportsMultiButton: false },
          { uuid: ACTION_UUIDS.HOTKEY, name: 'Hotkey', tooltip: 'Keyboard shortcut', icon: 'hotkey-action-icon', stateCount: 1, controllers: ['Keypad'], supportsMultiButton: false },
          { uuid: ACTION_UUIDS.TEXT_INPUT, name: 'Text Sender', tooltip: 'Types text', icon: 'text-action-icon', stateCount: 1, controllers: ['Keypad'], supportsMultiButton: false },
          { uuid: ACTION_UUIDS.MULTI_BUTTON, name: 'Multi Button', tooltip: 'Spans 2x1 or 2x2 buttons', icon: 'custom-action-icon', stateCount: 2, controllers: ['Keypad'], supportsMultiButton: true, settingsSchema: [
            { key: 'groupSize', label: 'Size', type: 'select', default: '2x1', options: [{ label: '2x1 (wide)', value: '2x1' }, { label: '2x2 (large)', value: '2x2' }] },
          ]},
        ],
      };
    },

    getLayout(): DeckLayout { return buildLayout(); },

    setButtonState(context: string, stateIndex: number, state: Partial<ButtonState>) {
      const button = buttonsByContext.get(context);
      if (!button) return;
      button.states[stateIndex] = { ...button.states[stateIndex], ...state };
      button.stateIndex = stateIndex;

      const st = button.states[stateIndex];
      sendToDeck(ws, 'setState', context, { state: stateIndex });
      if (st.title !== undefined) sendSetTitle(ws, context, st.title, stateIndex);
      if (st.imageBase64) sendSetImage(ws, context, st.imageBase64, stateIndex);

      mobileEmitter.emit('toMobile', { type: 'buttonStateChanged', context, stateIndex, state: st });
    },

    toggleButtonState(context: string) {
      const button = buttonsByContext.get(context);
      if (!button || button.states.length < 2) return;
      const newIdx = button.stateIndex === 0 ? 1 : 0;
      this.setButtonState(context, newIdx, button.states[newIdx]);
    },

    setGroupState(groupId: string, stateIndex: number, state: Partial<ButtonState>) {
      for (const [, button] of buttonsByContext) {
        if (button.groupId === groupId) {
          this.setButtonState(button.context, stateIndex, state);
        }
      }
    },

    setButtonSettings(context: string, settings: Record<string, unknown>) {
      sendToDeck(ws, 'setSettings', context, settings);
    },
  };

  // ─── Start mobile server ────────────────────────────────────────────────────

  const { emitter: mobileEmitter } = startMobileServer({
    pluginUUID: cliArgs.pluginUUID,
    devices: devices ?? [],
    bridge,
  });
}
