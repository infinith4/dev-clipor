import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
    loading: boolean;
    page: number;
    total: number;
    totalPages: number;
    search: string;
    selectedGroupId: number | null;
    selectedTemplateId: number | null;
    setSearch: (value: string) => void;
    setSelectedGroupId: (value: number | null) => void;
    setSelectedTemplate: (template: TemplateEntry) => void;
    previousPage: () => void;
    nextPage: () => void;
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
    saveSettings: (settings: AppSettings) => Promise<void>;
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
  const { t } = useTranslation();
  const [editingTemplate, setEditingTemplate] = useState<TemplateEntry | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: ClipboardEntry } | null>(null);
  const [templateContextMenu, setTemplateContextMenu] = useState<{ x: number; y: number; template: TemplateEntry } | null>(null);
  const [editingEntry, setEditingEntry] = useState<ClipboardEntry | null>(null);
  const [editText, setEditText] = useState("");
  const visibleTemplates = useMemo(() => templates.templates, [templates.templates]);
  const isCompactLayout = true;

  // Refs for scroll-based page navigation — history
  const cardListRef = useRef<HTMLDivElement>(null);
  const navCooldownRef = useRef(false);
  const prevHistScrollRef = useRef(0);
  // Refs for scroll-based page navigation — templates
  const cardListTemplateRef = useRef<HTMLDivElement>(null);
  const navCooldownTemplateRef = useRef(false);
  const prevTemplScrollRef = useRef(0);

  const tabs: PopupTab[] = ["history", "templates", "settings"];

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (event.key === "Tab") {
        event.preventDefault();
        const currentIndex = tabs.indexOf(activeTab);
        const nextIndex = event.shiftKey
          ? (currentIndex - 1 + tabs.length) % tabs.length
          : (currentIndex + 1) % tabs.length;
        onSelectTab(tabs[nextIndex]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, onSelectTab]);

  // Scroll list to top whenever entries change (after any page navigation)
  useEffect(() => {
    // Activate cooldown immediately so sentinels don't fire before the user can see the page
    navCooldownRef.current = true;
    if (cardListRef.current) {
      cardListRef.current.scrollTop = 0;
    }
    // Release cooldown after the new page's entries have rendered
    const timer = setTimeout(() => {
      navCooldownRef.current = false;
    }, 400);
    return () => clearTimeout(timer);
  }, [history.entries]);

  // Scroll event: bottom → next page, top (scrolling up) → previous page — history
  useEffect(() => {
    if (activeTab !== "history") return;
    const cardList = cardListRef.current;
    if (!cardList) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = cardList;
      const prev = prevHistScrollRef.current;
      prevHistScrollRef.current = scrollTop;
      if (navCooldownRef.current || history.loading) return;
      if (scrollTop > prev && scrollHeight - scrollTop - clientHeight <= 1 && history.page < history.totalPages) {
        navCooldownRef.current = true;
        history.nextPage();
      } else if (scrollTop < prev && scrollTop === 0 && history.page > 1) {
        navCooldownRef.current = true;
        history.previousPage();
      }
    };
    cardList.addEventListener("scroll", handleScroll);
    return () => cardList.removeEventListener("scroll", handleScroll);
  }, [activeTab, history.loading, history.nextPage, history.page, history.previousPage, history.totalPages]);

  // Scroll templates list to top whenever template entries change
  useEffect(() => {
    navCooldownTemplateRef.current = true;
    if (cardListTemplateRef.current) {
      cardListTemplateRef.current.scrollTop = 0;
    }
    const timer = setTimeout(() => {
      navCooldownTemplateRef.current = false;
    }, 400);
    return () => clearTimeout(timer);
  }, [templates.templates]);

  // Scroll event: bottom → next page, top (scrolling up) → previous page — templates
  useEffect(() => {
    if (activeTab !== "templates") return;
    const cardList = cardListTemplateRef.current;
    if (!cardList) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = cardList;
      const prev = prevTemplScrollRef.current;
      prevTemplScrollRef.current = scrollTop;
      if (navCooldownTemplateRef.current || templates.loading) return;
      if (scrollTop > prev && scrollHeight - scrollTop - clientHeight <= 1 && templates.page < templates.totalPages) {
        navCooldownTemplateRef.current = true;
        templates.nextPage();
      } else if (scrollTop < prev && scrollTop === 0 && templates.page > 1) {
        navCooldownTemplateRef.current = true;
        templates.previousPage();
      }
    };
    cardList.addEventListener("scroll", handleScroll);
    return () => cardList.removeEventListener("scroll", handleScroll);
  }, [activeTab, templates.loading, templates.nextPage, templates.page, templates.previousPage, templates.totalPages]);

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

  const buildTransformMenus = useCallback(
    (text: string): MenuItem[] => [
      {
        label: t("context_menu.transform_label"),
        children: [
          { label: t("transform.add_comment_prefix"), action: () => void invoke("transform_and_paste", { text, transformType: "add_comment_prefix" }) },
          { label: t("transform.add_quote_prefix"), action: () => void invoke("transform_and_paste", { text, transformType: "add_quote_prefix" }) },
          { label: t("transform.add_numbering"), action: () => void invoke("transform_and_paste", { text, transformType: "add_numbering" }) },
          { label: t("transform.wrap_lines_in_quotes"), action: () => void invoke("transform_and_paste", { text, transformType: "wrap_lines_in_quotes" }) },
          { label: t("transform.trim"), action: () => void invoke("transform_and_paste", { text, transformType: "trim" }) },
          { label: t("transform.remove_empty_lines"), action: () => void invoke("transform_and_paste", { text, transformType: "remove_empty_lines" }) },
          { label: t("transform.collapse_blank_lines"), action: () => void invoke("transform_and_paste", { text, transformType: "collapse_blank_lines" }) },
          { label: t("transform.trim_trailing"), action: () => void invoke("transform_and_paste", { text, transformType: "trim_trailing" }) },
          { label: t("transform.remove_duplicate_lines"), action: () => void invoke("transform_and_paste", { text, transformType: "remove_duplicate_lines" }) },
          { label: t("transform.remove_html_tags"), action: () => void invoke("transform_and_paste", { text, transformType: "remove_html_tags" }) },
        ],
      },
      {
        label: t("context_menu.convert_label"),
        children: [
          { label: t("convert.to_lowercase"), action: () => void invoke("transform_and_paste", { text, transformType: "to_lowercase" }) },
          { label: t("convert.to_uppercase"), action: () => void invoke("transform_and_paste", { text, transformType: "to_uppercase" }) },
          { label: t("convert.fullwidth_to_halfwidth"), action: () => void invoke("transform_and_paste", { text, transformType: "fullwidth_to_halfwidth" }) },
          { label: t("convert.halfwidth_to_fullwidth"), action: () => void invoke("transform_and_paste", { text, transformType: "halfwidth_to_fullwidth" }) },
        ],
      },
    ],
    [t],
  );

  const buildTemplateContextMenuItems = useCallback(
    (template: TemplateEntry): MenuItem[] => [
      {
        label: t("context_menu.delete"),
        action: () => void templates.deleteTemplate(template.id),
        danger: true,
      },
      ...buildTransformMenus(template.text),
    ],
    [templates, buildTransformMenus],
  );

  const buildContextMenuItems = useCallback(
    (entry: ClipboardEntry): MenuItem[] => [
      {
        label: t("context_menu.edit"),
        action: () => {
          setEditingEntry(entry);
          setEditText(entry.text);
        },
      },
      {
        label: t("context_menu.delete"),
        action: () => void history.deleteEntry(entry.id),
        danger: true,
      },
      {
        label: t("context_menu.register_as_template"),
        action: () => onRegisterAsTemplate(entry),
      },
      ...buildTransformMenus(entry.text),
    ],
    [history, onRegisterAsTemplate, buildTransformMenus],
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
              {t("tab.history")}
            </button>
            <button
              type="button"
              className={activeTab === "templates" ? "active" : ""}
              onClick={() => onSelectTab("templates")}
            >
              {t("tab.templates")}
            </button>
            <button
              type="button"
              className={activeTab === "settings" ? "active" : ""}
              onClick={() => onSelectTab("settings")}
            >
              {t("tab.settings")}
            </button>
          </nav>
        </header>

        {error ? (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button type="button" onClick={onDismissError}>
              {t("error_banner.close_button")}
            </button>
          </div>
        ) : null}

        {activeTab === "history" ? (
          <section className="tab-panel">
            <div className="tab-fixed-header">
              <SearchBar
                value={history.search}
                placeholder={t("search.placeholder_history")}
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
            {history.loading ? <div className="empty-state">{t("loading.message")}</div> : null}
            <div className="card-list" ref={cardListRef}>
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
                <div className="empty-state">{t("empty_state.no_history")}</div>
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
                  <div className="edit-dialog-header">{t("edit_dialog.header")}</div>
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
                      {t("edit_dialog.button_save")}
                    </button>
                    <button type="button" onClick={() => setEditingEntry(null)}>
                      {t("edit_dialog.button_cancel")}
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
                placeholder={t("search.placeholder_templates")}
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
                  <option value="">{t("template_filter.all_groups")}</option>
                  {templates.groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>
              <Pagination
                page={templates.page}
                totalItems={templates.total}
                totalPages={templates.totalPages}
                onNext={templates.nextPage}
                onPrevious={templates.previousPage}
              />
            </div>
            {templates.loading ? <div className="empty-state">{t("loading.message")}</div> : null}
            <div className="card-list" ref={cardListTemplateRef}>
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
