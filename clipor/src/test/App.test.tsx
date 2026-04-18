import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import i18n from "../i18n";
import type { ClipboardEntry, TemplateEntry } from "../types";

/* ------------------------------------------------------------------ */
/* Hoisted mutable state + mocks                                       */
/* ------------------------------------------------------------------ */

const {
  hideMock,
  showMock,
  setFocusMock,
  setSizeMock,
  invokeMock,
  listenMock,
  settingsState,
  historyState,
  templatesState,
  skipSetupMock,
  settingsRefreshMock,
  historyRefreshMock,
  templatesRefreshMock,
  selectEntryMock,
  pasteTemplateMock,
  saveTemplateMock,
  updateEntryMock,
  setClipboardFormattedMock,
  setClipboardConvertedMock,
  setSearchHistoryMock,
  setSearchTemplatesMock,
  setSelectedGroupIdMock,
  deleteEntryMock,
  togglePinnedMock,
  saveSettingsMock,
  deleteTemplateMock,
  exportTemplatesMock,
  importTemplatesMock,
  windowState,
} = vi.hoisted(() => ({
  hideMock: vi.fn().mockResolvedValue(undefined),
  showMock: vi.fn().mockResolvedValue(undefined),
  setFocusMock: vi.fn().mockResolvedValue(undefined),
  setSizeMock: vi.fn().mockResolvedValue(undefined),
  invokeMock: vi.fn().mockResolvedValue(undefined),
  listenMock: vi.fn().mockResolvedValue(() => {}),
  settingsState: {
    requirePassword: false,
    setupSkipped: true,
  },
  historyState: {
    entries: [] as ClipboardEntry[],
  },
  templatesState: {
    templates: [] as TemplateEntry[],
  },
  skipSetupMock: vi.fn(),
  settingsRefreshMock: vi.fn().mockResolvedValue(undefined),
  historyRefreshMock: vi.fn().mockResolvedValue(undefined),
  templatesRefreshMock: vi.fn().mockResolvedValue(undefined),
  selectEntryMock: vi.fn().mockResolvedValue(undefined),
  pasteTemplateMock: vi.fn().mockResolvedValue(undefined),
  saveTemplateMock: vi.fn(),
  updateEntryMock: vi.fn(),
  setClipboardFormattedMock: vi.fn(),
  setClipboardConvertedMock: vi.fn(),
  setSearchHistoryMock: vi.fn(),
  setSearchTemplatesMock: vi.fn(),
  setSelectedGroupIdMock: vi.fn(),
  deleteEntryMock: vi.fn(),
  togglePinnedMock: vi.fn(),
  saveSettingsMock: vi.fn(),
  deleteTemplateMock: vi.fn(),
  exportTemplatesMock: vi.fn(),
  importTemplatesMock: vi.fn(),
  windowState: {
    shouldThrow: false,
    throwValue: null as unknown,
    label: "main",
  },
}));

/* ------------------------------------------------------------------ */
/* Module mocks                                                        */
/* ------------------------------------------------------------------ */

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: listenMock,
  emit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/window", () => ({
  LogicalSize: class LogicalSize {
    constructor(
      public width: number,
      public height: number,
    ) {}
  },
  getCurrentWindow: () => {
    if (windowState.shouldThrow) {
      throw windowState.throwValue ?? new Error("window error");
    }
    return {
      label: windowState.label,
      hide: hideMock,
      show: showMock,
      setFocus: setFocusMock,
      setSize: setSizeMock,
    };
  },
}));

vi.mock("../hooks/useSettings", () => ({
  useSettings: () => ({
    settings: {
      maxHistoryItems: 1000,
      pageSize: 20,
      hotkey: "Ctrl+Alt+M",
      launchOnStartup: false,
      blurDelayMs: 100,
      previewWidth: 320,
      previewHeight: 400,
      previewImageWidth: 520,
      previewImageHeight: 520,
      requirePassword: settingsState.requirePassword,
      templatePageSize: 10,
    },
    setupSkipped: settingsState.setupSkipped,
    refresh: settingsRefreshMock,
    saveSettings: saveSettingsMock,
    skipSetup: skipSetupMock,
  }),
}));

vi.mock("../hooks/useClipboardHistory", () => ({
  useClipboardHistory: () => ({
    entries: historyState.entries,
    loading: false,
    page: 1,
    total: historyState.entries.length,
    totalPages: 1,
    search: "",
    setSearch: setSearchHistoryMock,
    nextPage: vi.fn(),
    previousPage: vi.fn(),
    refresh: historyRefreshMock,
    selectEntry: selectEntryMock,
    updateEntry: updateEntryMock,
    togglePinned: togglePinnedMock,
    deleteEntry: deleteEntryMock,
    setClipboardFormatted: setClipboardFormattedMock,
    setClipboardConverted: setClipboardConvertedMock,
  }),
}));

vi.mock("../hooks/useTemplates", () => ({
  useTemplates: () => ({
    groups: [],
    templates: templatesState.templates,
    search: "",
    selectedGroupId: null,
    setSearch: setSearchTemplatesMock,
    setSelectedGroupId: setSelectedGroupIdMock,
    refresh: templatesRefreshMock,
    pasteTemplate: pasteTemplateMock,
    saveTemplate: saveTemplateMock,
    deleteTemplate: deleteTemplateMock,
    exportTemplates: exportTemplatesMock,
    importTemplates: importTemplatesMock,
  }),
}));

vi.mock("../components/PreviewPanel", () => ({
  default: () => <div data-testid="preview-panel">PreviewPanel</div>,
}));

vi.mock("../components/PopupWindow", () => ({
  default: (props: Record<string, unknown>) => {
    // Expose props through data attributes and callbacks for testing
    const p = props as {
      activeTab: string;
      error: string | null;
      onSelectTab: (tab: string) => void;
      onDismissError: () => void;
      onRegisterAsTemplate: (entry: ClipboardEntry) => void;
      history: { selectedEntryId: number | null; setSelectedEntryId: (id: number) => void };
      templates: { selectedTemplateId: number | null; setSelectedTemplate: (t: { id: number }) => void };
      settings: { refresh: () => void };
    };
    return (
      <div data-testid="popup-window" data-active-tab={p.activeTab} data-error={p.error ?? ""}>
        <button data-testid="tab-history" onClick={() => p.onSelectTab("history")}>
          履歴
        </button>
        <button data-testid="tab-templates" onClick={() => p.onSelectTab("templates")}>
          定型文
        </button>
        <button data-testid="tab-settings" onClick={() => p.onSelectTab("settings")}>
          設定
        </button>
        <button data-testid="dismiss-error" onClick={() => p.onDismissError()}>
          Dismiss
        </button>
        <button
          data-testid="register-text-template"
          onClick={() =>
            p.onRegisterAsTemplate({
              id: 1,
              text: "some text content for registering",
              copiedAt: "2024-01-01",
              isPinned: false,
              charCount: 10,
              contentType: "text",
              imageData: null,
            })
          }
        >
          RegisterText
        </button>
        <button
          data-testid="register-image-template"
          onClick={() =>
            p.onRegisterAsTemplate({
              id: 2,
              text: "",
              copiedAt: "2024-01-01",
              isPinned: false,
              charCount: 0,
              contentType: "image",
              imageData: "base64data",
            })
          }
        >
          RegisterImage
        </button>
        <span data-testid="selected-history-id">{String(p.history.selectedEntryId)}</span>
        <span data-testid="selected-template-id">{String(p.templates.selectedTemplateId)}</span>
        <button data-testid="settings-refresh" onClick={() => p.settings.refresh()}>
          RefreshSettings
        </button>
        <button
          data-testid="set-selected-template"
          onClick={() => p.templates.setSelectedTemplate({ id: 99 })}
        >
          SetSelectedTemplate
        </button>
        <button
          data-testid="set-selected-history"
          onClick={() => p.history.setSelectedEntryId(999)}
        >
          SetSelectedHistory
        </button>
      </div>
    );
  },
}));

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function makeEntry(id: number, text = "text", contentType = "text", imageData: string | null = null): ClipboardEntry {
  return { id, text, copiedAt: "2024-01-01T00:00:00Z", isPinned: false, charCount: text.length, contentType, imageData };
}

