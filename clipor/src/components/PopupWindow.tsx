import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import ClipboardItem from "./ClipboardItem";
import ContextMenu from "./ContextMenu";
import type { MenuItem } from "./ContextMenu";
import Pagination from "./Pagination";
import SearchBar from "./SearchBar";
import SettingsView from "./SettingsView";
import TemplateEditor from "./TemplateEditor";
import TemplateList from "./TemplateList";
import type { AppSettings, ClipboardEntry, PopupTab, TemplateEntry } from "../types";

interface PopupWindowProps {
  activeTab: PopupTab;
  error: string | null;
  history: {
    entries: Array<{
      id: number;
      text: string;
      copiedAt: string;
      isPinned: boolean;
      charCount: number;
      sourceApp?: string | null;
      contentType: string;
      imageData?: string | null;
    }>;
    loading: boolean;
    page: number;
    total: number;
    totalPages: number;
    search: string;
    selectedEntryId: number | null;
    setSearch: (value: string) => void;
    setSelectedEntryId: (value: number) => void;
    previousPage: () => void;
    nextPage: () => void;
    selectEntry: (id: number) => void;
    pasteEntry: (id: number) => void;
    updateEntry: (id: number, text: string) => void;
    togglePinned: (entry: ClipboardEntry) => void;
    deleteEntry: (id: number) => void;
    setClipboardFormatted: (id: number) => void;
    setClipboardConverted: (id: number) => void;
  };
  templates: {
    groups: Array<{ id: number; name: string; sortOrder: number; createdAt: string }>;
    templates: TemplateEntry[];
    search: string;
    selectedGroupId: number | null;
    selectedTemplateId: number | null;
    setSearch: (value: string) => void;
    setSelectedGroupId: (value: number | null) => void;
    setSelectedTemplate: (template: TemplateEntry) => void;
    pasteTemplate: (id: number) => Promise<void>;
    saveTemplate: (payload: {
      id?: number;
      title: string;
      text: string;
      contentType?: string;
      imageData?: string | null;
      groupId?: number;
      newGroupName?: string;
    }) => void;
    deleteTemplate: (id: number) => void;
    exportTemplates: () => void;
    importTemplates: (json: string) => void;
  };
  settings: {
    settings: AppSettings;
    saveSettings: (settings: AppSettings) => void;
    refresh: () => void;
  };
  onSelectTab: (tab: PopupTab) => void;
  onDismissError: () => void;
  onRegisterAsTemplate: (entry: ClipboardEntry) => void;
}

