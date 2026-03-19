import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppSettings } from "../types";

type SetError = (message: string | null) => void;

const defaultSettings: AppSettings = {
  maxHistoryItems: 1000,
  pageSize: 20,
  hotkey: "Ctrl+Alt+M",
  launchOnStartup: false,
};

export function useSettings(setError: SetError) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  const refresh = useCallback(async () => {
    try {
      const result = await invoke<AppSettings>("get_settings");
      setSettings(result);
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "設定の取得に失敗しました。");
    }
  }, [setError]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveSettings = useCallback(
    async (nextSettings: AppSettings) => {
      try {
        const result = await invoke<AppSettings>("update_settings", { settings: nextSettings });
        setSettings(result);
        setError(null);
      } catch (error) {
        setError(error instanceof Error ? error.message : "設定の保存に失敗しました。");
      }
    },
    [setError],
  );

  return {
    settings,
    refresh,
    saveSettings,
  };
}
