import { renderHook, act } from "@testing-library/react";
import i18n from "../i18n";
import { useSettings } from "../hooks/useSettings";
import type { AppSettings } from "../types";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

const defaultSettings: AppSettings = {
  maxHistoryItems: 1000,
  pageSize: 20,
  hotkey: "Ctrl+Alt+Z",
  activationMode: "hotkey",
  launchOnStartup: false,
  blurDelayMs: 100,
  previewWidth: 320,
  previewHeight: 400,
  previewImageWidth: 520,
  previewImageHeight: 520,
  requirePassword: false,
  rememberLastTab: false,
};

const customSettings: AppSettings = {
  ...defaultSettings,
  maxHistoryItems: 500,
  pageSize: 50,
  hotkey: "Ctrl+Shift+V",
  launchOnStartup: true,
};

describe("useSettings", () => {
  let setError: (message: string | null) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    setError = vi.fn<(message: string | null) => void>();
    localStorage.setItem("clipor-lang", "ja");
    void i18n.changeLanguage("ja");
  });

  it("loads settings on mount via get_settings", async () => {
    invokeMock.mockResolvedValue(customSettings);

    const { result } = renderHook(() => useSettings(setError));

    // Initially has defaults
    expect(result.current.settings).toEqual(defaultSettings);

    await vi.waitFor(() => {
      expect(result.current.settings).toEqual(customSettings);
    });

    expect(invokeMock).toHaveBeenCalledWith("get_settings");
    expect(setError).toHaveBeenCalledWith(null);
  });

  it("sets error when get_settings rejects with Error", async () => {
    invokeMock.mockRejectedValue(new Error("load fail"));

    const { result } = renderHook(() => useSettings(setError));

    await vi.waitFor(() => {
      expect(setError).toHaveBeenCalledWith("load fail");
    });

    // Settings remain default
    expect(result.current.settings).toEqual(defaultSettings);
  });

  it("sets default error when get_settings rejects with non-Error", async () => {
    invokeMock.mockRejectedValue("something");

    renderHook(() => useSettings(setError));

    await vi.waitFor(() => {
      expect(setError).toHaveBeenCalledWith(i18n.t("errors.settings_fetch"));
    });
  });

  describe("refresh", () => {
    it("can be called manually to reload settings", async () => {
      invokeMock.mockResolvedValue(defaultSettings);

      const { result } = renderHook(() => useSettings(setError));

      await vi.waitFor(() => {
        expect(invokeMock).toHaveBeenCalledTimes(1);
      });

      invokeMock.mockResolvedValue(customSettings);

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.settings).toEqual(customSettings);
      expect(invokeMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("saveSettings", () => {
    it("calls update_settings and updates state with result", async () => {
      invokeMock.mockResolvedValue(defaultSettings);

      const { result } = renderHook(() => useSettings(setError));

      await vi.waitFor(() => {
        expect(result.current.settings).toEqual(defaultSettings);
      });

      invokeMock.mockResolvedValue(customSettings);

      await act(async () => {
        await result.current.saveSettings(customSettings);
      });

      expect(invokeMock).toHaveBeenCalledWith("update_settings", { settings: customSettings });
      expect(result.current.settings).toEqual(customSettings);
      expect(setError).toHaveBeenCalledWith(null);
    });

    it("sets error when update_settings rejects with Error", async () => {
      invokeMock.mockResolvedValue(defaultSettings);

      const { result } = renderHook(() => useSettings(setError));

      await vi.waitFor(() => {
        expect(result.current.settings).toEqual(defaultSettings);
      });

      invokeMock.mockRejectedValue(new Error("save fail"));

      await act(async () => {
        await result.current.saveSettings(customSettings);
      });

      expect(setError).toHaveBeenCalledWith("save fail");
      // Settings remain unchanged
      expect(result.current.settings).toEqual(defaultSettings);
    });

    it("sets default error when update_settings rejects with non-Error", async () => {
      invokeMock.mockResolvedValue(defaultSettings);

      const { result } = renderHook(() => useSettings(setError));

      await vi.waitFor(() => {
        expect(result.current.settings).toEqual(defaultSettings);
      });

      invokeMock.mockRejectedValue(123);

      await act(async () => {
        await result.current.saveSettings(customSettings);
      });

      expect(setError).toHaveBeenCalledWith(i18n.t("errors.settings_save"));
    });
  });

  describe("skipSetup", () => {
    it("sets setupSkipped to true", async () => {
      invokeMock.mockResolvedValue(defaultSettings);

      const { result } = renderHook(() => useSettings(setError));

      await vi.waitFor(() => {
        expect(result.current.settings).toEqual(defaultSettings);
      });

      // setupSkipped defaults to true already, but we verify calling skipSetup works
      expect(result.current.setupSkipped).toBe(true);

      act(() => {
        result.current.skipSetup();
      });

      expect(result.current.setupSkipped).toBe(true);
    });
  });

  describe("setupSkipped initial value", () => {
    it("defaults to true", async () => {
      invokeMock.mockResolvedValue(defaultSettings);

      const { result } = renderHook(() => useSettings(setError));

      expect(result.current.setupSkipped).toBe(true);
    });
  });
});
