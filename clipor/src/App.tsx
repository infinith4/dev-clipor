import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import type { Window } from "@tauri-apps/api/window";
import PopupWindow from "./components/PopupWindow";
import PreviewPanel from "./components/PreviewPanel";
import { useClipboardHistory } from "./hooks/useClipboardHistory";
import { useSettings } from "./hooks/useSettings";
import { useTemplates } from "./hooks/useTemplates";
import type { PopupTab } from "./types";

const COMPACT_WINDOW_WIDTH = 230;
const WINDOW_HEIGHT = 720;

// Detect if this is the preview window by checking the Tauri window label
const isPreviewWindow = (() => {
  try {
    return getCurrentWindow().label === "preview";
  } catch {
    return false;
  }
})();

function App() {
  if (isPreviewWindow) {
    return <PreviewPanel />;
  }

  return <MainApp />;
}

function MainApp() {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<PopupTab>("history");
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [lockPassword, setLockPassword] = useState("");
  const [lockError, setLockError] = useState<string | null>(null);
  const [setupPassword, setSetupPassword] = useState("");
  const [setupConfirm, setSetupConfirm] = useState("");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [selectedHistoryId, setSelectedHistoryId] = useState<number | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [popupVisible, setPopupVisible] = useState(0);
  const popupWindowRef = useRef<Window | null>(null);
  const settings = useSettings(setError);
  const history = useClipboardHistory(settings.settings.pageSize, setError);
  const templates = useTemplates(setError);

  const hidePopup = useCallback(async () => {
    await invoke("hide_preview").catch(() => {});
    await popupWindowRef.current?.hide();
  }, []);

  // Check if password is required on mount
  useEffect(() => {
    if (settings.settings.requirePassword) {
      setLocked(true);
      setNeedsSetup(false);
    } else if (!settings.setupSkipped) {
      // No password set yet — show initial setup (can be skipped)
      setNeedsSetup(true);
    }
  }, [settings.settings.requirePassword, settings.setupSkipped]);

  const handleSetupPassword = useCallback(async () => {
    setSetupError(null);
    if (!setupPassword) {
      setSetupError(t("setup.password_required"));
      return;
    }
    if (setupPassword !== setupConfirm) {
      setSetupError(t("setup.password_mismatch"));
      return;
    }
    try {
      await invoke("set_password", { password: setupPassword });
      setSetupPassword("");
      setSetupConfirm("");
      setNeedsSetup(false);
      setLocked(false);
      await settings.refresh();
      await Promise.all([history.refresh(), templates.refresh()]);
    } catch (e) {
      setSetupError(e instanceof Error ? e.message : t("setup.password_failed"));
    }
  }, [setupPassword, setupConfirm, settings, history, templates, t]);

  const handleUnlock = useCallback(async () => {
    console.log("[unlock] attempting with password length:", lockPassword.length);
    try {
      const ok = await invoke<boolean>("verify_password", { password: lockPassword });
      console.log("[unlock] verify_password result:", ok);
      if (ok) {
        setLocked(false);
        setLockPassword("");
        setLockError(null);
        await Promise.all([history.refresh(), templates.refresh()]);
        console.log("[unlock] success, data refreshed");
      } else {
        setLockError(t("unlock.password_incorrect"));
      }
    } catch (e) {
      console.error("[unlock] error:", e);
      setLockError(e instanceof Error ? e.message : t("unlock.auth_failed"));
    }
  }, [lockPassword, history, templates, t]);

  useEffect(() => {
    try {
      popupWindowRef.current = getCurrentWindow();
    } catch (windowError) {
      setError(
        windowError instanceof Error
          ? windowError.message
          : t("app.window_init_failed"),
      );
    }
  }, []);

  useEffect(() => {
    if (history.entries.length === 0) {
      setSelectedHistoryId(null);
      return;
    }

    setSelectedHistoryId((current) =>
      current && history.entries.some((entry) => entry.id === current)
        ? current
        : history.entries[0].id,
    );
  }, [history.entries]);

  useEffect(() => {
    if (templates.templates.length === 0) {
      setSelectedTemplateId(null);
      return;
    }

    setSelectedTemplateId((current) =>
      current && templates.templates.some((template) => template.id === current)
        ? current
        : templates.templates[0].id,
    );
  }, [templates.templates]);

  // Get the viewport Y of the selected card element
  const getSelectedCardY = useCallback((id: number): number | null => {
    const el = document.querySelector(`.panel-card.selected`) as HTMLElement | null;
    if (el) return el.getBoundingClientRect().top;
    return null;
  }, []);

  // Show preview for a history entry by id
  const showHistoryPreview = useCallback((id: number) => {
    const entry = history.entries.find((e) => e.id === id);
    if (!entry) return;
    const isImage = entry.contentType === "image";
    const anchorY = getSelectedCardY(id);
    invoke("show_preview", {
      payload: {
        text: isImage ? null : entry.text,
        imageData: isImage ? (entry.imageData ?? null) : null,
        charCount: entry.charCount,
        copiedAt: entry.copiedAt,
      },
      anchorY: anchorY != null ? Math.round(anchorY) : null,
    }).catch((e) => {
      const msg = typeof e === "string" ? e : e instanceof Error ? e.message : JSON.stringify(e);
      setError(t("app.preview_failed", { message: msg }));
    });
  }, [history.entries, setError, getSelectedCardY, t]);

  // Show preview for a template entry by id
  const showTemplatePreview = useCallback((id: number) => {
    const tmpl = templates.templates.find((t) => t.id === id);
    if (!tmpl) return;
    const isImage = tmpl.contentType === "image" && tmpl.imageData;
    const anchorY = getSelectedCardY(tmpl.id);
    invoke("show_preview", {
      payload: {
        text: isImage ? null : tmpl.text,
        imageData: isImage ? (tmpl.imageData ?? null) : null,
        charCount: null,
        copiedAt: null,
      },
      anchorY: anchorY != null ? Math.round(anchorY) : null,
    }).catch((e) => {
      const msg = typeof e === "string" ? e : e instanceof Error ? e.message : JSON.stringify(e);
      setError(t("app.preview_failed", { message: msg }));
    });
  }, [templates.templates, setError, getSelectedCardY, t]);

  // Auto-show preview when selection changes
  useEffect(() => {
    console.log("[auto-preview] effect fired", { activeTab, selectedHistoryId, selectedTemplateId, locked, needsSetup });
    if (locked || needsSetup) return;
    if (activeTab === "history" && selectedHistoryId !== null) {
      showHistoryPreview(selectedHistoryId);
    } else if (activeTab === "templates" && selectedTemplateId !== null) {
      showTemplatePreview(selectedTemplateId);
    } else {
      invoke("hide_preview").catch(() => {});
    }
  }, [activeTab, selectedHistoryId, selectedTemplateId, locked, needsSetup, popupVisible, showHistoryPreview, showTemplatePreview]);

  useEffect(() => {
    const unlistenPopupPromise = listen("hotkey://toggle-popup", async () => {
      // Reset selection so the first item is focused after data loads
      setSelectedHistoryId(null);
      await Promise.all([history.refresh(), templates.refresh()]);
      if (!popupWindowRef.current) {
        return;
      }
      if (!settings.settings.rememberLastTab) {
        setActiveTab("history");
      }
      // Sync language to the preview window (it has a separate localStorage context)
      void emit("ui://lang-change", i18n.language);
      await popupWindowRef.current.show();
      await popupWindowRef.current.setFocus();
      setPopupVisible((v) => v + 1);
    });
    const unlistenTabPromise = listen<string>("ui://select-tab", async (event) => {
      if (event.payload === "history" || event.payload === "templates" || event.payload === "settings") {
        setActiveTab(event.payload);
        if (event.payload === "history") {
          setSelectedHistoryId(null);
          await Promise.all([history.refresh(), templates.refresh()]);
        }
      }
    });

    const handleKeyDown = async (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditableTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;

      if (event.key === "Escape") {
        // Don't hide during lock/setup screens
        if (!locked && !needsSetup) {
          await hidePopup();
        }
        return;
      }

      if (isEditableTarget) {
        return;
      }

      if (activeTab === "history") {
        const currentIndex = history.entries.findIndex((entry) => entry.id === selectedHistoryId);

        if (event.key === "ArrowDown" && history.entries.length > 0) {
          event.preventDefault();
          const nextIndex = currentIndex >= 0 ? Math.min(currentIndex + 1, history.entries.length - 1) : 0;
          const nextId = history.entries[nextIndex].id;
          setSelectedHistoryId(nextId);
          showHistoryPreview(nextId);
          return;
        }

        if (event.key === "ArrowUp" && history.entries.length > 0) {
          event.preventDefault();
          const nextIndex = currentIndex >= 0 ? Math.max(currentIndex - 1, 0) : 0;
          const nextId = history.entries[nextIndex].id;
          setSelectedHistoryId(nextId);
          showHistoryPreview(nextId);
          return;
        }

        if (event.key === "Enter" && selectedHistoryId !== null) {
          event.preventDefault();
          await history.selectEntry(selectedHistoryId);
          return;
        }

      }

      if (activeTab === "templates") {
        const currentIndex = templates.templates.findIndex(
          (template) => template.id === selectedTemplateId,
        );

        if (event.key === "ArrowDown" && templates.templates.length > 0) {
          event.preventDefault();
          const nextIndex =
            currentIndex >= 0 ? Math.min(currentIndex + 1, templates.templates.length - 1) : 0;
          const nextId = templates.templates[nextIndex].id;
          setSelectedTemplateId(nextId);
          showTemplatePreview(nextId);
          return;
        }

        if (event.key === "ArrowUp" && templates.templates.length > 0) {
          event.preventDefault();
          const nextIndex = currentIndex >= 0 ? Math.max(currentIndex - 1, 0) : 0;
          const nextId = templates.templates[nextIndex].id;
          setSelectedTemplateId(nextId);
          showTemplatePreview(nextId);
          return;
        }

        if (event.key === "Enter" && selectedTemplateId !== null) {
          event.preventDefault();
          await templates.pasteTemplate(selectedTemplateId);
          return;
        }

      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      void unlistenPopupPromise.then((unlisten) => unlisten());
      void unlistenTabPromise.then((unlisten) => unlisten());
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    activeTab,
    hidePopup,
    i18n.language,
    locked,
    needsSetup,
    settings.settings.rememberLastTab,
    history.entries,
    history.refresh,
    history.selectEntry,
    selectedHistoryId,
    selectedTemplateId,
    showHistoryPreview,
    showTemplatePreview,
    templates.pasteTemplate,
    templates.refresh,
    templates.templates,
  ]);

  // Focus loss is handled by Rust on_window_event (respects lock state).
  // No JS-side blur handler needed — it would bypass Rust's lock guard.

  useEffect(() => {
    const resizeWindow = async () => {
      if (!popupWindowRef.current) {
        return;
      }

      await popupWindowRef.current.setSize(new LogicalSize(COMPACT_WINDOW_WIDTH, WINDOW_HEIGHT));
    };

    void resizeWindow();
  }, []);

  if (needsSetup) {
    return (
      <div className="startup-fallback">
        <div className="startup-card">
          <h1>Clipor</h1>
          <p style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "8px" }}>
            {t("setup.description")}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSetupPassword();
            }}
            style={{ display: "flex", flexDirection: "column", gap: "6px" }}
          >
            <label>
              <span>{t("setup.label_new_password")}</span>
              <input
                type="password"
                value={setupPassword}
                onChange={(e) => setSetupPassword(e.target.value)}
                autoFocus
              />
            </label>
            <label>
              <span>{t("setup.label_confirm_password")}</span>
              <input
                type="password"
                value={setupConfirm}
                onChange={(e) => setSetupConfirm(e.target.value)}
              />
            </label>
            {setupError ? (
              <p style={{ color: "var(--danger)", fontSize: "11px" }}>{setupError}</p>
            ) : null}
            <button type="submit">{t("setup.button_set_and_start")}</button>
            <button
              type="button"
              style={{ opacity: 0.7 }}
              onClick={() => {
                setNeedsSetup(false);
                settings.skipSetup();
              }}
            >
              {t("setup.button_skip")}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (locked) {
    return (
      <div className="startup-fallback">
        <div className="startup-card">
          <h1>Clipor</h1>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleUnlock();
            }}
            style={{ display: "flex", flexDirection: "column", gap: "6px" }}
          >
            <label>
              <span>{t("unlock.label_password")}</span>
              <input
                type="password"
                value={lockPassword}
                onChange={(e) => setLockPassword(e.target.value)}
                autoFocus
              />
            </label>
            {lockError ? (
              <p style={{ color: "var(--danger)", fontSize: "11px" }}>{lockError}</p>
            ) : null}
            <button type="submit">{t("unlock.button_unlock")}</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <PopupWindow
      activeTab={activeTab}
      error={error}
      history={{
        entries: history.entries,
        loading: history.loading,
        page: history.page,
        total: history.total,
        totalPages: history.totalPages,
        search: history.search,
        selectedEntryId: selectedHistoryId,
        setSearch: history.setSearch,
        setSelectedEntryId: setSelectedHistoryId,
        previousPage: history.previousPage,
        nextPage: history.nextPage,
        selectEntry: history.selectEntry,
        pasteEntry: history.selectEntry,
        updateEntry: history.updateEntry,
        togglePinned: history.togglePinned,
        deleteEntry: history.deleteEntry,
        setClipboardFormatted: history.setClipboardFormatted,
        setClipboardConverted: history.setClipboardConverted,
      }}
      onSelectTab={setActiveTab}
      onDismissError={() => setError(null)}
      onRegisterAsTemplate={(entry) => {
        const isImage = entry.contentType === "image";
        const title = isImage
          ? t("content.image_placeholder")
          : entry.text.replace(/\r?\n/g, " ").slice(0, 30);
        templates.saveTemplate({
          title,
          text: isImage ? t("content.image_placeholder") : entry.text,
          contentType: entry.contentType,
          imageData: entry.imageData ?? undefined,
          newGroupName: t("template.group_name_from_history"),
        });
        setActiveTab("templates");
      }}
      settings={{ ...settings, refresh: () => void settings.refresh() }}
      templates={{
        ...templates,
        selectedTemplateId,
        setSelectedTemplate: (template) => setSelectedTemplateId(template.id),
      }}
    />
  );
}

export default App;
