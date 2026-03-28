import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import i18n from "../i18n";
import type { AppSettings } from "../types";

type SetError = (message: string | null) => void;

const defaultSettings: AppSettings = {
  maxHistoryItems: 1000,
  pageSize: 20,
  hotkey: "Ctrl+Alt+Z",
  activationMode: "hotkey",
  launchOnStartup: false,
  blurDelayMs: 100,
  previewWidth: 320,
  previewHeight: 400,
  previewImageWidth: 520,
  previewImageHeight: 520,
  requirePassword: false,
};

export function useSettings(setError: SetError) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [setupSkipped, setSetupSkipped] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const result = await invoke<AppSettings>("get_settings");
      setSettings(result);
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : i18n.t("errors.settings_fetch"));
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
        setError(error instanceof Error ? error.message : i18n.t("errors.settings_save"));
      }
    },
    [setError],
  );

  const skipSetup = useCallback(() => {
    setSetupSkipped(true);
  }, []);

  return {
    settings,
    setupSkipped,
    refresh,
    saveSettings,
    skipSetup,
  };
}
