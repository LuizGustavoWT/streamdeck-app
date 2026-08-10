import { useState, useCallback } from 'react';
import type { StreamDeckLayout, ButtonConfig, ButtonState } from '../services/OpenDeckBridge';

/**
 * Hook for managing the Stream Deck layout state on the mobile app.
 */
export function useLayout(initialColumns = 5, initialRows = 3) {
  const [layout, setLayout] = useState<StreamDeckLayout>({
    deviceId: '',
    dimensions: { columns: initialColumns, rows: initialRows },
    buttons: [],
    name: 'My Layout',
  });

  const [selectedPosition, setSelectedPosition] = useState<{
    column: number;
    row: number;
  } | null>(null);

  const findButton = useCallback(
    (col: number, row: number): ButtonConfig | undefined => {
      return layout.buttons.find(
        b => b.position.column === col && b.position.row === row
      );
    },
    [layout.buttons]
  );

  const addOrUpdateButton = useCallback(
    (
      col: number,
      row: number,
      actionUuid: string,
      settings: Record<string, unknown> = {},
      state?: Partial<ButtonState>
    ) => {
      setLayout(prev => {
        const existing = prev.buttons.findIndex(
          b => b.position.column === col && b.position.row === row
        );

        const button: ButtonConfig = {
          id: existing >= 0
            ? prev.buttons[existing].id
            : `btn_${col}_${row}_${Date.now()}`,
          position: { column: col, row },
          actionUuid,
          settings,
          state: {
            imageBase64: null,
            title: '',
            titleColor: '#FFFFFF',
            fontSize: 14,
            fontStyle: 'Regular',
            showTitle: true,
            titleAlignment: 'middle',
            ...state,
          },
          enabled: true,
        };

        const buttons = [...prev.buttons];
        if (existing >= 0) {
          buttons[existing] = button;
        } else {
          buttons.push(button);
        }

        return { ...prev, buttons };
      });
    },
    []
  );

  const removeButton = useCallback((col: number, row: number) => {
    setLayout(prev => ({
      ...prev,
      buttons: prev.buttons.filter(
        b => !(b.position.column === col && b.position.row === row)
      ),
    }));
  }, []);

  const updateButtonState = useCallback(
    (buttonId: string, state: Partial<ButtonState>) => {
      setLayout(prev => ({
        ...prev,
        buttons: prev.buttons.map(b =>
          b.id === buttonId
            ? { ...b, state: { ...b.state, ...state } }
            : b
        ),
      }));
    },
    []
  );

  const setLayoutName = useCallback((name: string) => {
    setLayout(prev => ({ ...prev, name }));
  }, []);

  const setDimensions = useCallback((columns: number, rows: number) => {
    setLayout(prev => {
      // Filter out buttons that would be out of bounds
      const buttons = prev.buttons.filter(
        b => b.position.column < columns && b.position.row < rows
      );
      return { ...prev, dimensions: { columns, rows }, buttons };
    });
  }, []);

  const clearLayout = useCallback(() => {
    setLayout(prev => ({ ...prev, buttons: [] }));
  }, []);

  return {
    layout,
    selectedPosition,
    setSelectedPosition,
    findButton,
    addOrUpdateButton,
    removeButton,
    updateButtonState,
    setLayoutName,
    setDimensions,
    clearLayout,
  };
}
