import { render, screen, waitFor } from "@testing-library/react";
import App from "../App";

const {
  hideMock,
  showMock,
  setFocusMock,
  setSizeMock,
  centerMock,
  invokeMock,
  listenMock,
  settingsState,
} = vi.hoisted(() => ({
  hideMock: vi.fn().mockResolvedValue(undefined),
  showMock: vi.fn().mockResolvedValue(undefined),
  setFocusMock: vi.fn().mockResolvedValue(undefined),
  setSizeMock: vi.fn().mockResolvedValue(undefined),
  centerMock: vi.fn().mockResolvedValue(undefined),
  invokeMock: vi.fn().mockResolvedValue(undefined),
  listenMock: vi.fn().mockResolvedValue(() => {}),
  settingsState: {
    requirePassword: false,
    setupSkipped: true,
  },
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: listenMock,
}));

vi.mock("@tauri-apps/api/window", () => ({
  LogicalSize: class LogicalSize {
    constructor(
      public width: number,
      public height: number,
    ) {}
  },
  getCurrentWindow: () => ({
    label: "main",
    hide: hideMock,
    show: showMock,
    setFocus: setFocusMock,
    setSize: setSizeMock,
    center: centerMock,
  }),
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
    },
    setupSkipped: settingsState.setupSkipped,
    refresh: vi.fn().mockResolvedValue(undefined),
    saveSettings: vi.fn(),
    skipSetup: vi.fn(),
  }),
}));

vi.mock("../hooks/useClipboardHistory", () => ({
  useClipboardHistory: () => ({
    entries: [],
    loading: false,
    page: 1,
    total: 0,
    totalPages: 1,
    search: "",
    setSearch: vi.fn(),
    nextPage: vi.fn(),
    previousPage: vi.fn(),
    refresh: vi.fn().mockResolvedValue(undefined),
    selectEntry: vi.fn().mockResolvedValue(undefined),
    updateEntry: vi.fn(),
    togglePinned: vi.fn(),
    deleteEntry: vi.fn(),
    setClipboardFormatted: vi.fn(),
    setClipboardConverted: vi.fn(),
  }),
}));

vi.mock("../hooks/useTemplates", () => ({
  useTemplates: () => ({
    groups: [],
    templates: [],
    search: "",
    selectedGroupId: null,
    setSearch: vi.fn(),
    setSelectedGroupId: vi.fn(),
    refresh: vi.fn().mockResolvedValue(undefined),
    pasteTemplate: vi.fn().mockResolvedValue(undefined),
    saveTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
    exportTemplates: vi.fn(),
    importTemplates: vi.fn(),
  }),
}));

describe("App", () => {
  beforeEach(() => {
    settingsState.requirePassword = false;
    settingsState.setupSkipped = true;
    hideMock.mockClear();
    showMock.mockClear();
    setFocusMock.mockClear();
    setSizeMock.mockClear();
    centerMock.mockClear();
    invokeMock.mockClear();
    listenMock.mockClear();
  });

  it("renders the main popup with tabs", async () => {
    render(<App />);

    await waitFor(() => {
      expect(setSizeMock).toHaveBeenCalled();
    });

    expect(screen.getByRole("button", { name: "履歴" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "定型文" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "設定" })).toBeInTheDocument();
  });

  it("does not hide the window on Escape while locked", async () => {
    settingsState.requirePassword = true;

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Unlock" })).toBeInTheDocument();
    });

    hideMock.mockClear();
    invokeMock.mockClear();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    // Window should NOT be hidden when locked
    expect(hideMock).not.toHaveBeenCalled();
  });
});