function PopupWindow({
  activeTab,
  error,
  history,
  templates,
  settings,
  onSelectTab,
  onDismissError,
  onRegisterAsTemplate,
}: PopupWindowProps) {
  const [editingTemplate, setEditingTemplate] = useState<TemplateEntry | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: ClipboardEntry } | null>(null);
  const [templateContextMenu, setTemplateContextMenu] = useState<{ x: number; y: number; template: TemplateEntry } | null>(null);
  const [editingEntry, setEditingEntry] = useState<ClipboardEntry | null>(null);
  const [editText, setEditText] = useState("");
  const visibleTemplates = useMemo(() => templates.templates, [templates.templates]);
  const isCompactLayout = activeTab === "history" || activeTab === "templates";

  const tabs: PopupTab[] = ["history", "templates", "settings"];

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const currentIndex = tabs.indexOf(activeTab);
        const nextIndex =
          event.key === "ArrowRight"
            ? (currentIndex + 1) % tabs.length
            : (currentIndex - 1 + tabs.length) % tabs.length;
        onSelectTab(tabs[nextIndex]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, onSelectTab]);

  const handleContextMenu = useCallback((event: React.MouseEvent, entry: ClipboardEntry) => {
    setContextMenu({ x: event.clientX, y: event.clientY, entry });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleTemplateContextMenu = useCallback((event: React.MouseEvent, template: TemplateEntry) => {
    setTemplateContextMenu({ x: event.clientX, y: event.clientY, template });
  }, []);

  const closeTemplateContextMenu = useCallback(() => {
    setTemplateContextMenu(null);
  }, []);

  const buildTemplateContextMenuItems = useCallback(
    (template: TemplateEntry): MenuItem[] => [
      {
        label: "削除",
        action: () => void templates.deleteTemplate(template.id),
        danger: true,
      },
      {
        label: "クリップボードにセット(整形)",
        action: () => void invoke("set_clipboard_text_formatted", { text: template.text }),
      },
      {
        label: "クリップボードにセット(変換)",
        action: () => void invoke("set_clipboard_text_converted", { text: template.text }),
      },
    ],
    [templates],
  );

  const buildContextMenuItems = useCallback(
    (entry: ClipboardEntry): MenuItem[] => [
      {
        label: "編集",
        action: () => {
          setEditingEntry(entry);
          setEditText(entry.text);
        },
      },
      {
        label: "削除",
        action: () => void history.deleteEntry(entry.id),
        danger: true,
      },
      {
        label: "定型文に登録",
        action: () => onRegisterAsTemplate(entry),
      },
      {
        label: "クリップボードにセット(整形)",
        action: () => void history.setClipboardFormatted(entry.id),
      },
      {
        label: "クリップボードにセット(変換)",
        action: () => void history.setClipboardConverted(entry.id),
      },
    ],
    [history, onRegisterAsTemplate],
  );

  useEffect(() => {
    if (activeTab !== "templates") {
      return;
    }

    if (templates.selectedTemplateId === null) {
      setEditingTemplate(null);
      return;
    }

    setEditingTemplate(
      templates.templates.find((template) => template.id === templates.selectedTemplateId) ?? null,
    );
  }, [activeTab, templates.selectedTemplateId, templates.templates]);

  useEffect(() => {
    invoke("hide_preview").catch(() => {});
  }, [activeTab]);

  return (
    <main className={`popup-shell${isCompactLayout ? " compact-shell" : ""}`}>
      <div className="popup-backdrop" />
      <section className={`popup-panel${isCompactLayout ? " compact-panel" : ""}`}>
        <header className="panel-header">
          <nav className="tab-row" aria-label="Popup tabs">
            <button
              type="button"
              className={activeTab === "history" ? "active" : ""}
              onClick={() => onSelectTab("history")}
            >
              履歴
            </button>
            <button
              type="button"
              className={activeTab === "templates" ? "active" : ""}
              onClick={() => onSelectTab("templates")}
            >
              定型文
            </button>
            <button
              type="button"
              className={activeTab === "settings" ? "active" : ""}
              onClick={() => onSelectTab("settings")}
            >
              設定
            </button>
          </nav>
        </header>

        {error ? (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button type="button" onClick={onDismissError}>
              Close
            </button>
          </div>
        ) : null}

        {activeTab === "history" ? (
          <section className="tab-panel">
            <div className="tab-fixed-header">
              <SearchBar
                value={history.search}
                placeholder="履歴を検索"
                onChange={history.setSearch}
              />
              <Pagination
                page={history.page}
                totalItems={history.total}
                totalPages={history.totalPages}
                onNext={history.nextPage}
                onPrevious={history.previousPage}
              />
            </div>
            {history.loading ? <div className="empty-state">Loading...</div> : null}
            <div className="card-list">
              {history.entries.map((entry) => (
                <ClipboardItem
                  key={entry.id}
                  entry={entry}
                  isSelected={history.selectedEntryId === entry.id}
                  onSelect={history.setSelectedEntryId}
                  onPaste={history.pasteEntry}
                  onContextMenu={handleContextMenu}
                />
              ))}
              {!history.loading && history.entries.length === 0 ? (
                <div className="empty-state">クリップボード履歴はまだありません。</div>
              ) : null}
            </div>

            {contextMenu ? (
              <ContextMenu
                x={contextMenu.x}
                y={contextMenu.y}
                onClose={closeContextMenu}
                items={buildContextMenuItems(contextMenu.entry)}
              />
            ) : null}

            {editingEntry ? (
              <div className="edit-overlay">
                <div className="edit-dialog">
                  <div className="edit-dialog-header">編集</div>
                  <textarea
                    value={editText}
                    onChange={(event) => setEditText(event.target.value)}
                    rows={6}
                  />
                  <div className="edit-dialog-actions">
                    <button
                      type="button"
                      onClick={() => {
                        void history.updateEntry(editingEntry.id, editText);
                        setEditingEntry(null);
                      }}
                    >
                      保存
                    </button>
                    <button type="button" onClick={() => setEditingEntry(null)}>
                      キャンセル
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {activeTab === "templates" ? (
          <section className="tab-panel">
            <div className="tab-fixed-header">
              <SearchBar
                value={templates.search}
                placeholder="定型文を検索"
                onChange={templates.setSearch}
              />
              <div className="filter-row">
                <select
                  value={templates.selectedGroupId ?? ""}
                  onChange={(event) =>
                    templates.setSelectedGroupId(
                      event.target.value ? Number(event.target.value) : null,
                    )
                  }
                >
                  <option value="">全グループ</option>
                  {templates.groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="card-list">
              <TemplateList
                templates={visibleTemplates}
                selectedTemplateId={templates.selectedTemplateId}
                onSelect={templates.setSelectedTemplate}
                onPaste={templates.pasteTemplate}
                onContextMenu={handleTemplateContextMenu}
              />
            </div>

            {templateContextMenu ? (
              <ContextMenu
                x={templateContextMenu.x}
                y={templateContextMenu.y}
                onClose={closeTemplateContextMenu}
                items={buildTemplateContextMenuItems(templateContextMenu.template)}
              />
            ) : null}
            <TemplateEditor
              groups={templates.groups}
              editingTemplate={editingTemplate}
              onCancel={() => setEditingTemplate(null)}
              onSave={(payload) => {
                templates.saveTemplate(payload);
                setEditingTemplate(null);
              }}
              onExport={() => {
                void templates.exportTemplates();
              }}
              onImport={(json) => {
                void templates.importTemplates(json);
              }}
            />
          </section>
        ) : null}

        {activeTab === "settings" ? (
          <section className="tab-panel">
            <SettingsView
              settings={settings.settings}
              onSave={settings.saveSettings}
              onPasswordChanged={settings.refresh}
            />
          </section>
        ) : null}

      </section>
    </main>
  );
}

export default PopupWindow;
