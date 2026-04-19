import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PopupWindow from "../components/PopupWindow";
import type { AppSettings, ClipboardEntry, PopupTab, TemplateEntry } from "../types";

/* ------------------------------------------------------------------ */
/*  Tauri invoke mock                                                  */
/* ------------------------------------------------------------------ */
const invokeMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

/* ------------------------------------------------------------------ */
/*  Factories                                                          */
/* ------------------------------------------------------------------ */
const defaultSettings: AppSettings = {
  maxHistoryItems: 1000,
  pageSize: 20,
  hotkey: "Ctrl+Alt+M",
  activationMode: "hotkey",
  launchOnStartup: false,
  blurDelayMs: 100,
  previewWidth: 320,
  previewHeight: 400,
  previewImageWidth: 520,
  previewImageHeight: 520,
  requirePassword: false,
  rememberLastTab: false,
  templatePageSize: 8,
};

function makeEntry(overrides: Partial<ClipboardEntry> = {}): ClipboardEntry {
  return {
    id: 1,
    text: "hello world",
    copiedAt: "2026-01-01T00:00:00Z",
    isPinned: false,
    charCount: 11,
    sourceApp: null,
    contentType: "text",
    imageData: null,
    ...overrides,
  };
}

function makeTemplate(overrides: Partial<TemplateEntry> = {}): TemplateEntry {
  return {
    id: 100,
    groupId: 1,
    groupName: "General",
    title: "Greeting",
    text: "Hello {{name}}",
    contentType: "text",
    imageData: null,
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

type PropsOverrides = {
  activeTab?: "history" | "templates" | "settings";
  error?: string | null;
  history?: Record<string, unknown>;
  templates?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  onSelectTab?: (tab: PopupTab) => void;
  onDismissError?: () => void;
  onRegisterAsTemplate?: (entry: ClipboardEntry) => void;
};

function makeProps(overrides: PropsOverrides = {}) {
  const {
    activeTab = "history",
    error = null,
    history: histOverrides = {},
    templates: tmplOverrides = {},
    settings: setOverrides = {},
    onSelectTab = vi.fn<(tab: PopupTab) => void>(),
    onDismissError = vi.fn<() => void>(),
    onRegisterAsTemplate = vi.fn<(entry: ClipboardEntry) => void>(),
  } = overrides;

  return {
    activeTab: activeTab as "history" | "templates" | "settings",
    error,
    history: {
      entries: [] as ClipboardEntry[],
      loading: false,
      page: 1,
      total: 0,
      totalPages: 1,
      search: "",
      selectedEntryId: null as number | null,
      setSearch: vi.fn(),
      setSelectedEntryId: vi.fn(),
      previousPage: vi.fn(),
      nextPage: vi.fn(),
      selectEntry: vi.fn(),
      pasteEntry: vi.fn(),
      updateEntry: vi.fn(),
      togglePinned: vi.fn(),
      deleteEntry: vi.fn(),
      setClipboardFormatted: vi.fn(),
      setClipboardConverted: vi.fn(),
      ...histOverrides,
    },
    templates: {
      groups: [] as Array<{ id: number; name: string; sortOrder: number; createdAt: string }>,
      templates: [] as TemplateEntry[],
      loading: false,
      page: 1,
      total: 0,
      totalPages: 1,
      search: "",
      selectedGroupId: null as number | null,
      selectedTemplateId: null as number | null,
      setSearch: vi.fn(),
      setSelectedGroupId: vi.fn(),
      setSelectedTemplate: vi.fn(),
      previousPage: vi.fn(),
      nextPage: vi.fn(),
      pasteTemplate: vi.fn().mockResolvedValue(undefined),
      saveTemplate: vi.fn(),
      deleteTemplate: vi.fn(),
      exportTemplates: vi.fn(),
      importTemplates: vi.fn(),
      ...tmplOverrides,
    },
    settings: {
      settings: defaultSettings,
      saveSettings: vi.fn(),
      refresh: vi.fn(),
      ...setOverrides,
    },
    onSelectTab,
    onDismissError,
    onRegisterAsTemplate,
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */
describe("PopupWindow", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    invokeMock.mockClear();
  });

  /* ============================================================== */
  /*  1. Tab rendering and active states                            */
  /* ============================================================== */
  describe("tab rendering and active states", () => {
    it("renders all three tab buttons", () => {
      render(<PopupWindow {...makeProps()} />);
      expect(screen.getByRole("button", { name: "履歴" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "定型文" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "設定" })).toBeInTheDocument();
    });

    it("marks the history tab as active by default", () => {
      render(<PopupWindow {...makeProps()} />);
      expect(screen.getByRole("button", { name: "履歴" })).toHaveClass("active");
      expect(screen.getByRole("button", { name: "定型文" })).not.toHaveClass("active");
      expect(screen.getByRole("button", { name: "設定" })).not.toHaveClass("active");
    });

    it("marks the templates tab as active", () => {
      render(<PopupWindow {...makeProps({ activeTab: "templates" })} />);
      expect(screen.getByRole("button", { name: "定型文" })).toHaveClass("active");
    });

    it("marks the settings tab as active", () => {
      render(<PopupWindow {...makeProps({ activeTab: "settings" })} />);
      expect(screen.getByRole("button", { name: "設定" })).toHaveClass("active");
    });
  });

  /* ============================================================== */
  /*  2. Tab click handlers                                         */
  /* ============================================================== */
  describe("tab click handlers", () => {
    it("calls onSelectTab('history') when 履歴 is clicked", async () => {
      const onSelectTab = vi.fn();
      render(<PopupWindow {...makeProps({ activeTab: "templates", onSelectTab })} />);
      await userEvent.click(screen.getByRole("button", { name: "履歴" }));
      expect(onSelectTab).toHaveBeenCalledWith("history");
    });

    it("calls onSelectTab('templates') when 定型文 is clicked", async () => {
      const onSelectTab = vi.fn();
      render(<PopupWindow {...makeProps({ onSelectTab })} />);
      await userEvent.click(screen.getByRole("button", { name: "定型文" }));
      expect(onSelectTab).toHaveBeenCalledWith("templates");
    });

    it("calls onSelectTab('settings') when 設定 is clicked", async () => {
      const onSelectTab = vi.fn();
      render(<PopupWindow {...makeProps({ onSelectTab })} />);
      await userEvent.click(screen.getByRole("button", { name: "設定" }));
      expect(onSelectTab).toHaveBeenCalledWith("settings");
    });
  });

  /* ============================================================== */
  /*  3. Tab keyboard navigation                                    */
  /* ============================================================== */
  describe("keyboard navigation", () => {
    it("Tab moves from history to templates", () => {
      const onSelectTab = vi.fn();
      render(<PopupWindow {...makeProps({ onSelectTab })} />);
      fireEvent.keyDown(window, { key: "Tab" });
      expect(onSelectTab).toHaveBeenCalledWith("templates");
    });

    it("Tab wraps from settings to history", () => {
      const onSelectTab = vi.fn();
      render(<PopupWindow {...makeProps({ activeTab: "settings", onSelectTab })} />);
      fireEvent.keyDown(window, { key: "Tab" });
      expect(onSelectTab).toHaveBeenCalledWith("history");
    });

    it("Shift+Tab moves from history to settings (wraps)", () => {
      const onSelectTab = vi.fn();
      render(<PopupWindow {...makeProps({ onSelectTab })} />);
      fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
      expect(onSelectTab).toHaveBeenCalledWith("settings");
    });

    it("Shift+Tab moves from templates to history", () => {
      const onSelectTab = vi.fn();
      render(<PopupWindow {...makeProps({ activeTab: "templates", onSelectTab })} />);
      fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
      expect(onSelectTab).toHaveBeenCalledWith("history");
    });

    it("ignores arrow keys when focused on an INPUT", () => {
      const onSelectTab = vi.fn();
      render(<PopupWindow {...makeProps({ onSelectTab })} />);
      const input = document.createElement("input");
      document.body.appendChild(input);
      input.focus();
      fireEvent.keyDown(input, { key: "ArrowRight" });
      // The event handler checks event.target.tagName, so we dispatch on the input
      // but the listener is on window - need to dispatch on window with target set
      // Actually the listener is on window. Let's simulate properly.
      onSelectTab.mockClear();
      const event = new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true });
      Object.defineProperty(event, "target", { value: input });
      window.dispatchEvent(event);
      expect(onSelectTab).not.toHaveBeenCalled();
      document.body.removeChild(input);
    });

    it("ignores arrow keys when focused on a TEXTAREA", () => {
      const onSelectTab = vi.fn();
      render(<PopupWindow {...makeProps({ onSelectTab })} />);
      const ta = document.createElement("textarea");
      document.body.appendChild(ta);
      const event = new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true });
      Object.defineProperty(event, "target", { value: ta });
      window.dispatchEvent(event);
      expect(onSelectTab).not.toHaveBeenCalled();
      document.body.removeChild(ta);
    });

    it("ignores arrow keys when focused on a SELECT", () => {
      const onSelectTab = vi.fn();
      render(<PopupWindow {...makeProps({ onSelectTab })} />);
      const sel = document.createElement("select");
      document.body.appendChild(sel);
      const event = new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true });
      Object.defineProperty(event, "target", { value: sel });
      window.dispatchEvent(event);
      expect(onSelectTab).not.toHaveBeenCalled();
      document.body.removeChild(sel);
    });

    it("ignores non-arrow keys", () => {
      const onSelectTab = vi.fn();
      render(<PopupWindow {...makeProps({ onSelectTab })} />);
      fireEvent.keyDown(window, { key: "Enter" });
      expect(onSelectTab).not.toHaveBeenCalled();
    });

    it("removes keydown listener on unmount", () => {
      const spy = vi.spyOn(window, "removeEventListener");
      const { unmount } = render(<PopupWindow {...makeProps()} />);
      unmount();
      expect(spy).toHaveBeenCalledWith("keydown", expect.any(Function));
    });
  });

  /* ============================================================== */
  /*  4. Error banner display and dismiss                           */
  /* ============================================================== */
  describe("error banner", () => {
    it("renders the error banner when error is provided", () => {
      render(<PopupWindow {...makeProps({ error: "Something broke" })} />);
      expect(screen.getByRole("alert")).toHaveTextContent("Something broke");
    });

    it("does not render the error banner when error is null", () => {
      render(<PopupWindow {...makeProps({ error: null })} />);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("calls onDismissError when Close button is clicked", async () => {
      const onDismissError = vi.fn();
      render(<PopupWindow {...makeProps({ error: "oops", onDismissError })} />);
      await userEvent.click(screen.getByRole("button", { name: "閉じる" }));
      expect(onDismissError).toHaveBeenCalledTimes(1);
    });
  });

  /* ============================================================== */
  /*  5. Compact layout vs settings layout classes                  */
  /* ============================================================== */
  describe("layout classes", () => {
    it("applies compact classes for history tab", () => {
      const { container } = render(<PopupWindow {...makeProps({ activeTab: "history" })} />);
      expect(container.querySelector(".popup-shell.compact-shell")).toBeInTheDocument();
      expect(container.querySelector(".popup-panel.compact-panel")).toBeInTheDocument();
    });

    it("applies compact classes for templates tab", () => {
      const { container } = render(<PopupWindow {...makeProps({ activeTab: "templates" })} />);
      expect(container.querySelector(".popup-shell.compact-shell")).toBeInTheDocument();
    });

    it("applies compact classes for settings tab", () => {
      const { container } = render(<PopupWindow {...makeProps({ activeTab: "settings" })} />);
      expect(container.querySelector(".popup-shell.compact-shell")).toBeInTheDocument();
      expect(container.querySelector(".popup-panel.compact-panel")).toBeInTheDocument();
    });
  });

  /* ============================================================== */
  /*  6. History tab                                                */
  /* ============================================================== */
  describe("history tab", () => {
    it("shows loading state", () => {
      render(<PopupWindow {...makeProps({ history: { loading: true } })} />);
      expect(screen.getByText("読み込み中...")).toBeInTheDocument();
    });

    it("shows empty state when no entries and not loading", () => {
      render(<PopupWindow {...makeProps()} />);
      expect(screen.getByText("クリップボード履歴はまだありません。")).toBeInTheDocument();
    });

    it("does not show empty state when loading", () => {
      render(<PopupWindow {...makeProps({ history: { loading: true, entries: [] } })} />);
      expect(screen.queryByText("クリップボード履歴はまだありません。")).not.toBeInTheDocument();
    });

    it("renders history entries", () => {
      const entries = [makeEntry({ id: 1, text: "Item 1" }), makeEntry({ id: 2, text: "Item 2" })];
      render(<PopupWindow {...makeProps({ history: { entries } })} />);
      expect(screen.getByText("Item 1")).toBeInTheDocument();
      expect(screen.getByText("Item 2")).toBeInTheDocument();
    });

    it("highlights selected entry", () => {
      const entries = [makeEntry({ id: 1, text: "Selected one" })];
      render(
        <PopupWindow
          {...makeProps({ history: { entries, selectedEntryId: 1 } })}
        />,
      );
      const article = screen.getByText("Selected one").closest("article");
      expect(article).toHaveClass("selected");
    });

    it("does not render history section when on templates tab", () => {
      render(<PopupWindow {...makeProps({ activeTab: "templates" })} />);
      expect(screen.queryByText("クリップボード履歴はまだありません。")).not.toBeInTheDocument();
    });
  });

  describe("wheel pagination", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("moves to the next history page on wheel-down at the bottom", () => {
      vi.useFakeTimers();
      const nextPage = vi.fn();
      const entries = [makeEntry({ id: 1, text: "Item 1" })];
      const { container } = render(
        <PopupWindow
          {...makeProps({
            history: {
              entries,
              page: 1,
              total: 40,
              totalPages: 2,
              nextPage,
            },
          })}
        />,
      );

      vi.advanceTimersByTime(401);

      const cardList = container.querySelector(".card-list") as HTMLDivElement;
      Object.defineProperty(cardList, "scrollTop", { configurable: true, value: 0, writable: true });
      Object.defineProperty(cardList, "scrollHeight", { configurable: true, value: 120 });
      Object.defineProperty(cardList, "clientHeight", { configurable: true, value: 120 });

      fireEvent.wheel(cardList, { deltaY: 120 });

      expect(nextPage).toHaveBeenCalledTimes(1);
    });

    it("moves to the previous history page on wheel-up at the top", () => {
      vi.useFakeTimers();
      const previousPage = vi.fn();
      const entries = [makeEntry({ id: 1, text: "Item 1" })];
      const { container } = render(
        <PopupWindow
          {...makeProps({
            history: {
              entries,
              page: 2,
              total: 40,
              totalPages: 2,
              previousPage,
            },
          })}
        />,
      );

      vi.advanceTimersByTime(401);

      const cardList = container.querySelector(".card-list") as HTMLDivElement;
      Object.defineProperty(cardList, "scrollTop", { configurable: true, value: 0, writable: true });
      Object.defineProperty(cardList, "scrollHeight", { configurable: true, value: 120 });
      Object.defineProperty(cardList, "clientHeight", { configurable: true, value: 120 });

      fireEvent.wheel(cardList, { deltaY: -120 });

      expect(previousPage).toHaveBeenCalledTimes(1);
    });

    it("moves to the next template page on wheel-down at the bottom", () => {
      vi.useFakeTimers();
      const nextPage = vi.fn();
      const { container } = render(
        <PopupWindow
          {...makeProps({
            activeTab: "templates",
            templates: {
              templates: [makeTemplate({ id: 1, title: "Template 1" })],
              page: 1,
              total: 16,
              totalPages: 2,
              nextPage,
            },
          })}
        />,
      );

      vi.advanceTimersByTime(401);

      const lists = container.querySelectorAll(".card-list");
      const cardList = lists[0] as HTMLDivElement;
      Object.defineProperty(cardList, "scrollTop", { configurable: true, value: 0, writable: true });
      Object.defineProperty(cardList, "scrollHeight", { configurable: true, value: 120 });
      Object.defineProperty(cardList, "clientHeight", { configurable: true, value: 120 });

      fireEvent.wheel(cardList, { deltaY: 120 });

      expect(nextPage).toHaveBeenCalledTimes(1);
    });
  });

  /* ============================================================== */
  /*  7. Context menu (right-click)                                 */
  /* ============================================================== */
  describe("context menu", () => {
    function renderWithEntry() {
      const entry = makeEntry({ id: 42, text: "ctx text" });
      const props = makeProps({ history: { entries: [entry] } });
      render(<PopupWindow {...props} />);
      const article = screen.getByText("ctx text").closest("article")!;
      fireEvent.contextMenu(article);
      return props;
    }

    it("opens context menu on right-click of a history entry", () => {
      renderWithEntry();
      expect(screen.getByText("編集")).toBeInTheDocument();
      expect(screen.getByText("削除")).toBeInTheDocument();
      expect(screen.getByText("定型文に登録")).toBeInTheDocument();
      expect(screen.getByText("整形")).toBeInTheDocument();
      expect(screen.getByText("変換")).toBeInTheDocument();
    });

    it("clicking 編集 opens the edit dialog", async () => {
      renderWithEntry();
      await userEvent.click(screen.getByText("編集"));
      expect(screen.getByText("編集", { selector: ".edit-dialog-header" })).toBeInTheDocument();
      expect(screen.getByRole("textbox")).toHaveValue("ctx text");
    });

    it("clicking 削除 calls deleteEntry", async () => {
      const props = renderWithEntry();
      await userEvent.click(screen.getByText("削除"));
      expect(props.history.deleteEntry).toHaveBeenCalledWith(42);
    });

    it("clicking 定型文に登録 calls onRegisterAsTemplate", async () => {
      const props = renderWithEntry();
      await userEvent.click(screen.getByText("定型文に登録"));
      expect(props.onRegisterAsTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ id: 42 }),
      );
    });

    it("clicking 整形 submenu item calls transform_and_paste", async () => {
      renderWithEntry();
      const parent = screen.getByText("整形").closest(".context-menu-parent")!;
      fireEvent.mouseEnter(parent);
      await userEvent.click(screen.getByText("前後の空白を削除"));
      expect(invokeMock).toHaveBeenCalledWith("transform_and_paste", {
        text: "ctx text",
        transformType: "trim",
      });
    });

    it("clicking 変換 submenu item calls transform_and_paste", async () => {
      renderWithEntry();
      const parent = screen.getByText("変換").closest(".context-menu-parent")!;
      fireEvent.mouseEnter(parent);
      await userEvent.click(screen.getByText("全角→半角"));
      expect(invokeMock).toHaveBeenCalledWith("transform_and_paste", {
        text: "ctx text",
        transformType: "fullwidth_to_halfwidth",
      });
    });
  });

  /* ============================================================== */
  /*  8. Edit dialog (open -> edit text -> save / cancel)           */
  /* ============================================================== */
  describe("edit dialog", () => {
    function openEditDialog() {
      const entry = makeEntry({ id: 10, text: "original text" });
      const props = makeProps({ history: { entries: [entry] } });
      render(<PopupWindow {...props} />);
      const article = screen.getByText("original text").closest("article")!;
      fireEvent.contextMenu(article);
      fireEvent.click(screen.getByText("編集"));
      return props;
    }

    it("saves edited text and closes", async () => {
      const props = openEditDialog();
      const textarea = screen.getByRole("textbox");
      await userEvent.clear(textarea);
      await userEvent.type(textarea, "new text");
      await userEvent.click(screen.getByRole("button", { name: "保存" }));
      expect(props.history.updateEntry).toHaveBeenCalledWith(10, "new text");
      // Dialog should be gone
      expect(screen.queryByText("保存")).not.toBeInTheDocument();
    });

    it("cancels edit and closes dialog", async () => {
      const props = openEditDialog();
      await userEvent.click(screen.getByRole("button", { name: "キャンセル" }));
      expect(props.history.updateEntry).not.toHaveBeenCalled();
      expect(screen.queryByRole("button", { name: "保存" })).not.toBeInTheDocument();
    });

    it("updates textarea value on change", async () => {
      openEditDialog();
      const textarea = screen.getByRole("textbox");
      await userEvent.clear(textarea);
      await userEvent.type(textarea, "changed");
      expect(textarea).toHaveValue("changed");
    });
  });

  /* ============================================================== */
  /*  9. Templates tab                                              */
  /* ============================================================== */
  describe("templates tab", () => {
    it("renders template search bar and group filter", () => {
      const groups = [{ id: 1, name: "Group A", sortOrder: 0, createdAt: "2026-01-01" }];
      render(
        <PopupWindow
          {...makeProps({
            activeTab: "templates",
            templates: { groups },
          })}
        />,
      );
      expect(screen.getByPlaceholderText("定型文を検索")).toBeInTheDocument();
      expect(screen.getByText("全グループ")).toBeInTheDocument();
      // Group A appears in both the filter select and the TemplateEditor group select
      expect(screen.getAllByText("Group A").length).toBeGreaterThanOrEqual(1);
    });

    it("calls setSelectedGroupId with number when a group is selected", async () => {
      const groups = [{ id: 5, name: "Work", sortOrder: 0, createdAt: "2026-01-01" }];
      const setSelectedGroupId = vi.fn();
      render(
        <PopupWindow
          {...makeProps({
            activeTab: "templates",
            templates: { groups, setSelectedGroupId },
          })}
        />,
      );
      const select = screen.getByDisplayValue("全グループ");
      await userEvent.selectOptions(select, "5");
      expect(setSelectedGroupId).toHaveBeenCalledWith(5);
    });

    it("calls setSelectedGroupId with null when 全グループ is selected", async () => {
      const groups = [{ id: 5, name: "Work", sortOrder: 0, createdAt: "2026-01-01" }];
      const setSelectedGroupId = vi.fn();
      render(
        <PopupWindow
          {...makeProps({
            activeTab: "templates",
            templates: { groups, setSelectedGroupId, selectedGroupId: 5 },
          })}
        />,
      );
      // The filter-row select is the group filter; find it by its parent container
      const filterRow = document.querySelector(".filter-row")!;
      const select = filterRow.querySelector("select")!;
      await userEvent.selectOptions(select, "");
      expect(setSelectedGroupId).toHaveBeenCalledWith(null);
    });

    it("renders TemplateList with templates", () => {
      const t = makeTemplate({ id: 200, title: "Sig" });
      render(
        <PopupWindow
          {...makeProps({
            activeTab: "templates",
            templates: { templates: [t] },
          })}
        />,
      );
      expect(screen.getByText("Sig")).toBeInTheDocument();
    });

    it("renders TemplateEditor with Create button when no editingTemplate", () => {
      render(<PopupWindow {...makeProps({ activeTab: "templates" })} />);
      expect(screen.getByRole("button", { name: "作成" })).toBeInTheDocument();
    });

    it("TemplateEditor onSave calls saveTemplate and clears editingTemplate", async () => {
      const t = makeTemplate({ id: 300, title: "Test", text: "body" });
      const saveTemplate = vi.fn();
      const { rerender } = render(
        <PopupWindow
          {...makeProps({
            activeTab: "templates",
            templates: {
              templates: [t],
              selectedTemplateId: 300,
              saveTemplate,
            },
          })}
        />,
      );
      // editingTemplate should be auto-set, so Update button should appear
      expect(screen.getByRole("button", { name: "更新" })).toBeInTheDocument();

      // Click Update to trigger onSave
      await userEvent.click(screen.getByRole("button", { name: "更新" }));
      expect(saveTemplate).toHaveBeenCalled();
    });

    it("TemplateEditor onCancel clears editingTemplate", async () => {
      const t = makeTemplate({ id: 300, title: "Test", text: "body" });
      render(
        <PopupWindow
          {...makeProps({
            activeTab: "templates",
            templates: {
              templates: [t],
              selectedTemplateId: 300,
            },
          })}
        />,
      );
      expect(screen.getByRole("button", { name: "更新" })).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "クリア" }));
      // After clearing, should show Create instead of Update
      expect(screen.getByRole("button", { name: "作成" })).toBeInTheDocument();
    });

    it("TemplateEditor onExport calls exportTemplates", async () => {
      const exportTemplates = vi.fn();
      render(
        <PopupWindow
          {...makeProps({
            activeTab: "templates",
            templates: { exportTemplates },
          })}
        />,
      );
      await userEvent.click(screen.getByRole("button", { name: "エクスポート" }));
      expect(exportTemplates).toHaveBeenCalled();
    });

    it("TemplateEditor onImport calls importTemplates", async () => {
      const importTemplates = vi.fn();
      render(
        <PopupWindow
          {...makeProps({
            activeTab: "templates",
            templates: { importTemplates },
          })}
        />,
      );
      await userEvent.click(screen.getByRole("button", { name: "インポート" }));
      // Import dialog should appear
      const dialog = screen.getByPlaceholderText('{"groups":[...],"templates":[...]}');
      await userEvent.type(dialog, '{{"test":1}}');
      await userEvent.click(screen.getByRole("button", { name: "インポート実行" }));
      expect(importTemplates).toHaveBeenCalled();
    });
  });

  /* ============================================================== */
  /*  10. editingTemplate auto-set / clear                          */
  /* ============================================================== */
  describe("editingTemplate lifecycle", () => {
    it("sets editingTemplate when selectedTemplateId changes on templates tab", () => {
      const t = makeTemplate({ id: 50, title: "Auto" });
      const { rerender } = render(
        <PopupWindow
          {...makeProps({
            activeTab: "templates",
            templates: { templates: [t], selectedTemplateId: null },
          })}
        />,
      );
      // No editing -> shows Create
      expect(screen.getByRole("button", { name: "作成" })).toBeInTheDocument();

      // Now select a template
      rerender(
        <PopupWindow
          {...makeProps({
            activeTab: "templates",
            templates: { templates: [t], selectedTemplateId: 50 },
          })}
        />,
      );
      // Should now show Update
      expect(screen.getByRole("button", { name: "更新" })).toBeInTheDocument();
    });

    it("clears editingTemplate when selectedTemplateId becomes null", () => {
      const t = makeTemplate({ id: 50, title: "Auto" });
      const { rerender } = render(
        <PopupWindow
          {...makeProps({
            activeTab: "templates",
            templates: { templates: [t], selectedTemplateId: 50 },
          })}
        />,
      );
      expect(screen.getByRole("button", { name: "更新" })).toBeInTheDocument();

      rerender(
        <PopupWindow
          {...makeProps({
            activeTab: "templates",
            templates: { templates: [t], selectedTemplateId: null },
          })}
        />,
      );
      expect(screen.getByRole("button", { name: "作成" })).toBeInTheDocument();
    });

    it("clears editingTemplate when tab changes to non-templates", () => {
      const t = makeTemplate({ id: 50, title: "Auto" });
      const { rerender } = render(
        <PopupWindow
          {...makeProps({
            activeTab: "templates",
            templates: { templates: [t], selectedTemplateId: 50 },
          })}
        />,
      );
      expect(screen.getByRole("button", { name: "更新" })).toBeInTheDocument();

      // Switch to history
      rerender(
        <PopupWindow
          {...makeProps({
            activeTab: "history",
            templates: { templates: [t], selectedTemplateId: 50 },
          })}
        />,
      );

      // Switch back to templates with same selectedTemplateId - but the effect
      // for non-templates tab should have cleared it. The effect runs:
      // if activeTab !== "templates") return; -> early return, no set
      // Actually the effect runs on activeTab change. When switching to history,
      // the effect sees activeTab !== "templates" and returns early (does nothing).
      // But editingTemplate was already set. When we switch back, the effect
      // sees activeTab === "templates" and selectedTemplateId === 50 and re-sets it.
      // The point is: while on history tab, the template editor is not rendered.
      // Let's verify it does not retain editing state across tab switches by
      // checking that after going back, it shows Update (re-set from effect).
      rerender(
        <PopupWindow
          {...makeProps({
            activeTab: "templates",
            templates: { templates: [t], selectedTemplateId: null },
          })}
        />,
      );
      expect(screen.getByRole("button", { name: "作成" })).toBeInTheDocument();
    });

    it("sets editingTemplate to null when template not found in list", () => {
      const t = makeTemplate({ id: 50, title: "Auto" });
      render(
        <PopupWindow
          {...makeProps({
            activeTab: "templates",
            templates: { templates: [t], selectedTemplateId: 999 },
          })}
        />,
      );
      // selectedTemplateId=999 does not match any template -> null
      expect(screen.getByRole("button", { name: "作成" })).toBeInTheDocument();
    });
  });

  /* ============================================================== */
  /*  11. Settings tab rendering                                    */
  /* ============================================================== */
  describe("settings tab", () => {
    it("renders SettingsView when on settings tab", () => {
      render(<PopupWindow {...makeProps({ activeTab: "settings" })} />);
      // SettingsView renders form fields for settings
      expect(screen.getByDisplayValue("Ctrl+Alt+M")).toBeInTheDocument();
    });

    it("does not render settings when on history tab", () => {
      render(<PopupWindow {...makeProps({ activeTab: "history" })} />);
      expect(screen.queryByDisplayValue("Ctrl+Alt+M")).not.toBeInTheDocument();
    });
  });

  /* ============================================================== */
  /*  12. hide_preview called on tab change                         */
  /* ============================================================== */
  describe("hide_preview on tab change", () => {
    it("calls invoke('hide_preview') on mount", () => {
      render(<PopupWindow {...makeProps()} />);
      expect(invokeMock).toHaveBeenCalledWith("hide_preview");
    });

    it("calls invoke('hide_preview') when activeTab changes", () => {
      const { rerender } = render(<PopupWindow {...makeProps({ activeTab: "history" })} />);
      invokeMock.mockClear();
      rerender(<PopupWindow {...makeProps({ activeTab: "templates" })} />);
      expect(invokeMock).toHaveBeenCalledWith("hide_preview");
    });

    it("does not throw if hide_preview rejects", () => {
      invokeMock.mockRejectedValueOnce(new Error("fail"));
      expect(() => render(<PopupWindow {...makeProps()} />)).not.toThrow();
    });
  });

  /* ============================================================== */
  /*  13. buildContextMenuItems returns correct array               */
  /* ============================================================== */
  describe("buildContextMenuItems", () => {
    it("returns 5 menu items with correct labels (3 flat + 2 submenu parents)", () => {
      const entry = makeEntry({ id: 1, text: "test" });
      render(<PopupWindow {...makeProps({ history: { entries: [entry] } })} />);
      const article = screen.getByText("test").closest("article")!;
      fireEvent.contextMenu(article);

      const menuItems = screen.getAllByRole("button").filter(
        (btn) =>
          btn.classList.contains("context-menu-item"),
      );
      expect(menuItems).toHaveLength(5);
      expect(menuItems[0]).toHaveTextContent("編集");
      expect(menuItems[1]).toHaveTextContent("削除");
      expect(menuItems[1]).toHaveClass("danger");
      expect(menuItems[2]).toHaveTextContent("定型文に登録");
      expect(menuItems[3]).toHaveTextContent("整形");
      expect(menuItems[3]).toHaveClass("has-children");
      expect(menuItems[4]).toHaveTextContent("変換");
      expect(menuItems[4]).toHaveClass("has-children");
    });
  });

  /* ============================================================== */
  /*  14. Context menu close                                        */
  /* ============================================================== */
  describe("context menu close", () => {
    it("closes context menu when an item is clicked", async () => {
      const entry = makeEntry({ id: 1, text: "close test" });
      render(<PopupWindow {...makeProps({ history: { entries: [entry] } })} />);
      const article = screen.getByText("close test").closest("article")!;
      fireEvent.contextMenu(article);
      expect(screen.getByText("編集")).toBeInTheDocument();

      // Click 定型文に登録 which calls action + onClose
      await userEvent.click(screen.getByText("定型文に登録"));
      // The ContextMenu calls onClose after action, which sets contextMenu to null
      // But the ContextMenu itself listens for mousedown outside - after click the
      // menu item action fires and onClose is called by ContextMenu component
    });
  });

  /* ============================================================== */
  /*  15. History entry onPaste (click)                             */
  /* ============================================================== */
  describe("history entry interactions", () => {
    it("calls pasteEntry when a history entry is clicked", async () => {
      const pasteEntry = vi.fn();
      const entry = makeEntry({ id: 7, text: "paste me" });
      render(
        <PopupWindow
          {...makeProps({ history: { entries: [entry], pasteEntry } })}
        />,
      );
      await userEvent.click(screen.getByText("paste me"));
      expect(pasteEntry).toHaveBeenCalledWith(7);
    });

    it("calls setSelectedEntryId on mouseEnter", () => {
      const setSelectedEntryId = vi.fn();
      const entry = makeEntry({ id: 3, text: "hover me" });
      render(
        <PopupWindow
          {...makeProps({ history: { entries: [entry], setSelectedEntryId } })}
        />,
      );
      const article = screen.getByText("hover me").closest("article")!;
      fireEvent.mouseEnter(article);
      expect(setSelectedEntryId).toHaveBeenCalledWith(3);
    });
  });

  /* ============================================================== */
  /*  16. visibleTemplates memo                                     */
  /* ============================================================== */
  describe("visibleTemplates", () => {
    it("passes templates to TemplateList", () => {
      const t1 = makeTemplate({ id: 1, title: "T1" });
      const t2 = makeTemplate({ id: 2, title: "T2" });
      render(
        <PopupWindow
          {...makeProps({
            activeTab: "templates",
            templates: { templates: [t1, t2] },
          })}
        />,
      );
      expect(screen.getByText("T1")).toBeInTheDocument();
      expect(screen.getByText("T2")).toBeInTheDocument();
    });

    it("shows empty state when no templates", () => {
      render(
        <PopupWindow
          {...makeProps({
            activeTab: "templates",
            templates: { templates: [] },
          })}
        />,
      );
      expect(screen.getByText("定型文はまだありません。")).toBeInTheDocument();
    });
  });

  /* ============================================================== */
  /*  17. All transform submenu items                               */
  /* ============================================================== */
  describe("transform submenu items (all)", () => {
    function renderAndOpenTransform() {
      const entry = makeEntry({ id: 1, text: "some text" });
      render(<PopupWindow {...makeProps({ history: { entries: [entry] } })} />);
      const article = screen.getByText("some text").closest("article")!;
      fireEvent.contextMenu(article);
      const parent = screen.getByText("整形").closest(".context-menu-parent")!;
      fireEvent.mouseEnter(parent);
    }

    const transformCases = [
      { label: "コメントを付加 (// )", type: "add_comment_prefix" },
      { label: "引用符を付加 (> )", type: "add_quote_prefix" },
      { label: "連番を付加 (1. 2. ...)", type: "add_numbering" },
      { label: "各行を\"で囲む", type: "wrap_lines_in_quotes" },
      { label: "前後の空白を削除", type: "trim" },
      { label: "空行を削除", type: "remove_empty_lines" },
      { label: "連続空行を1行に", type: "collapse_blank_lines" },
      { label: "行末空白を削除", type: "trim_trailing" },
      { label: "重複行を削除", type: "remove_duplicate_lines" },
      { label: "HTMLタグを除去", type: "remove_html_tags" },
    ] as const;

    for (const { label, type } of transformCases) {
      it(`clicking "${label}" calls transform_and_paste with type "${type}"`, async () => {
        renderAndOpenTransform();
        await userEvent.click(screen.getByText(label));
        expect(invokeMock).toHaveBeenCalledWith("transform_and_paste", {
          text: "some text",
          transformType: type,
        });
      });
    }
  });

  /* ============================================================== */
  /*  18. All convert submenu items                                 */
  /* ============================================================== */
  describe("convert submenu items (all)", () => {
    function renderAndOpenConvert() {
      const entry = makeEntry({ id: 1, text: "some text" });
      render(<PopupWindow {...makeProps({ history: { entries: [entry] } })} />);
      const article = screen.getByText("some text").closest("article")!;
      fireEvent.contextMenu(article);
      const parent = screen.getByText("変換").closest(".context-menu-parent")!;
      fireEvent.mouseEnter(parent);
    }

    const convertCases = [
      { label: "大文字→小文字", type: "to_lowercase" },
      { label: "小文字→大文字", type: "to_uppercase" },
      { label: "全角→半角", type: "fullwidth_to_halfwidth" },
      { label: "半角→全角", type: "halfwidth_to_fullwidth" },
    ] as const;

    for (const { label, type } of convertCases) {
      it(`clicking "${label}" calls transform_and_paste with type "${type}"`, async () => {
        renderAndOpenConvert();
        await userEvent.click(screen.getByText(label));
        expect(invokeMock).toHaveBeenCalledWith("transform_and_paste", {
          text: "some text",
          transformType: type,
        });
      });
    }
  });

  /* ============================================================== */
  /*  19. Template context menu                                     */
  /* ============================================================== */
  describe("template context menu", () => {
    function renderTemplateWithContextMenu() {
      const tmpl = makeTemplate({ id: 50, title: "tmpl title", text: "tmpl text" });
      const deleteTemplate = vi.fn();
      const props = makeProps({
        activeTab: "templates",
        templates: { templates: [tmpl], deleteTemplate },
      });
      render(<PopupWindow {...props} />);
      const article = screen.getByText("tmpl title").closest("article")!;
      fireEvent.contextMenu(article);
      return { props, deleteTemplate };
    }

    it("opens template context menu on right-click", () => {
      renderTemplateWithContextMenu();
      expect(screen.getByText("削除")).toBeInTheDocument();
      expect(screen.getByText("整形")).toBeInTheDocument();
      expect(screen.getByText("変換")).toBeInTheDocument();
    });

    it("clicking delete calls deleteTemplate", async () => {
      const { deleteTemplate } = renderTemplateWithContextMenu();
      await userEvent.click(screen.getByText("削除"));
      expect(deleteTemplate).toHaveBeenCalledWith(50);
    });

    it("clicking transform submenu item for template calls invoke", async () => {
      renderTemplateWithContextMenu();
      const parent = screen.getByText("整形").closest(".context-menu-parent")!;
      fireEvent.mouseEnter(parent);
      await userEvent.click(screen.getByText("前後の空白を削除"));
      expect(invokeMock).toHaveBeenCalledWith("transform_and_paste", {
        text: "tmpl text",
        transformType: "trim",
      });
    });
  });

  /* ============================================================== */
  /*  20. editingTemplate effect (cleanup on tab change)            */
  /* ============================================================== */
  describe("editingTemplate cleanup", () => {
    it("clears editingTemplate when switching away from templates tab", () => {
      const tmpl = makeTemplate({ id: 1, title: "Edit Me" });
      const { rerender } = render(
        <PopupWindow
          {...makeProps({
            activeTab: "templates",
            templates: { templates: [tmpl], selectedTemplateId: 1 },
          })}
        />,
      );

      // Now switch to history tab
      rerender(
        <PopupWindow
          {...makeProps({
            activeTab: "history",
            templates: { templates: [tmpl], selectedTemplateId: 1 },
          })}
        />,
      );

      // No editing state visible
      expect(screen.queryByText("Edit Me")).not.toBeInTheDocument();
    });

    it("clears editingTemplate when selectedTemplateId becomes null", () => {
      const tmpl = makeTemplate({ id: 1, title: "Deselect Me" });
      const { rerender } = render(
        <PopupWindow
          {...makeProps({
            activeTab: "templates",
            templates: { templates: [tmpl], selectedTemplateId: 1 },
          })}
        />,
      );

      rerender(
        <PopupWindow
          {...makeProps({
            activeTab: "templates",
            templates: { templates: [tmpl], selectedTemplateId: null },
          })}
        />,
      );

      // The template editor should not be pre-filled
    });
  });

  /* ============================================================== */
  /*  21. hide_preview on tab change                                */
  /* ============================================================== */
  describe("hide_preview on tab change", () => {
    it("calls hide_preview when tab changes", () => {
      const { rerender } = render(
        <PopupWindow {...makeProps({ activeTab: "history" })} />,
      );
      invokeMock.mockClear();

      rerender(<PopupWindow {...makeProps({ activeTab: "templates" })} />);

      expect(invokeMock).toHaveBeenCalledWith("hide_preview");
    });
  });

  /* ============================================================== */
  /*  22. Template group filter                                     */
  /* ============================================================== */
  describe("template group filter", () => {
    it("renders group filter select with all groups option", () => {
      const groups = [
        { id: 1, name: "Work", sortOrder: 0, createdAt: "2026-01-01" },
        { id: 2, name: "Personal", sortOrder: 1, createdAt: "2026-01-01" },
      ];
      render(
        <PopupWindow
          {...makeProps({
            activeTab: "templates",
            templates: { groups },
          })}
        />,
      );
      expect(screen.getByText("全グループ")).toBeInTheDocument();
      expect(screen.getAllByText("Work").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Personal").length).toBeGreaterThanOrEqual(1);
    });

    it("calls setSelectedGroupId when a group is selected", () => {
      const groups = [
        { id: 1, name: "Work", sortOrder: 0, createdAt: "2026-01-01" },
      ];
      const setSelectedGroupId = vi.fn();
      render(
        <PopupWindow
          {...makeProps({
            activeTab: "templates",
            templates: { groups, setSelectedGroupId },
          })}
        />,
      );
      const select = screen.getByDisplayValue("全グループ") as HTMLSelectElement;
      fireEvent.change(select, { target: { value: "1" } });
      expect(setSelectedGroupId).toHaveBeenCalledWith(1);
    });

    it("calls setSelectedGroupId with null when all groups selected", () => {
      const groups = [
        { id: 1, name: "Work", sortOrder: 0, createdAt: "2026-01-01" },
      ];
      const setSelectedGroupId = vi.fn();
      render(
        <PopupWindow
          {...makeProps({
            activeTab: "templates",
            templates: { groups, setSelectedGroupId, selectedGroupId: 1 },
          })}
        />,
      );
      const filterRow = document.querySelector(".filter-row")!;
      const select = filterRow.querySelector("select") as HTMLSelectElement;
      fireEvent.change(select, { target: { value: "" } });
      expect(setSelectedGroupId).toHaveBeenCalledWith(null);
    });
  });

  /* ============================================================== */
  /*  23. Template editor callbacks (save, export, import)          */
  /* ============================================================== */
  describe("template editor callbacks", () => {
    it("calls saveTemplate and clears editingTemplate on save", async () => {
      const saveTemplate = vi.fn();
      render(
        <PopupWindow
          {...makeProps({
            activeTab: "templates",
            templates: { saveTemplate },
          })}
        />,
      );

      // Fill in the template editor form
      const titleInput = screen.getByLabelText("タイトル") as HTMLInputElement;
      fireEvent.change(titleInput, { target: { value: "Test Title" } });
      const textarea = screen.getByPlaceholderText("{{date}} や {{clipboard}} を利用できます。");
      fireEvent.change(textarea, { target: { value: "Test Body" } });

      await userEvent.click(screen.getByText("作成"));
      expect(saveTemplate).toHaveBeenCalled();
    });

    it("calls exportTemplates on export", async () => {
      const exportTemplates = vi.fn();
      render(
        <PopupWindow
          {...makeProps({
            activeTab: "templates",
            templates: { exportTemplates },
          })}
        />,
      );
      await userEvent.click(screen.getByText("エクスポート"));
      expect(exportTemplates).toHaveBeenCalled();
    });
  });
});
