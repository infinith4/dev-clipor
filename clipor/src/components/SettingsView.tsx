import { useEffect, useState } from "react";
import type { AppSettings } from "../types";

interface SettingsViewProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
}

function SettingsView({ settings, onSave }: SettingsViewProps) {
  const [draft, setDraft] = useState(settings);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  return (
    <form
      className="settings-panel"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(draft);
      }}
    >
      <label>
        <span>History limit</span>
        <input
          type="number"
          min={10}
          max={5000}
          value={draft.maxHistoryItems}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              maxHistoryItems: Number(event.target.value),
            }))
          }
        />
      </label>
      <label>
        <span>Page size</span>
        <input
          type="number"
          min={5}
          max={100}
          value={draft.pageSize}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              pageSize: Number(event.target.value),
            }))
          }
        />
      </label>
      <label>
        <span>Hotkey</span>
        <input
          type="text"
          value={draft.hotkey}
          placeholder="Ctrl+Alt+M"
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              hotkey: event.target.value,
            }))
          }
        />
      </label>
      <p className="help-text">例: Ctrl+Alt+M, Ctrl+Shift+K, Alt+F2</p>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={draft.launchOnStartup}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              launchOnStartup: event.target.checked,
            }))
          }
        />
        <span>Launch on Windows startup</span>
      </label>
      <button type="submit">Save settings</button>
    </form>
  );
}

export default SettingsView;
