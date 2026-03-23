import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppSettings } from "../types";

interface SettingsViewProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onPasswordChanged: () => void;
}

function SettingsView({ settings, onSave, onPasswordChanged }: SettingsViewProps) {
  const [draft, setDraft] = useState(settings);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const handleSetPassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!newPassword) {
      setPasswordError("パスワードを入力してください。");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("パスワードが一致しません。");
      return;
    }

    try {
      if (settings.requirePassword) {
        if (!currentPassword) {
          setPasswordError("現在のパスワードを入力してください。");
          return;
        }
        const ok = await invoke<boolean>("verify_password", { password: currentPassword });
        if (!ok) {
          setPasswordError("現在のパスワードが正しくありません。");
          return;
        }
      }

      await invoke("set_password", { password: newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess(
        settings.requirePassword
          ? "パスワードを変更しました。"
          : "パスワードを設定しました。DB 内の履歴と定型文を暗号化しました。",
      );
      onPasswordChanged();
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "パスワード設定に失敗しました。");
    }
  };

  const handleRemovePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError("現在のパスワードを入力してください。");
      return;
    }

    try {
      await invoke("remove_password", { currentPassword });
      setCurrentPassword("");
      setPasswordSuccess("パスワードを解除しました。DB 内の履歴と定型文を復号しました。");
      onPasswordChanged();
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "パスワード解除に失敗しました。");
    }
  };

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
          placeholder="Ctrl+Alt+Z"
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              hotkey: event.target.value,
            }))
          }
        />
      </label>
      <p className="help-text">例: Ctrl+Alt+Z, Ctrl+Shift+K, Alt+F2</p>
      <label>
        <span>Blur delay (ms)</span>
        <input
          type="number"
          min={0}
          max={1000}
          value={draft.blurDelayMs}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              blurDelayMs: Number(event.target.value),
            }))
          }
        />
      </label>
      <p className="help-text">フォーカス移動時にウィンドウを閉じるまでの遅延</p>
      <label>
        <span>Preview size (W x H)</span>
        <div style={{ display: "flex", gap: "4px" }}>
          <input
            type="number"
            min={100}
            max={1000}
            value={draft.previewWidth}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                previewWidth: Number(event.target.value),
              }))
            }
            style={{ width: "70px" }}
          />
          <span style={{ alignSelf: "center" }}>x</span>
          <input
            type="number"
            min={100}
            max={1000}
            value={draft.previewHeight}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                previewHeight: Number(event.target.value),
              }))
            }
            style={{ width: "70px" }}
          />
        </div>
      </label>
      <label>
        <span>Image preview size (W x H)</span>
        <div style={{ display: "flex", gap: "4px" }}>
          <input
            type="number"
            min={100}
            max={1500}
            value={draft.previewImageWidth}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                previewImageWidth: Number(event.target.value),
              }))
            }
            style={{ width: "70px" }}
          />
          <span style={{ alignSelf: "center" }}>x</span>
          <input
            type="number"
            min={100}
            max={1500}
            value={draft.previewImageHeight}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                previewImageHeight: Number(event.target.value),
              }))
            }
            style={{ width: "70px" }}
          />
        </div>
      </label>
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

      <div style={{ borderTop: "1px solid var(--line)", paddingTop: "8px", marginTop: "4px" }}>
        <span style={{ fontSize: "10px", color: "var(--muted)", fontWeight: "bold" }}>
          Password Protection (AES-256-GCM)
        </span>

        {passwordError ? (
          <p style={{ color: "var(--danger)", fontSize: "11px", marginTop: "4px" }}>
            {passwordError}
          </p>
        ) : null}
        {passwordSuccess ? (
          <p style={{ color: "var(--accent)", fontSize: "11px", marginTop: "4px" }}>
            {passwordSuccess}
          </p>
        ) : null}

        {settings.requirePassword ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "6px" }}>
            <label>
              <span>Current password</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </label>
            <label>
              <span>New password</span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </label>
            <label>
              <span>Confirm password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>
            <div style={{ display: "flex", gap: "6px" }}>
              <button type="button" onClick={() => void handleSetPassword()}>
                Change password
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => void handleRemovePassword()}
              >
                Remove password
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "6px" }}>
            <label>
              <span>New password</span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </label>
            <label>
              <span>Confirm password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>
            <button type="button" onClick={() => void handleSetPassword()}>
              Set password
            </button>
          </div>
        )}
      </div>
    </form>
  );
}

export default SettingsView;