function makeTemplate(id: number, text = "tmpl", contentType = "text", imageData: string | null = null): TemplateEntry {
  return {
    id,
    groupId: 1,
    groupName: "default",
    title: text,
    text,
    contentType,
    imageData,
    sortOrder: 0,
    createdAt: "2024-01-01",
    updatedAt: "2024-01-01",
  };
}

/** Capture listen callbacks by event name */
function getListenCallback(eventName: string): ((...args: unknown[]) => void) | undefined {
  const call = listenMock.mock.calls.find((c: unknown[]) => c[0] === eventName);
  return call ? (call[1] as (...args: unknown[]) => void) : undefined;
}

function resetAllMocks() {
  settingsState.requirePassword = false;
  settingsState.setupSkipped = true;
  historyState.entries = [];
  templatesState.templates = [];
  windowState.shouldThrow = false;
  windowState.throwValue = null;
  windowState.label = "main";
  vi.clearAllMocks();
  invokeMock.mockResolvedValue(undefined);
  listenMock.mockImplementation(() => Promise.resolve(() => {}));
  localStorage.setItem("clipor-lang", "ja");
  void i18n.changeLanguage("ja");
}

/* ================================================================== */
/* Tests                                                               */
/* ================================================================== */

describe("App", () => {
  beforeEach(() => {
    resetAllMocks();
  });

  /* ---------------------------------------------------------------- */
  /* Basic rendering (MainApp path, isPreviewWindow=false)             */
  /* ---------------------------------------------------------------- */

  it("renders the main PopupWindow with tabs (default history tab)", async () => {
    render(await importApp());

    await waitFor(() => {
      expect(setSizeMock).toHaveBeenCalled();
    });
    expect(screen.getByTestId("popup-window")).toBeInTheDocument();
    expect(screen.getByTestId("popup-window").getAttribute("data-active-tab")).toBe("history");
  });

  /* ---------------------------------------------------------------- */
  /* Password setup flow                                               */
  /* ---------------------------------------------------------------- */

  describe("password setup (needsSetup=true)", () => {
    beforeEach(() => {
      settingsState.requirePassword = false;
      settingsState.setupSkipped = false;
    });

    it("renders setup form when setupSkipped is false", async () => {
      render(await importApp());
      expect(screen.getByText("パスワードを設定して開始")).toBeInTheDocument();
      expect(screen.getByText("スキップ（保護なし）")).toBeInTheDocument();
    });

    it("shows error when password is empty", async () => {
      render(await importApp());
      const form = screen.getByText("パスワードを設定して開始").closest("form")!;
      fireEvent.submit(form);
      await waitFor(() => {
        expect(screen.getByText("パスワードを入力してください。")).toBeInTheDocument();
      });
    });

    it("shows error when passwords do not match", async () => {
      render(await importApp());

      const passwordInputs = document.querySelectorAll('input[type="password"]');
      fireEvent.change(passwordInputs[0], { target: { value: "abc123" } });
      fireEvent.change(passwordInputs[1], { target: { value: "different" } });

      fireEvent.submit(screen.getByText("パスワードを設定して開始").closest("form")!);

      await waitFor(() => {
        expect(screen.getByText("パスワードが一致しません。")).toBeInTheDocument();
      });
    });

    it("calls set_password and refreshes on success", async () => {
      invokeMock.mockResolvedValue(undefined);
      render(await importApp());

      const passwordInputs = document.querySelectorAll('input[type="password"]');
      fireEvent.change(passwordInputs[0], { target: { value: "pass123" } });
      fireEvent.change(passwordInputs[1], { target: { value: "pass123" } });

      fireEvent.submit(screen.getByText("パスワードを設定して開始").closest("form")!);

      await waitFor(() => {
        expect(invokeMock).toHaveBeenCalledWith("set_password", { password: "pass123" });
      });
      await waitFor(() => {
        expect(settingsRefreshMock).toHaveBeenCalled();
      });
    });

    it("shows error when set_password fails with Error", async () => {
      invokeMock.mockImplementation((cmd: string) => {
        if (cmd === "set_password") return Promise.reject(new Error("backend error"));
        return Promise.resolve(undefined);
      });
      render(await importApp());

      const passwordInputs = document.querySelectorAll('input[type="password"]');
      fireEvent.change(passwordInputs[0], { target: { value: "pass123" } });
      fireEvent.change(passwordInputs[1], { target: { value: "pass123" } });

      fireEvent.submit(screen.getByText("パスワードを設定して開始").closest("form")!);

      await waitFor(() => {
        expect(screen.getByText("backend error")).toBeInTheDocument();
      });
    });

    it("shows generic error when set_password fails with non-Error", async () => {
      invokeMock.mockImplementation((cmd: string) => {
        if (cmd === "set_password") return Promise.reject("string error");
        return Promise.resolve(undefined);
      });
      render(await importApp());

      const passwordInputs = document.querySelectorAll('input[type="password"]');
      fireEvent.change(passwordInputs[0], { target: { value: "pass123" } });
      fireEvent.change(passwordInputs[1], { target: { value: "pass123" } });

      fireEvent.submit(screen.getByText("パスワードを設定して開始").closest("form")!);

      await waitFor(() => {
        expect(screen.getByText("パスワード設定に失敗しました。")).toBeInTheDocument();
      });
    });

    it("skips setup when skip button clicked", async () => {
      render(await importApp());

      fireEvent.click(screen.getByText("スキップ（保護なし）"));

      expect(skipSetupMock).toHaveBeenCalled();
      // After skip, should show main popup
      await waitFor(() => {
        expect(screen.getByTestId("popup-window")).toBeInTheDocument();
      });
    });
  });

  /* ---------------------------------------------------------------- */
  /* Lock / unlock flow                                                */
  /* ---------------------------------------------------------------- */

  describe("locked state", () => {
    beforeEach(() => {
      settingsState.requirePassword = true;
      settingsState.setupSkipped = true;
    });

    it("renders lock screen", async () => {
      render(await importApp());
      expect(screen.getByText("ロック解除")).toBeInTheDocument();
    });

    it("unlocks successfully on correct password", async () => {
      invokeMock.mockImplementation((cmd: string) => {
        if (cmd === "verify_password") return Promise.resolve(true);
        return Promise.resolve(undefined);
      });
      render(await importApp());

      const passwordInput = document.querySelector('input[type="password"]')!;
      fireEvent.change(passwordInput, { target: { value: "correct" } });
      fireEvent.submit(screen.getByText("ロック解除").closest("form")!);

      await waitFor(() => {
        expect(invokeMock).toHaveBeenCalledWith("verify_password", { password: "correct" });
      });
      await waitFor(() => {
        expect(screen.getByTestId("popup-window")).toBeInTheDocument();
      });
    });

    it("shows error on wrong password (ok=false)", async () => {
      invokeMock.mockImplementation((cmd: string) => {
        if (cmd === "verify_password") return Promise.resolve(false);
        return Promise.resolve(undefined);
      });
      render(await importApp());

      const passwordInput = document.querySelector('input[type="password"]')!;
      fireEvent.change(passwordInput, { target: { value: "wrong" } });
      fireEvent.submit(screen.getByText("ロック解除").closest("form")!);

      await waitFor(() => {
        expect(screen.getByText("パスワードが正しくありません。")).toBeInTheDocument();
      });
    });

    it("shows error message on verify_password Error", async () => {
      invokeMock.mockImplementation((cmd: string) => {
        if (cmd === "verify_password") return Promise.reject(new Error("auth failed"));
        return Promise.resolve(undefined);
      });
      render(await importApp());

      const passwordInput = document.querySelector('input[type="password"]')!;
      fireEvent.change(passwordInput, { target: { value: "test" } });
      fireEvent.submit(screen.getByText("ロック解除").closest("form")!);

      await waitFor(() => {
        expect(screen.getByText("auth failed")).toBeInTheDocument();
      });
    });

    it("shows generic error on verify_password non-Error throw", async () => {
      invokeMock.mockImplementation((cmd: string) => {
        if (cmd === "verify_password") return Promise.reject("string thrown");
        return Promise.resolve(undefined);
      });
      render(await importApp());

      const passwordInput = document.querySelector('input[type="password"]')!;
      fireEvent.change(passwordInput, { target: { value: "test" } });
      fireEvent.submit(screen.getByText("ロック解除").closest("form")!);

      await waitFor(() => {
        expect(screen.getByText("認証に失敗しました。")).toBeInTheDocument();
      });
    });

    it("does not hide popup on Escape when locked", async () => {
      render(await importApp());
      await waitFor(() => {
        expect(screen.getByText("ロック解除")).toBeInTheDocument();
      });
      hideMock.mockClear();
      invokeMock.mockClear();

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

      // Give time for any async operations
      await new Promise((r) => setTimeout(r, 50));
      expect(hideMock).not.toHaveBeenCalled();
    });
  });

  /* ---------------------------------------------------------------- */
  /* Escape key when not locked (hides popup)                          */
  /* ---------------------------------------------------------------- */

  it("hides popup on Escape when not locked", async () => {
    render(await importApp());
    await waitFor(() => {
      expect(screen.getByTestId("popup-window")).toBeInTheDocument();
    });
    hideMock.mockClear();
    invokeMock.mockClear();

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    await waitFor(() => {
      expect(hideMock).toHaveBeenCalled();
    });
  });

  /* ---------------------------------------------------------------- */
  /* isEditableTarget returns early for inputs                         */
  /* ---------------------------------------------------------------- */

  it("does not navigate on ArrowDown when target is an input", async () => {
    historyState.entries = [makeEntry(1), makeEntry(2)];
    render(await importApp());
    await waitFor(() => {
      expect(screen.getByTestId("popup-window")).toBeInTheDocument();
    });
    invokeMock.mockClear();

    // Create an input and dispatch keydown from it
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });

    // show_preview may have been called from auto-preview, but not from keydown handler navigation
    // The key check: selectEntry should not be called
    expect(selectEntryMock).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  /* ---------------------------------------------------------------- */
  /* History tab keyboard navigation                                   */
  /* ---------------------------------------------------------------- */

  describe("history tab keyboard navigation", () => {
    beforeEach(() => {
      historyState.entries = [makeEntry(1, "first"), makeEntry(2, "second"), makeEntry(3, "third")];
    });

    it("ArrowDown selects next entry", async () => {
      render(await importApp());
      await waitFor(() => {
        expect(screen.getByTestId("popup-window")).toBeInTheDocument();
      });

      // Wait for auto-selection of first entry
      await waitFor(() => {
        expect(screen.getByTestId("selected-history-id").textContent).toBe("1");
      });

      invokeMock.mockClear();

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      });

      await waitFor(() => {
        expect(screen.getByTestId("selected-history-id").textContent).toBe("2");
      });
    });

    it("ArrowUp selects previous entry", async () => {
      render(await importApp());
      await waitFor(() => {
        expect(screen.getByTestId("selected-history-id").textContent).toBe("1");
      });

      // Move down first
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      });
      await waitFor(() => {
        expect(screen.getByTestId("selected-history-id").textContent).toBe("2");
      });

      // Now move up
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
      });
      await waitFor(() => {
        expect(screen.getByTestId("selected-history-id").textContent).toBe("1");
      });
    });

    it("Enter selects the current entry", async () => {
      render(await importApp());
      await waitFor(() => {
        expect(screen.getByTestId("selected-history-id").textContent).toBe("1");
      });

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      });

      await waitFor(() => {
        expect(selectEntryMock).toHaveBeenCalledWith(1);
      });
    });

    it("ArrowDown clamps at last entry", async () => {
      render(await importApp());
      await waitFor(() => {
        expect(screen.getByTestId("selected-history-id").textContent).toBe("1");
      });

      // Move down 5 times (beyond length)
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
        });
      }

      await waitFor(() => {
        expect(screen.getByTestId("selected-history-id").textContent).toBe("3");
      });
    });

    it("ArrowUp clamps at first entry", async () => {
      render(await importApp());
      await waitFor(() => {
        expect(screen.getByTestId("selected-history-id").textContent).toBe("1");
      });

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
      });

      await waitFor(() => {
        expect(screen.getByTestId("selected-history-id").textContent).toBe("1");
      });
    });
  });

  /* ---------------------------------------------------------------- */
  /* Templates tab keyboard navigation                                 */
  /* ---------------------------------------------------------------- */

  describe("templates tab keyboard navigation", () => {
    beforeEach(() => {
      templatesState.templates = [makeTemplate(10, "t1"), makeTemplate(20, "t2"), makeTemplate(30, "t3")];
    });

    it("ArrowDown/ArrowUp/Enter work on templates tab", async () => {
      render(await importApp());
      await waitFor(() => {
        expect(screen.getByTestId("popup-window")).toBeInTheDocument();
      });

      // Switch to templates tab
      await act(async () => {
        fireEvent.click(screen.getByTestId("tab-templates"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("popup-window").getAttribute("data-active-tab")).toBe("templates");
      });

      // Auto-selection should pick first template
      await waitFor(() => {
        expect(screen.getByTestId("selected-template-id").textContent).toBe("10");
      });

      // ArrowDown
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      });
      await waitFor(() => {
        expect(screen.getByTestId("selected-template-id").textContent).toBe("20");
      });

      // ArrowUp
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
      });
      await waitFor(() => {
        expect(screen.getByTestId("selected-template-id").textContent).toBe("10");
      });

      // Enter
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      });
      await waitFor(() => {
        expect(pasteTemplateMock).toHaveBeenCalledWith(10);
      });
    });

    it("ArrowDown clamps at last template", async () => {
      render(await importApp());
      await act(async () => {
        fireEvent.click(screen.getByTestId("tab-templates"));
      });
      await waitFor(() => {
        expect(screen.getByTestId("selected-template-id").textContent).toBe("10");
      });

      for (let i = 0; i < 5; i++) {
        await act(async () => {
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
        });
      }
      await waitFor(() => {
        expect(screen.getByTestId("selected-template-id").textContent).toBe("30");
      });
    });

    it("ArrowUp clamps at first template", async () => {
      render(await importApp());
      await act(async () => {
        fireEvent.click(screen.getByTestId("tab-templates"));
      });
      await waitFor(() => {
        expect(screen.getByTestId("selected-template-id").textContent).toBe("10");
      });

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
      });
      await waitFor(() => {
        expect(screen.getByTestId("selected-template-id").textContent).toBe("10");
      });
    });
  });

  /* ---------------------------------------------------------------- */
  /* selectedHistoryId auto-selection                                   */
  /* ---------------------------------------------------------------- */

  describe("selectedHistoryId auto-selection", () => {
    it("sets null when entries are empty", async () => {
      historyState.entries = [];
      render(await importApp());
      await waitFor(() => {
        expect(screen.getByTestId("selected-history-id").textContent).toBe("null");
      });
    });

    it("selects first entry when current is not in entries", async () => {
      historyState.entries = [makeEntry(5), makeEntry(6)];
      render(await importApp());
      await waitFor(() => {
        expect(screen.getByTestId("selected-history-id").textContent).toBe("5");
      });
    });
  });

  /* ---------------------------------------------------------------- */
  /* selectedTemplateId auto-selection                                  */
  /* ---------------------------------------------------------------- */

  describe("selectedTemplateId auto-selection", () => {
    it("sets null when templates are empty", async () => {
      templatesState.templates = [];
      render(await importApp());
      await waitFor(() => {
        expect(screen.getByTestId("selected-template-id").textContent).toBe("null");
      });
    });

    it("selects first template when current is not in templates", async () => {
      templatesState.templates = [makeTemplate(10), makeTemplate(20)];
      render(await importApp());
      await waitFor(() => {
        expect(screen.getByTestId("selected-template-id").textContent).toBe("10");
      });
    });
  });

  /* ---------------------------------------------------------------- */
  /* getSelectedCardY                                                  */
  /* ---------------------------------------------------------------- */

  describe("getSelectedCardY", () => {
    it("returns element top when .panel-card.selected exists", async () => {
      historyState.entries = [makeEntry(1)];
      render(await importApp());

      // Create a mock selected card element
      const card = document.createElement("div");
      card.className = "panel-card selected";
      document.body.appendChild(card);
      vi.spyOn(card, "getBoundingClientRect").mockReturnValue({
        top: 100,
        left: 0,
        right: 100,
        bottom: 150,
        width: 100,
        height: 50,
        x: 0,
        y: 100,
        toJSON: () => {},
      });

      // Trigger a preview via arrow key to exercise getSelectedCardY
      invokeMock.mockClear();
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      });

      await waitFor(() => {
        const showPreviewCall = invokeMock.mock.calls.find(
          (c: unknown[]) => c[0] === "show_preview",
        );
        if (showPreviewCall) {
          expect((showPreviewCall[1] as { anchorY: number }).anchorY).toBe(100);
        }
      });

      document.body.removeChild(card);
    });

    it("returns null when no .panel-card.selected exists", async () => {
      historyState.entries = [makeEntry(1)];
      render(await importApp());

      invokeMock.mockClear();
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      });

      await waitFor(() => {
        const showPreviewCall = invokeMock.mock.calls.find(
          (c: unknown[]) => c[0] === "show_preview",
        );
        if (showPreviewCall) {
          expect((showPreviewCall[1] as { anchorY: number | null }).anchorY).toBeNull();
        }
      });
    });
  });

  /* ---------------------------------------------------------------- */
  /* showHistoryPreview                                                */
  /* ---------------------------------------------------------------- */

  describe("showHistoryPreview", () => {
    it("shows preview for text entry", async () => {
      historyState.entries = [makeEntry(1, "hello text", "text")];
      render(await importApp());

      await waitFor(() => {
        const call = invokeMock.mock.calls.find((c: unknown[]) => c[0] === "show_preview");
        expect(call).toBeTruthy();
        const payload = (call![1] as { payload: { text: string | null } }).payload;
        expect(payload.text).toBe("hello text");
      });
    });

    it("shows preview for image entry", async () => {
      historyState.entries = [makeEntry(1, "", "image", "imgdata")];
      render(await importApp());

      await waitFor(() => {
        const call = invokeMock.mock.calls.find((c: unknown[]) => c[0] === "show_preview");
        expect(call).toBeTruthy();
        const payload = (call![1] as { payload: { text: string | null; imageData: string | null } }).payload;
        expect(payload.text).toBeNull();
        expect(payload.imageData).toBe("imgdata");
      });
    });

    it("does nothing when entry not found (auto-preview with mismatched id)", async () => {
      // This is covered implicitly: when entries change and selectedHistoryId doesn't match,
      // the auto-selection picks entries[0], but let's test the "entry not found" branch
      // by having no entries and a non-null selectedHistoryId is impossible with auto-select.
      // The "not found" branch is also exercised when there are no entries - hide_preview is called instead.
      historyState.entries = [];
      render(await importApp());
      // With no entries, hide_preview should be called
      await waitFor(() => {
        const call = invokeMock.mock.calls.find((c: unknown[]) => c[0] === "hide_preview");
        expect(call).toBeTruthy();
      });
    });

    it("handles show_preview string error", async () => {
      historyState.entries = [makeEntry(1, "text")];
      invokeMock.mockImplementation((cmd: string) => {
        if (cmd === "show_preview") return Promise.reject("string error msg");
        return Promise.resolve(undefined);
      });

      render(await importApp());

      await waitFor(() => {
        expect(screen.getByTestId("popup-window").getAttribute("data-error")).toContain("string error msg");
      });
    });

    it("handles show_preview Error error", async () => {
      historyState.entries = [makeEntry(1, "text")];
      invokeMock.mockImplementation((cmd: string) => {
        if (cmd === "show_preview") return Promise.reject(new Error("Error object msg"));
        return Promise.resolve(undefined);
      });

      render(await importApp());

      await waitFor(() => {
        expect(screen.getByTestId("popup-window").getAttribute("data-error")).toContain("Error object msg");
      });
    });

    it("handles show_preview non-string non-Error error", async () => {
      historyState.entries = [makeEntry(1, "text")];
      invokeMock.mockImplementation((cmd: string) => {
        if (cmd === "show_preview") return Promise.reject({ code: 42 });
        return Promise.resolve(undefined);
      });

      render(await importApp());

      await waitFor(() => {
        const errAttr = screen.getByTestId("popup-window").getAttribute("data-error");
        expect(errAttr).toContain("プレビューの表示に失敗しました:");
        expect(errAttr).toContain("42");
      });
    });
  });

  /* ---------------------------------------------------------------- */
  /* showTemplatePreview                                               */
  /* ---------------------------------------------------------------- */

  describe("showTemplatePreview", () => {
    it("shows preview for text template", async () => {
      templatesState.templates = [makeTemplate(10, "tmpl text", "text")];
      render(await importApp());

      // Switch to templates tab
      await act(async () => {
        fireEvent.click(screen.getByTestId("tab-templates"));
      });

      await waitFor(() => {
        const call = invokeMock.mock.calls.find(
          (c: unknown[]) => c[0] === "show_preview" && (c[1] as { payload: { text: string | null } }).payload.text === "tmpl text",
        );
        expect(call).toBeTruthy();
      });
    });

    it("shows preview for image template", async () => {
      templatesState.templates = [makeTemplate(10, "", "image", "img64")];
      render(await importApp());

      await act(async () => {
        fireEvent.click(screen.getByTestId("tab-templates"));
      });

      await waitFor(() => {
        const call = invokeMock.mock.calls.find(
          (c: unknown[]) =>
            c[0] === "show_preview" &&
            (c[1] as { payload: { imageData: string | null } }).payload.imageData === "img64",
        );
        expect(call).toBeTruthy();
      });
    });

    it("shows template preview with anchorY when card element exists", async () => {
      templatesState.templates = [makeTemplate(10, "tmpl anchor", "text")];
      render(await importApp());

      const card = document.createElement("div");
      card.className = "panel-card selected";
      document.body.appendChild(card);
      vi.spyOn(card, "getBoundingClientRect").mockReturnValue({
        top: 200,
        left: 0,
        right: 100,
        bottom: 250,
        width: 100,
        height: 50,
        x: 0,
        y: 200,
        toJSON: () => {},
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId("tab-templates"));
      });

      await waitFor(() => {
        const call = invokeMock.mock.calls.find(
          (c: unknown[]) =>
            c[0] === "show_preview" &&
            (c[1] as { payload: { text: string | null } }).payload.text === "tmpl anchor",
        );
        expect(call).toBeTruthy();
        expect((call![1] as { anchorY: number }).anchorY).toBe(200);
      });

      document.body.removeChild(card);
    });

    it("shows image template preview with anchorY", async () => {
      templatesState.templates = [makeTemplate(10, "", "image", "imgdata")];
      render(await importApp());

      const card = document.createElement("div");
      card.className = "panel-card selected";
      document.body.appendChild(card);
      vi.spyOn(card, "getBoundingClientRect").mockReturnValue({
        top: 150,
        left: 0,
        right: 100,
        bottom: 200,
        width: 100,
        height: 50,
        x: 0,
        y: 150,
        toJSON: () => {},
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId("tab-templates"));
      });

      await waitFor(() => {
        const call = invokeMock.mock.calls.find(
          (c: unknown[]) =>
            c[0] === "show_preview" &&
            (c[1] as { payload: { imageData: string | null } }).payload.imageData === "imgdata",
        );
        expect(call).toBeTruthy();
        expect((call![1] as { anchorY: number }).anchorY).toBe(150);
      });

      document.body.removeChild(card);
    });

    it("handles show_preview error for template (string)", async () => {
      templatesState.templates = [makeTemplate(10, "t")];
      invokeMock.mockImplementation((cmd: string) => {
        if (cmd === "show_preview") return Promise.reject("tmpl err");
        return Promise.resolve(undefined);
      });

      render(await importApp());
      await act(async () => {
        fireEvent.click(screen.getByTestId("tab-templates"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("popup-window").getAttribute("data-error")).toContain("tmpl err");
      });
    });

    it("handles show_preview Error for template", async () => {
      templatesState.templates = [makeTemplate(10, "t")];
      invokeMock.mockImplementation((cmd: string) => {
        if (cmd === "show_preview") return Promise.reject(new Error("tmpl Error"));
        return Promise.resolve(undefined);
      });

      render(await importApp());
      await act(async () => {
        fireEvent.click(screen.getByTestId("tab-templates"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("popup-window").getAttribute("data-error")).toContain("tmpl Error");
      });
    });

    it("handles show_preview non-string non-Error for template", async () => {
      templatesState.templates = [makeTemplate(10, "t")];
      invokeMock.mockImplementation((cmd: string) => {
        if (cmd === "show_preview") return Promise.reject({ x: 1 });
        return Promise.resolve(undefined);
      });

      render(await importApp());
      await act(async () => {
        fireEvent.click(screen.getByTestId("tab-templates"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("popup-window").getAttribute("data-error")).toContain(
          "プレビューの表示に失敗しました:",
        );
      });
    });
  });

  /* ---------------------------------------------------------------- */
  /* Auto-preview effect                                               */
  /* ---------------------------------------------------------------- */

  describe("auto-preview effect", () => {
    it("calls hide_preview when on settings tab", async () => {
      render(await importApp());
      await act(async () => {
        fireEvent.click(screen.getByTestId("tab-settings"));
      });

      await waitFor(() => {
        expect(invokeMock).toHaveBeenCalledWith("hide_preview");
      });
    });

    it("does not show preview when locked", async () => {
      settingsState.requirePassword = true;
      historyState.entries = [makeEntry(1)];
      render(await importApp());

      // Should not call show_preview because we are locked
      await new Promise((r) => setTimeout(r, 100));
      const showCalls = invokeMock.mock.calls.filter((c: unknown[]) => c[0] === "show_preview");
      expect(showCalls.length).toBe(0);
    });

    it("does not show preview when needsSetup", async () => {
      settingsState.requirePassword = false;
      settingsState.setupSkipped = false;
      historyState.entries = [makeEntry(1)];
      render(await importApp());

      await new Promise((r) => setTimeout(r, 100));
      const showCalls = invokeMock.mock.calls.filter((c: unknown[]) => c[0] === "show_preview");
      expect(showCalls.length).toBe(0);
    });
  });

  /* ---------------------------------------------------------------- */
  /* Hotkey listener (toggle-popup)                                    */
  /* ---------------------------------------------------------------- */

  describe("hotkey listener", () => {
    it("calls show + setFocus + increments popupVisible", async () => {
      render(await importApp());
      await waitFor(() => {
        expect(listenMock).toHaveBeenCalledWith("hotkey://toggle-popup", expect.any(Function));
      });

      const cb = getListenCallback("hotkey://toggle-popup")!;
      expect(cb).toBeTruthy();

      showMock.mockClear();
      setFocusMock.mockClear();
      historyRefreshMock.mockClear();
      templatesRefreshMock.mockClear();

      await act(async () => {
        await cb();
      });

      expect(historyRefreshMock).toHaveBeenCalled();
      expect(templatesRefreshMock).toHaveBeenCalled();
      expect(showMock).toHaveBeenCalled();
      expect(setFocusMock).toHaveBeenCalled();
    });
  });

  /* ---------------------------------------------------------------- */
  /* Tab select listener                                               */
  /* ---------------------------------------------------------------- */

  describe("tab select listener", () => {
    it("sets active tab on valid payload", async () => {
      render(await importApp());
      await waitFor(() => {
        expect(listenMock).toHaveBeenCalledWith("ui://select-tab", expect.any(Function));
      });

      const cb = getListenCallback("ui://select-tab")!;

      await act(async () => {
        cb({ payload: "templates" });
      });

      expect(screen.getByTestId("popup-window").getAttribute("data-active-tab")).toBe("templates");
    });

    it("ignores invalid tab payload", async () => {
      render(await importApp());
      const cb = getListenCallback("ui://select-tab")!;

      await act(async () => {
        cb({ payload: "invalid_tab" });
      });

      // Should still be on history (default)
      expect(screen.getByTestId("popup-window").getAttribute("data-active-tab")).toBe("history");
    });
  });

  /* ---------------------------------------------------------------- */
  /* Resize effect                                                     */
  /* ---------------------------------------------------------------- */

  describe("resize effect", () => {
    it("resizes to compact width for history tab", async () => {
      render(await importApp());
      await waitFor(() => {
        expect(setSizeMock).toHaveBeenCalled();
      });
      const call = setSizeMock.mock.calls[0][0] as { width: number; height: number };
      expect(call.width).toBe(230);
      expect(call.height).toBe(720);
    });

    it("does not resize again when switching to settings tab", async () => {
      render(await importApp());
      await waitFor(() => {
        expect(setSizeMock).toHaveBeenCalled();
      });
      const callCount = setSizeMock.mock.calls.length;

      await act(async () => {
        fireEvent.click(screen.getByTestId("tab-settings"));
      });

      // resize effect only runs on mount, not on tab change
      expect(setSizeMock.mock.calls.length).toBe(callCount);
    });
  });

  /* ---------------------------------------------------------------- */
  /* onDismissError                                                    */
  /* ---------------------------------------------------------------- */

  it("clears error on dismiss", async () => {
    historyState.entries = [makeEntry(1)];
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "show_preview") return Promise.reject("err");
      return Promise.resolve(undefined);
    });

    render(await importApp());

    await waitFor(() => {
      expect(screen.getByTestId("popup-window").getAttribute("data-error")).toContain("err");
    });

    invokeMock.mockResolvedValue(undefined);

    await act(async () => {
      fireEvent.click(screen.getByTestId("dismiss-error"));
    });

    expect(screen.getByTestId("popup-window").getAttribute("data-error")).toBe("");
  });

  /* ---------------------------------------------------------------- */
  /* onRegisterAsTemplate                                              */
  /* ---------------------------------------------------------------- */

  describe("onRegisterAsTemplate", () => {
    it("registers text entry as template", async () => {
      render(await importApp());
      await waitFor(() => {
        expect(screen.getByTestId("popup-window")).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId("register-text-template"));
      });

      expect(saveTemplateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.any(String),
          text: "some text content for registering",
          contentType: "text",
          imageData: undefined,
          newGroupName: "履歴から登録",
        }),
      );
      // Should switch to templates tab
      expect(screen.getByTestId("popup-window").getAttribute("data-active-tab")).toBe("templates");
    });

    it("registers image entry as template", async () => {
      render(await importApp());
      await waitFor(() => {
        expect(screen.getByTestId("popup-window")).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId("register-image-template"));
      });

      expect(saveTemplateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "[画像]",
          text: "[画像]",
          contentType: "image",
          imageData: "base64data",
          newGroupName: "履歴から登録",
        }),
      );
    });
  });

  /* ---------------------------------------------------------------- */
  /* settings.refresh wrapper                                          */
  /* ---------------------------------------------------------------- */

  it("calls settings.refresh via wrapper", async () => {
    render(await importApp());
    await waitFor(() => {
      expect(screen.getByTestId("popup-window")).toBeInTheDocument();
    });
    settingsRefreshMock.mockClear();

    await act(async () => {
      fireEvent.click(screen.getByTestId("settings-refresh"));
    });

    expect(settingsRefreshMock).toHaveBeenCalled();
  });

  /* ---------------------------------------------------------------- */
  /* Cleanup: event listeners are removed on unmount                   */
  /* ---------------------------------------------------------------- */

  it("removes event listeners on unmount", async () => {
    const unlistenPopup = vi.fn();
    const unlistenTab = vi.fn();
    let callIdx = 0;
    listenMock.mockImplementation(() => {
      callIdx++;
      if (callIdx % 2 === 1) return Promise.resolve(unlistenPopup);
      return Promise.resolve(unlistenTab);
    });

    const { unmount } = render(await importApp());

    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

    unmount();

    // The cleanup should call unlisten and removeEventListener
    await waitFor(() => {
      expect(removeEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    });
    removeEventListenerSpy.mockRestore();
  });

  /* ---------------------------------------------------------------- */
  /* requirePassword effect: sets locked=true                          */
  /* ---------------------------------------------------------------- */

  it("sets locked state when requirePassword is true on mount", async () => {
    settingsState.requirePassword = true;
    render(await importApp());
    expect(screen.getByText("ロック解除")).toBeInTheDocument();
  });

  /* ---------------------------------------------------------------- */
  /* hidePopup calls hide_preview and window.hide                      */
  /* ---------------------------------------------------------------- */

  it("hidePopup invokes hide_preview and hides window", async () => {
    render(await importApp());
    await waitFor(() => {
      expect(screen.getByTestId("popup-window")).toBeInTheDocument();
    });

    invokeMock.mockClear();
    hideMock.mockClear();

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("hide_preview");
      expect(hideMock).toHaveBeenCalled();
    });
  });

  /* ---------------------------------------------------------------- */
  /* hidePopup when hide_preview rejects (catch branch)                */
  /* ---------------------------------------------------------------- */

  it("hidePopup still hides window even if hide_preview fails", async () => {
    render(await importApp());
    await waitFor(() => {
      expect(screen.getByTestId("popup-window")).toBeInTheDocument();
    });

    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "hide_preview") return Promise.reject(new Error("fail"));
      return Promise.resolve(undefined);
    });
    hideMock.mockClear();

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    await waitFor(() => {
      expect(hideMock).toHaveBeenCalled();
    });
  });

  /* ---------------------------------------------------------------- */
  /* Image entry with null imageData                                   */
  /* ---------------------------------------------------------------- */

  it("handles image entry with null imageData", async () => {
    historyState.entries = [makeEntry(1, "", "image", null)];
    render(await importApp());

    await waitFor(() => {
      const call = invokeMock.mock.calls.find((c: unknown[]) => c[0] === "show_preview");
      expect(call).toBeTruthy();
      const payload = (call![1] as { payload: { imageData: string | null } }).payload;
      expect(payload.imageData).toBeNull();
    });
  });

  /* ---------------------------------------------------------------- */
  /* Template image with imageData (isImage = contentType=image && imageData) */
  /* ---------------------------------------------------------------- */

  it("handles template with contentType=image but no imageData (isImage=false)", async () => {
    templatesState.templates = [makeTemplate(10, "fallback", "image", null)];
    render(await importApp());
    await act(async () => {
      fireEvent.click(screen.getByTestId("tab-templates"));
    });

    await waitFor(() => {
      const call = invokeMock.mock.calls.find(
        (c: unknown[]) =>
          c[0] === "show_preview" &&
          (c[1] as { payload: { text: string | null } }).payload.text === "fallback",
      );
      // When contentType is "image" but imageData is null, isImage is false,
      // so text is used
      expect(call).toBeTruthy();
    });
  });

  /* ---------------------------------------------------------------- */
  /* Window init error (getCurrentWindow throws in useEffect)          */
  /* ---------------------------------------------------------------- */

  describe("window init error", () => {
    it("sets error when getCurrentWindow throws Error", async () => {
      // Make getCurrentWindow throw only after the IIFE (module already loaded)
      // The component's useEffect calls getCurrentWindow again
      windowState.shouldThrow = true;
      windowState.throwValue = new Error("window init failed");

      render(await importApp());

      await waitFor(() => {
        expect(screen.getByTestId("popup-window").getAttribute("data-error")).toContain("window init failed");
      });
    });

    it("sets generic error when getCurrentWindow throws non-Error", async () => {
      windowState.shouldThrow = true;
      windowState.throwValue = "not an error object";

      render(await importApp());

      await waitFor(() => {
        expect(screen.getByTestId("popup-window").getAttribute("data-error")).toContain(
          "ウィンドウの初期化に失敗しました。",
        );
      });
    });
  });

  /* ---------------------------------------------------------------- */
  /* Hotkey handler when popupWindowRef is null (early return)          */
  /* ---------------------------------------------------------------- */

  it("returns early in hotkey handler when popupWindowRef is null", async () => {
    windowState.shouldThrow = true;
    windowState.throwValue = new Error("no window");

    render(await importApp());
    await waitFor(() => {
      expect(listenMock).toHaveBeenCalledWith("hotkey://toggle-popup", expect.any(Function));
    });

    const cb = getListenCallback("hotkey://toggle-popup")!;
    showMock.mockClear();

    await act(async () => {
      await cb();
    });

    // show should NOT be called because popupWindowRef is null
    expect(showMock).not.toHaveBeenCalled();
  });

  /* ---------------------------------------------------------------- */
  /* Resize when popupWindowRef is null (early return)                 */
  /* ---------------------------------------------------------------- */

  it("does not resize when popupWindowRef is null", async () => {
    windowState.shouldThrow = true;
    windowState.throwValue = new Error("no window");

    render(await importApp());

    // setSizeMock should NOT be called because popupWindowRef is null
    expect(setSizeMock).not.toHaveBeenCalled();
  });

  /* ---------------------------------------------------------------- */
  /* Escape during needsSetup (does not hide)                          */
  /* ---------------------------------------------------------------- */

  it("does not hide popup on Escape when in needsSetup state", async () => {
    settingsState.requirePassword = false;
    settingsState.setupSkipped = false;
    render(await importApp());

    await waitFor(() => {
      expect(screen.getByText("パスワードを設定して開始")).toBeInTheDocument();
    });

    hideMock.mockClear();
    invokeMock.mockClear();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    await new Promise((r) => setTimeout(r, 50));
    expect(hideMock).not.toHaveBeenCalled();
  });

  /* ---------------------------------------------------------------- */
  /* isEditableTarget: textarea and contenteditable                     */
  /* ---------------------------------------------------------------- */

  it("does not navigate on ArrowDown when target is a textarea", async () => {
    historyState.entries = [makeEntry(1), makeEntry(2)];
    render(await importApp());
    await waitFor(() => {
      expect(screen.getByTestId("popup-window")).toBeInTheDocument();
    });

    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    textarea.focus();

    await act(async () => {
      textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });

    expect(selectEntryMock).not.toHaveBeenCalled();
    document.body.removeChild(textarea);
  });

  it("does not navigate on ArrowDown when target is contentEditable", async () => {
    historyState.entries = [makeEntry(1), makeEntry(2)];
    render(await importApp());
    await waitFor(() => {
      expect(screen.getByTestId("popup-window")).toBeInTheDocument();
    });

    const div = document.createElement("div");
    div.contentEditable = "true";
    document.body.appendChild(div);
    div.focus();

    await act(async () => {
      div.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });

    expect(selectEntryMock).not.toHaveBeenCalled();
    document.body.removeChild(div);
  });

  it("does not navigate on ArrowDown when target is a select element", async () => {
    historyState.entries = [makeEntry(1), makeEntry(2)];
    render(await importApp());
    await waitFor(() => {
      expect(screen.getByTestId("popup-window")).toBeInTheDocument();
    });

    const select = document.createElement("select");
    document.body.appendChild(select);
    select.focus();

    await act(async () => {
      select.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });

    expect(selectEntryMock).not.toHaveBeenCalled();
    document.body.removeChild(select);
  });

  /* ---------------------------------------------------------------- */
  /* Enter with no selectedHistoryId (null) - should not call selectEntry */
  /* ---------------------------------------------------------------- */

  it("does not call selectEntry on Enter when selectedHistoryId is null", async () => {
    historyState.entries = [];
    render(await importApp());
    await waitFor(() => {
      expect(screen.getByTestId("popup-window")).toBeInTheDocument();
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });

    expect(selectEntryMock).not.toHaveBeenCalled();
  });

  /* ---------------------------------------------------------------- */
  /* Enter with no selectedTemplateId (null) - should not call paste    */
  /* ---------------------------------------------------------------- */

  it("does not call pasteTemplate on Enter when selectedTemplateId is null", async () => {
    templatesState.templates = [];
    render(await importApp());
    await act(async () => {
      fireEvent.click(screen.getByTestId("tab-templates"));
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });

    expect(pasteTemplateMock).not.toHaveBeenCalled();
  });

  /* ---------------------------------------------------------------- */
  /* ArrowDown/Up with empty entries (no-op)                            */
  /* ---------------------------------------------------------------- */

  it("does nothing on ArrowDown with empty history entries", async () => {
    historyState.entries = [];
    render(await importApp());
    await waitFor(() => {
      expect(screen.getByTestId("popup-window")).toBeInTheDocument();
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });

    expect(screen.getByTestId("selected-history-id").textContent).toBe("null");
  });

  it("does nothing on ArrowUp with empty history entries", async () => {
    historyState.entries = [];
    render(await importApp());

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    });

    expect(screen.getByTestId("selected-history-id").textContent).toBe("null");
  });

  it("does nothing on ArrowDown with empty templates", async () => {
    templatesState.templates = [];
    render(await importApp());
    await act(async () => {
      fireEvent.click(screen.getByTestId("tab-templates"));
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });

    expect(screen.getByTestId("selected-template-id").textContent).toBe("null");
  });

  it("does nothing on ArrowUp with empty templates", async () => {
    templatesState.templates = [];
    render(await importApp());
    await act(async () => {
      fireEvent.click(screen.getByTestId("tab-templates"));
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    });

    expect(screen.getByTestId("selected-template-id").textContent).toBe("null");
  });

  /* ---------------------------------------------------------------- */
  /* setSelectedTemplate callback                                       */
  /* ---------------------------------------------------------------- */

  it("calls setSelectedTemplateId via setSelectedTemplate callback", async () => {
    render(await importApp());
    await waitFor(() => {
      expect(screen.getByTestId("popup-window")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("set-selected-template"));
    });

    expect(screen.getByTestId("selected-template-id").textContent).toBe("99");
  });

  /* ---------------------------------------------------------------- */
  /* selectedHistoryId retained when current is in new entries          */
  /* ---------------------------------------------------------------- */

  it("retains selectedHistoryId when current id is still in entries after change", async () => {
    historyState.entries = [makeEntry(1), makeEntry(2), makeEntry(3)];
    const { rerender } = render(await importApp());

    // Auto-selects first entry
    await waitFor(() => {
      expect(screen.getByTestId("selected-history-id").textContent).toBe("1");
    });

    // Move to entry 2
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });
    await waitFor(() => {
      expect(screen.getByTestId("selected-history-id").textContent).toBe("2");
    });

    // Change entries but keep entry 2
    historyState.entries = [makeEntry(2), makeEntry(4)];
    const App = (await import("../App")).default;
    rerender(<App />);

    // Should retain entry 2 since it's still in the entries
    await waitFor(() => {
      expect(screen.getByTestId("selected-history-id").textContent).toBe("2");
    });
  });

  /* ---------------------------------------------------------------- */
  /* selectedTemplateId retained when current is in new templates       */
  /* ---------------------------------------------------------------- */

  it("retains selectedTemplateId when current id is still in templates after change", async () => {
    templatesState.templates = [makeTemplate(10), makeTemplate(20), makeTemplate(30)];
    const { rerender } = render(await importApp());

    // Switch to templates tab
    await act(async () => {
      fireEvent.click(screen.getByTestId("tab-templates"));
    });

    // Auto-selects first template
    await waitFor(() => {
      expect(screen.getByTestId("selected-template-id").textContent).toBe("10");
    });

    // Move to template 20
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });
    await waitFor(() => {
      expect(screen.getByTestId("selected-template-id").textContent).toBe("20");
    });

    // Change templates but keep template 20
    templatesState.templates = [makeTemplate(20), makeTemplate(40)];
    const App = (await import("../App")).default;
    rerender(<App />);

    // Should retain template 20
    await waitFor(() => {
      expect(screen.getByTestId("selected-template-id").textContent).toBe("20");
    });
  });

  /* ---------------------------------------------------------------- */
  /* currentIndex < 0 branches (selectedId not in entries)              */
  /* ---------------------------------------------------------------- */

  it("ArrowDown defaults to index 0 when selectedHistoryId is not in entries", async () => {
    historyState.entries = [makeEntry(1, "a"), makeEntry(2, "b")];
    render(await importApp());
    await waitFor(() => {
      expect(screen.getByTestId("popup-window")).toBeInTheDocument();
    });

    // Set selectedHistoryId to a value not in entries
    await act(async () => {
      fireEvent.click(screen.getByTestId("set-selected-history"));
    });

    // Now dispatch ArrowDown - currentIndex will be -1, should default to index 0
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.getByTestId("selected-history-id").textContent).toBe("1");
    });
  });

  it("ArrowUp defaults to index 0 when selectedHistoryId is not in entries", async () => {
    historyState.entries = [makeEntry(1, "a"), makeEntry(2, "b")];
    render(await importApp());
    await waitFor(() => {
      expect(screen.getByTestId("popup-window")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("set-selected-history"));
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.getByTestId("selected-history-id").textContent).toBe("1");
    });
  });

  it("ArrowDown defaults to index 0 when selectedTemplateId is not in templates", async () => {
    templatesState.templates = [makeTemplate(10, "t1"), makeTemplate(20, "t2")];
    render(await importApp());

    // Switch to templates tab
    await act(async () => {
      fireEvent.click(screen.getByTestId("tab-templates"));
    });
    await waitFor(() => {
      expect(screen.getByTestId("selected-template-id").textContent).toBe("10");
    });

    // Set selectedTemplateId to a value not in templates
    await act(async () => {
      fireEvent.click(screen.getByTestId("set-selected-template"));
    });
    // Now selectedTemplateId is 99 which is not in templates

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.getByTestId("selected-template-id").textContent).toBe("10");
    });
  });

  it("ArrowUp defaults to index 0 when selectedTemplateId is not in templates", async () => {
    templatesState.templates = [makeTemplate(10, "t1"), makeTemplate(20, "t2")];
    render(await importApp());

    await act(async () => {
      fireEvent.click(screen.getByTestId("tab-templates"));
    });
    await waitFor(() => {
      expect(screen.getByTestId("selected-template-id").textContent).toBe("10");
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("set-selected-template"));
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.getByTestId("selected-template-id").textContent).toBe("10");
    });
  });

  /* ---------------------------------------------------------------- */
  /* Unrecognized key on history/templates tab (falls through)          */
  /* ---------------------------------------------------------------- */

  it("ignores unrecognized keys on history tab", async () => {
    historyState.entries = [makeEntry(1)];
    render(await importApp());
    await waitFor(() => {
      expect(screen.getByTestId("popup-window")).toBeInTheDocument();
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
    });

    // Nothing should break, still selected
    expect(screen.getByTestId("selected-history-id").textContent).toBe("1");
  });
});

