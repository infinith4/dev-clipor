import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import type { Window } from "@tauri-apps/api/window";
import PopupWindow from "./components/PopupWindow";
import { useClipboardHistory } from "./hooks/useClipboardHistory";
import { useSettings } from "./hooks/useSettings";
import { useTemplates } from "./hooks/useTemplates";
import type { PopupTab } from "./types";

const COMPACT_WINDOW_WIDTH = 230;
const SETTINGS_WINDOW_WIDTH = 420;
const WINDOW_HEIGHT = 720;

function App() {
  const [activeTab, setActiveTab] = useState<PopupTab>("history");
  const [error, setError] = useState<string | null>(null);
  const [selectedHistoryId, setSelectedHistoryId] = useState<number | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const popupWindowRef = useRef<Window | null>(null);
  const settings = useSettings(setError);
  const history = useClipboardHistory(settings.settings.pageSize, setError);
  const templates = useTemplates(setError);

  useEffect(() => {
    try {
      popupWindowRef.current = getCurrentWindow();
    } catch (windowError) {
      setError(
        windowError instanceof Error
          ? windowError.message
          : "ウィンドウの初期化に失敗しました。",
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

  useEffect(() => {
    const unlistenPopupPromise = listen("hotkey://toggle-popup", async () => {
      await Promise.all([history.refresh(), templates.refresh()]);
      if (!popupWindowRef.current) {
        return;
      }
      await popupWindowRef.current.show();
      await popupWindowRef.current.setFocus();
    });
    const unlistenTabPromise = listen<string>("ui://select-tab", (event) => {
      if (event.payload === "history" || event.payload === "templates" || event.payload === "settings") {
        setActiveTab(event.payload);
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
        await popupWindowRef.current?.hide();
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
          setSelectedHistoryId(history.entries[nextIndex].id);
          return;
        }

        if (event.key === "ArrowUp" && history.entries.length > 0) {
          event.preventDefault();
          const nextIndex = currentIndex >= 0 ? Math.max(currentIndex - 1, 0) : 0;
          setSelectedHistoryId(history.entries[nextIndex].id);
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
          setSelectedTemplateId(templates.templates[nextIndex].id);
          return;
        }

        if (event.key === "ArrowUp" && templates.templates.length > 0) {
          event.preventDefault();
          const nextIndex = currentIndex >= 0 ? Math.max(currentIndex - 1, 0) : 0;
          setSelectedTemplateId(templates.templates[nextIndex].id);
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
    history.entries,
    history.refresh,
    history.selectEntry,
    selectedHistoryId,
    selectedTemplateId,
    templates.pasteTemplate,
    templates.refresh,
    templates.templates,
  ]);

  useEffect(() => {
    const resizeWindow = async () => {
      if (!popupWindowRef.current) {
        return;
      }

      const width = activeTab === "settings" ? SETTINGS_WINDOW_WIDTH : COMPACT_WINDOW_WIDTH;
      await popupWindowRef.current.setSize(new LogicalSize(width, WINDOW_HEIGHT));
      await popupWindowRef.current.center();
    };

    void resizeWindow();
  }, [activeTab]);

  return (
    <PopupWindow
      activeTab={activeTab}
      error={error}
      history={{
        ...history,
        selectedEntryId: selectedHistoryId,
        setSelectedEntryId: setSelectedHistoryId,
        pasteEntry: history.selectEntry,
        updateEntry: history.updateEntry,
        setClipboardFormatted: history.setClipboardFormatted,
        setClipboardConverted: history.setClipboardConverted,
      }}
      onSelectTab={setActiveTab}
      onDismissError={() => setError(null)}
      onRegisterAsTemplate={(entry) => {
        const title = entry.text.replace(/\r?\n/g, " ").slice(0, 30);
        templates.saveTemplate({ title, text: entry.text, newGroupName: "履歴から登録" });
        setActiveTab("templates");
      }}
      settings={settings}
      templates={{
        ...templates,
        selectedTemplateId,
        setSelectedTemplate: (template) => setSelectedTemplateId(template.id),
      }}
    />
  );
}

export default App;
