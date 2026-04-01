import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import type { ActivationMode, AppSettings } from "../types";

interface SettingsViewProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => Promise<void>;
  onPasswordChanged: () => void;
}

function SettingsView({ settings, onSave, onPasswordChanged }: SettingsViewProps) {
  const { t, i18n } = useTranslation();
  const [draft, setDraft] = useState(settings);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  // Clear the auto-reset timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const triggerSave = async (next: AppSettings) => {
    await onSave(next);
    setSaveStatus("saved");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
  };

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem("clipor-lang", lang);
    void emit("ui://lang-change", lang);
    void triggerSave(draft);
  };

  const handleSetPassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!newPassword) {
      setPasswordError(t("password.required"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t("password.mismatch"));
      return;
    }

    try {
      if (settings.requirePassword) {
        if (!currentPassword) {
          setPasswordError(t("password.current_required"));
          return;
        }
        const ok = await invoke<boolean>("verify_password", { password: currentPassword });
        if (!ok) {
          setPasswordError(t("password.current_incorrect"));
          return;
        }
      }

      await invoke("set_password", { password: newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess(
        settings.requirePassword
          ? t("password.success_changed")
          : t("password.success_set_encrypted"),
      );
      onPasswordChanged();
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : t("password.failed_set"));
    }
  };

  const handleRemovePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError(t("password.current_required"));
      return;
    }

    try {
      await invoke("remove_password", { currentPassword });
      setCurrentPassword("");
      setPasswordSuccess(t("password.success_removed"));
      onPasswordChanged();
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : t("password.failed_remove"));
    }
  };

  return (
    <div className="settings-panel">
      {saveStatus === "saved" ? (
        <p style={{ color: "var(--accent)", fontSize: "11px", marginBottom: "4px" }}>
          {t("settings.saved_feedback")}
        </p>
      ) : null}

      <label>
        <span>{t("settings.label_language")}</span>
        <select
          value={i18n.language}
          onChange={(event) => handleLanguageChange(event.target.value)}
        >
          <option value="ja">{t("settings.language_ja")}</option>
          <option value="en">{t("settings.language_en")}</option>
        </select>
      </label>
      <label>
        <span>{t("settings.label_history_limit")}</span>
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
          onBlur={(event) => {
            const next = { ...draft, maxHistoryItems: Number(event.target.value) };
            setDraft(next);
            void triggerSave(next);
          }}
        />
      </label>
      <label>
        <span>{t("settings.label_page_size")}</span>
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
          onBlur={(event) => {
            const next = { ...draft, pageSize: Number(event.target.value) };
            setDraft(next);
            void triggerSave(next);
          }}
        />
      </label>
      <fieldset className="activation-mode-fieldset">
        <legend>{t("settings.label_activation")}</legend>
        {(
          [
            { value: "hotkey", label: t("settings.activation_hotkey") },
            { value: "double-ctrl", label: t("settings.activation_double_ctrl") },
            { value: "double-alt", label: t("settings.activation_double_alt") },
          ] as const
        ).map((option) => (
          <label key={option.value} className="radio-row">
            <input
              type="radio"
              name="activationMode"
              value={option.value}
              checked={draft.activationMode === option.value}
              onChange={() => {
                const next = { ...draft, activationMode: option.value as ActivationMode };
                setDraft(next);
                void triggerSave(next);
              }}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>
      {draft.activationMode === "hotkey" ? (
        <>
          <label>
            <span>{t("settings.label_hotkey")}</span>
            <input
              type="text"
              value={draft.hotkey}
              placeholder={t("settings.placeholder_hotkey")}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  hotkey: event.target.value,
                }))
              }
              onBlur={(event) => {
                const next = { ...draft, hotkey: event.target.value };
                setDraft(next);
                void triggerSave(next);
              }}
            />
          </label>
          <p className="help-text">{t("settings.help_hotkey_examples")}</p>
        </>
      ) : null}
      <label>
        <span>{t("settings.label_blur_delay")}</span>
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
          onBlur={(event) => {
            const next = { ...draft, blurDelayMs: Number(event.target.value) };
            setDraft(next);
            void triggerSave(next);
          }}
        />
      </label>
      <p className="help-text">{t("settings.help_blur_delay")}</p>
      <label>
        <span>{t("settings.label_preview_size")}</span>
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
            onBlur={(event) => {
              const next = { ...draft, previewWidth: Number(event.target.value) };
              setDraft(next);
              void triggerSave(next);
            }}
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
            onBlur={(event) => {
              const next = { ...draft, previewHeight: Number(event.target.value) };
              setDraft(next);
              void triggerSave(next);
            }}
            style={{ width: "70px" }}
          />
        </div>
      </label>
      <label>
        <span>{t("settings.label_image_preview_size")}</span>
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
            onBlur={(event) => {
              const next = { ...draft, previewImageWidth: Number(event.target.value) };
              setDraft(next);
              void triggerSave(next);
            }}
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
            onBlur={(event) => {
              const next = { ...draft, previewImageHeight: Number(event.target.value) };
              setDraft(next);
              void triggerSave(next);
            }}
            style={{ width: "70px" }}
          />
        </div>
      </label>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={draft.launchOnStartup}
          onChange={(event) => {
            const next = { ...draft, launchOnStartup: event.target.checked };
            setDraft(next);
            void triggerSave(next);
          }}
        />
        <span>{t("settings.label_launch_on_startup")}</span>
      </label>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={draft.rememberLastTab}
          onChange={(event) => {
            const next = { ...draft, rememberLastTab: event.target.checked };
            setDraft(next);
            void triggerSave(next);
          }}
        />
        <span>{t("settings.label_remember_last_tab")}</span>
      </label>

      <div style={{ borderTop: "1px solid var(--line)", paddingTop: "8px", marginTop: "4px" }}>
        <span style={{ fontSize: "10px", color: "var(--muted)", fontWeight: "bold" }}>
          {t("settings.section_password_protection")}
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
              <span>{t("settings.label_current_password")}</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </label>
            <label>
              <span>{t("settings.label_new_password")}</span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </label>
            <label>
              <span>{t("settings.label_confirm_password")}</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>
            <div style={{ display: "flex", gap: "6px" }}>
              <button type="button" onClick={() => void handleSetPassword()}>
                {t("settings.button_change_password")}
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => void handleRemovePassword()}
              >
                {t("settings.button_remove_password")}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "6px" }}>
            <label>
              <span>{t("settings.label_new_password")}</span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </label>
            <label>
              <span>{t("settings.label_confirm_password")}</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>
            <button type="button" onClick={() => void handleSetPassword()}>
              {t("settings.button_set_password")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default SettingsView;