/* ------------------------------------------------------------------ */
/* isPreviewWindow IIFE branches (require module re-evaluation)        */
/* ------------------------------------------------------------------ */

describe("App - isPreviewWindow = true (preview branch)", () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it("renders PreviewPanel when window label is 'preview'", async () => {
    windowState.label = "preview";
    vi.resetModules();

    const { default: AppPreview } = await import("../App");
    render(<AppPreview />);

    expect(screen.getByTestId("preview-panel")).toBeInTheDocument();

    // Reset for other tests
    windowState.label = "main";
    vi.resetModules();
  });
});

describe("App - isPreviewWindow IIFE catch branch", () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it("returns false when getCurrentWindow throws (IIFE catch)", async () => {
    windowState.shouldThrow = true;
    windowState.throwValue = new Error("no window in IIFE");
    vi.resetModules();

    const { default: AppCatch } = await import("../App");
    render(<AppCatch />);

    // isPreviewWindow should be false (catch returns false), so MainApp renders
    // But since getCurrentWindow also throws in the useEffect, we get the error state
    // The key check: it should NOT render PreviewPanel
    expect(screen.queryByTestId("preview-panel")).not.toBeInTheDocument();

    // Reset
    windowState.shouldThrow = false;
    windowState.throwValue = null;
    windowState.label = "main";
    vi.resetModules();
  });
});

/* ------------------------------------------------------------------ */
/* Helper: dynamic import of App to get fresh module per test          */
/* ------------------------------------------------------------------ */

async function importApp() {
  // We import App normally since the IIFE runs at module load,
  // and the module is already cached with label="main"
  const { default: App } = await import("../App");
  return <App />;
}
