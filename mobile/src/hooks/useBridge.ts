import { useState, useEffect, useCallback } from 'react';
import {
  connect,
  disconnect,
  getStatus,
  pushLayout,
  getActions,
  onEvent,
  onConnectionStateChange,
  getConnectionState,
  sendEvent,
} from '../services/OpenDeckBridge';
import type {
  PluginStatus,
  StreamDeckLayout,
  ActionInfo,
  ButtonConfig,
  PluginToMobileEvent,
  PushLayoutResponse,
} from '../services/OpenDeckBridge';

/**
 * Hook for managing the OpenDeck plugin connection.
 */
export function useBridge() {
  const [status, setStatus] = useState<PluginStatus | null>(null);
  const [connectionState, setConnectionState] = useState(getConnectionState());
  const [actions, setActions] = useState<ActionInfo[]>([]);
  const [lastEvent, setLastEvent] = useState<PluginToMobileEvent | null>(null);

  useEffect(() => {
    const unsub = onConnectionStateChange(setConnectionState);
    const unsubEvent = onEvent(setLastEvent);
    return () => {
      unsub();
      unsubEvent();
    };
  }, []);

  const connectToServer = useCallback(async (host: string, port?: number) => {
    connect(host, port);
    try {
      const s = await getStatus();
      setStatus(s);
      const a = await getActions();
      setActions(a.actions);
    } catch {
      // Status will update via WebSocket
    }
  }, []);

  const disconnectFromServer = useCallback(() => {
    disconnect();
    setStatus(null);
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const s = await getStatus();
      setStatus(s);
    } catch {
      // Ignore
    }
  }, []);

  const pushLayoutToDeck = useCallback(async (
    layout: StreamDeckLayout
  ): Promise<PushLayoutResponse> => {
    return pushLayout(layout);
  }, []);

  const sendToPlugin = useCallback((event: Record<string, unknown>) => {
    sendEvent(event);
  }, []);

  const updateButton = useCallback((buttonId: string, config: Partial<ButtonConfig>) => {
    sendEvent({ type: 'updateButton', buttonId, config });
  }, []);

  const removeButton = useCallback((buttonId: string) => {
    sendEvent({ type: 'removeButton', buttonId });
  }, []);

  return {
    status,
    connectionState,
    actions,
    lastEvent,
    connectToServer,
    disconnectFromServer,
    refreshStatus,
    pushLayoutToDeck,
    sendToPlugin,
    updateButton,
    removeButton,
  };
}
