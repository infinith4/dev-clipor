import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import SettingsView from "../components/SettingsView";
import i18n from "../i18n";
import type { AppSettings } from "../types";

const mockInvoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

function defaultSettings(overrides?: Partial<AppSettings>): AppSettings {
  return {
    maxHistoryItems: 500,
    pageSize: 20,
    hotkey: "Ctrl+Alt+Z",
    activationMode: "hotkey",
    launchOnStartup: false,
    blurDelayMs: 200,
    previewWidth: 300,
    previewHeight: 400,
    previewImageWidth: 500,
    previewImageHeight: 600,
    requirePassword: false,
    rememberLastTab: false,
    ...overrides,
  };
}

function renderSettings(overrides?: Partial<AppSettings>, propOverrides?: Record<string, unknown>) {
  const settings = defaultSettings(overrides);
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onPasswordChanged = vi.fn();
  const result = render(
    <SettingsView
      settings={settings}
      onSave={onSave}
      onPasswordChanged={onPasswordChanged}
      {...propOverrides}
    />,
  );
  return { settings, onSave, onPasswordChanged, ...result };
}

beforeEach(() => {
  mockInvoke.mockReset();
  localStorage.setItem("clipor-lang", "ja");
  void i18n.changeLanguage("ja");
});

describe("SettingsView", () => {
  describe("form inputs render with correct values", () => {
    it("renders maxHistoryItems input", () => {
      renderSettings({ maxHistoryItems: 1000 });
      const input = screen.getByLabelText("履歴保持数") as HTMLInputElement;
      expect(input.value).toBe("1000");
    });

    it("renders pageSize input", () => {
      renderSettings({ pageSize: 50 });
      const input = screen.getByLabelText("ページサイズ") as HTMLInputElement;
      expect(input.value).toBe("50");
    });

    it("renders hotkey input", () => {
      renderSettings({ hotkey: "Alt+F2" });
      const input = screen.getByPlaceholderText("Ctrl+Alt+Z") as HTMLInputElement;
      expect(input.value).toBe("Alt+F2");
    });

    it("renders blurDelayMs input", () => {
      renderSettings({ blurDelayMs: 500 });
      const input = screen.getByLabelText("フォーカス移動遅延 (ms)") as HTMLInputElement;
      expect(input.value).toBe("500");
    });

    it("renders launchOnStartup checkbox", () => {
      renderSettings({ launchOnStartup: true });
      const checkbox = screen.getByLabelText("Windows 起動時に自動起動") as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });

    it("renders preview size inputs", () => {
      renderSettings({ previewWidth: 350, previewHeight: 450 });
      const label = screen.getByText("プレビューサイズ (W x H)");
      const container = label.closest("label")!;
      const inputs = container.querySelectorAll("input[type='number']");
      expect((inputs[0] as HTMLInputElement).value).toBe("350");
      expect((inputs[1] as HTMLInputElement).value).toBe("450");
    });

    it("renders image preview size inputs", () => {
      renderSettings({ previewImageWidth: 700, previewImageHeight: 800 });
      const label = screen.getByText("画像プレビューサイズ (W x H)");
      const container = label.closest("label")!;
      const inputs = container.querySelectorAll("input[type='number']");
      expect((inputs[0] as HTMLInputElement).value).toBe("700");
      expect((inputs[1] as HTMLInputElement).value).toBe("800");
    });
  });

  describe("form input changes", () => {
    it("updates maxHistoryItems", () => {
      renderSettings();
      const input = screen.getByLabelText("履歴保持数") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "2000" } });
      expect(input.value).toBe("2000");
    });

    it("updates pageSize", () => {
      renderSettings();
      const input = screen.getByLabelText("ページサイズ") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "30" } });
      expect(input.value).toBe("30");
    });

    it("updates hotkey", () => {
      renderSettings();
      const input = screen.getByPlaceholderText("Ctrl+Alt+Z") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "Ctrl+Shift+K" } });
      expect(input.value).toBe("Ctrl+Shift+K");
    });

    it("updates blurDelayMs", () => {
      renderSettings();
      const input = screen.getByLabelText("フォーカス移動遅延 (ms)") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "100" } });
      expect(input.value).toBe("100");
    });

    it("updates previewWidth", () => {
      renderSettings();
      const label = screen.getByText("プレビューサイズ (W x H)");
      const container = label.closest("label")!;
      const inputs = container.querySelectorAll("input[type='number']");
      fireEvent.change(inputs[0], { target: { value: "400" } });
      expect((inputs[0] as HTMLInputElement).value).toBe("400");
    });

    it("updates previewHeight", () => {
      renderSettings();
      const label = screen.getByText("プレビューサイズ (W x H)");
      const container = label.closest("label")!;
      const inputs = container.querySelectorAll("input[type='number']");
      fireEvent.change(inputs[1], { target: { value: "500" } });
      expect((inputs[1] as HTMLInputElement).value).toBe("500");
    });

    it("updates previewImageWidth", () => {
      renderSettings();
      const label = screen.getByText("画像プレビューサイズ (W x H)");
      const container = label.closest("label")!;
      const inputs = container.querySelectorAll("input[type='number']");
      fireEvent.change(inputs[0], { target: { value: "800" } });
      expect((inputs[0] as HTMLInputElement).value).toBe("800");
    });

    it("updates previewImageHeight", () => {
      renderSettings();
      const label = screen.getByText("画像プレビューサイズ (W x H)");
      const container = label.closest("label")!;
      const inputs = container.querySelectorAll("input[type='number']");
      fireEvent.change(inputs[1], { target: { value: "900" } });
      expect((inputs[1] as HTMLInputElement).value).toBe("900");
    });

    it("toggles launchOnStartup", () => {
      renderSettings({ launchOnStartup: false });
      const checkbox = screen.getByLabelText("Windows 起動時に自動起動") as HTMLInputElement;
      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(true);
    });
  });

  describe("form submission", () => {
    it("calls onSave with updated draft on blur", () => {
      const { onSave } = renderSettings();
      const input = screen.getByLabelText("履歴保持数") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "2000" } });
      fireEvent.blur(input);
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ maxHistoryItems: 2000 }),
      );
    });
  });

  describe("draft syncs with settings prop changes", () => {
    it("updates draft when settings prop changes", () => {
      const settings1 = defaultSettings({ maxHistoryItems: 100 });
      const onSave = vi.fn();
      const onPasswordChanged = vi.fn();
      const { rerender } = render(
        <SettingsView settings={settings1} onSave={onSave} onPasswordChanged={onPasswordChanged} />,
      );
      const input = screen.getByLabelText("履歴保持数") as HTMLInputElement;
      expect(input.value).toBe("100");

      const settings2 = defaultSettings({ maxHistoryItems: 999 });
      rerender(
        <SettingsView settings={settings2} onSave={onSave} onPasswordChanged={onPasswordChanged} />,
      );
      expect(input.value).toBe("999");
    });
  });

  describe("password flow when requirePassword=false", () => {
    it("shows Set password button", () => {
      renderSettings({ requirePassword: false });
      expect(screen.getByText("パスワードを設定")).toBeInTheDocument();
    });

    it("does not show Current password field", () => {
      renderSettings({ requirePassword: false });
      expect(screen.queryByLabelText("現在のパスワード")).not.toBeInTheDocument();
    });

    it("shows error when new password is empty", async () => {
      renderSettings({ requirePassword: false });
      await act(async () => {
        fireEvent.click(screen.getByText("パスワードを設定"));
      });
      expect(screen.getByText("パスワードを入力してください。")).toBeInTheDocument();
    });

    it("shows error when passwords do not match", async () => {
      renderSettings({ requirePassword: false });
      const inputs = screen.getAllByLabelText(/パスワード/) as HTMLInputElement[];
      // New password
      fireEvent.change(inputs[0], { target: { value: "abc123" } });
      // Confirm password
      fireEvent.change(inputs[1], { target: { value: "different" } });
      await act(async () => {
        fireEvent.click(screen.getByText("パスワードを設定"));
      });
      expect(screen.getByText("パスワードが一致しません。")).toBeInTheDocument();
    });

    it("sets password successfully", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      const { onPasswordChanged } = renderSettings({ requirePassword: false });
      const inputs = screen.getAllByLabelText(/パスワード/) as HTMLInputElement[];
      fireEvent.change(inputs[0], { target: { value: "abc123" } });
      fireEvent.change(inputs[1], { target: { value: "abc123" } });
      await act(async () => {
        fireEvent.click(screen.getByText("パスワードを設定"));
      });
      expect(mockInvoke).toHaveBeenCalledWith("set_password", { password: "abc123" });
      expect(screen.getByText("パスワードを設定しました。DB 内の履歴と定型文を暗号化しました。")).toBeInTheDocument();
      expect(onPasswordChanged).toHaveBeenCalled();
      // Fields should be cleared
      expect(inputs[0].value).toBe("");
      expect(inputs[1].value).toBe("");
    });

    it("shows error when invoke fails with Error", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("backend error"));
      renderSettings({ requirePassword: false });
      const inputs = screen.getAllByLabelText(/パスワード/) as HTMLInputElement[];
      fireEvent.change(inputs[0], { target: { value: "abc123" } });
      fireEvent.change(inputs[1], { target: { value: "abc123" } });
      await act(async () => {
        fireEvent.click(screen.getByText("パスワードを設定"));
      });
      expect(screen.getByText("backend error")).toBeInTheDocument();
    });

    it("shows generic error when invoke fails with non-Error", async () => {
      mockInvoke.mockRejectedValueOnce("string error");
      renderSettings({ requirePassword: false });
      const inputs = screen.getAllByLabelText(/パスワード/) as HTMLInputElement[];
      fireEvent.change(inputs[0], { target: { value: "abc123" } });
      fireEvent.change(inputs[1], { target: { value: "abc123" } });
      await act(async () => {
        fireEvent.click(screen.getByText("パスワードを設定"));
      });
      expect(screen.getByText("パスワード設定に失敗しました。")).toBeInTheDocument();
    });
  });

  describe("password flow when requirePassword=true", () => {
    it("shows Change password and Remove password buttons", () => {
      renderSettings({ requirePassword: true });
      expect(screen.getByText("パスワードを変更")).toBeInTheDocument();
      expect(screen.getByText("パスワードを解除")).toBeInTheDocument();
    });

    it("shows Current password field", () => {
      renderSettings({ requirePassword: true });
      expect(screen.getByLabelText("現在のパスワード")).toBeInTheDocument();
    });

    it("shows error when current password is empty on change", async () => {
      renderSettings({ requirePassword: true });
      const inputs = screen.getAllByLabelText(/パスワード/) as HTMLInputElement[];
      // New password
      fireEvent.change(inputs[1], { target: { value: "new123" } });
      // Confirm
      fireEvent.change(inputs[2], { target: { value: "new123" } });
      await act(async () => {
        fireEvent.click(screen.getByText("パスワードを変更"));
      });
      expect(screen.getByText("現在のパスワードを入力してください。")).toBeInTheDocument();
    });

    it("shows error when current password is wrong", async () => {
      mockInvoke.mockResolvedValueOnce(false);
      renderSettings({ requirePassword: true });
      const inputs = screen.getAllByLabelText(/パスワード/) as HTMLInputElement[];
      fireEvent.change(inputs[0], { target: { value: "wrong" } });
      fireEvent.change(inputs[1], { target: { value: "new123" } });
      fireEvent.change(inputs[2], { target: { value: "new123" } });
      await act(async () => {
        fireEvent.click(screen.getByText("パスワードを変更"));
      });
      expect(mockInvoke).toHaveBeenCalledWith("verify_password", { password: "wrong" });
      expect(screen.getByText("現在のパスワードが正しくありません。")).toBeInTheDocument();
    });

    it("changes password successfully", async () => {
      mockInvoke
        .mockResolvedValueOnce(true) // verify_password
        .mockResolvedValueOnce(undefined); // set_password
      const { onPasswordChanged } = renderSettings({ requirePassword: true });
      const inputs = screen.getAllByLabelText(/パスワード/) as HTMLInputElement[];
      fireEvent.change(inputs[0], { target: { value: "old123" } });
      fireEvent.change(inputs[1], { target: { value: "new123" } });
      fireEvent.change(inputs[2], { target: { value: "new123" } });
      await act(async () => {
        fireEvent.click(screen.getByText("パスワードを変更"));
      });
      expect(mockInvoke).toHaveBeenCalledWith("verify_password", { password: "old123" });
      expect(mockInvoke).toHaveBeenCalledWith("set_password", { password: "new123" });
      expect(screen.getByText("パスワードを変更しました。")).toBeInTheDocument();
      expect(onPasswordChanged).toHaveBeenCalled();
      // Fields should be cleared
      expect(inputs[0].value).toBe("");
      expect(inputs[1].value).toBe("");
      expect(inputs[2].value).toBe("");
    });

    it("shows error when new password is empty on change", async () => {
      renderSettings({ requirePassword: true });
      const inputs = screen.getAllByLabelText(/パスワード/) as HTMLInputElement[];
      fireEvent.change(inputs[0], { target: { value: "old123" } });
      // Leave new and confirm empty
      await act(async () => {
        fireEvent.click(screen.getByText("パスワードを変更"));
      });
      expect(screen.getByText("パスワードを入力してください。")).toBeInTheDocument();
    });

    it("shows mismatch error when passwords differ on change", async () => {
      renderSettings({ requirePassword: true });
      const inputs = screen.getAllByLabelText(/パスワード/) as HTMLInputElement[];
      fireEvent.change(inputs[0], { target: { value: "old123" } });
      fireEvent.change(inputs[1], { target: { value: "new123" } });
      fireEvent.change(inputs[2], { target: { value: "different" } });
      await act(async () => {
        fireEvent.click(screen.getByText("パスワードを変更"));
      });
      expect(screen.getByText("パスワードが一致しません。")).toBeInTheDocument();
    });

    describe("remove password", () => {
      it("shows error when current password is empty", async () => {
        renderSettings({ requirePassword: true });
        await act(async () => {
          fireEvent.click(screen.getByText("パスワードを解除"));
        });
        expect(screen.getByText("現在のパスワードを入力してください。")).toBeInTheDocument();
      });

      it("removes password successfully", async () => {
        mockInvoke.mockResolvedValueOnce(undefined);
        const { onPasswordChanged } = renderSettings({ requirePassword: true });
        const currentPwInput = screen.getByLabelText("現在のパスワード") as HTMLInputElement;
        fireEvent.change(currentPwInput, { target: { value: "old123" } });
        await act(async () => {
          fireEvent.click(screen.getByText("パスワードを解除"));
        });
        expect(mockInvoke).toHaveBeenCalledWith("remove_password", { currentPassword: "old123" });
        expect(screen.getByText("パスワードを解除しました。DB 内の履歴と定型文を復号しました。")).toBeInTheDocument();
        expect(onPasswordChanged).toHaveBeenCalled();
        expect(currentPwInput.value).toBe("");
      });

      it("shows error when remove invoke fails with Error", async () => {
        mockInvoke.mockRejectedValueOnce(new Error("remove fail"));
        renderSettings({ requirePassword: true });
        const currentPwInput = screen.getByLabelText("現在のパスワード") as HTMLInputElement;
        fireEvent.change(currentPwInput, { target: { value: "old123" } });
        await act(async () => {
          fireEvent.click(screen.getByText("パスワードを解除"));
        });
        expect(screen.getByText("remove fail")).toBeInTheDocument();
      });

      it("shows generic error when remove invoke fails with non-Error", async () => {
        mockInvoke.mockRejectedValueOnce("string error");
        renderSettings({ requirePassword: true });
        const currentPwInput = screen.getByLabelText("現在のパスワード") as HTMLInputElement;
        fireEvent.change(currentPwInput, { target: { value: "old123" } });
        await act(async () => {
          fireEvent.click(screen.getByText("パスワードを解除"));
        });
        expect(screen.getByText("パスワード解除に失敗しました。")).toBeInTheDocument();
      });
    });
  });

  describe("language switching", () => {
    it("renders language select with current language", () => {
      renderSettings();
      const select = screen.getByLabelText("言語") as HTMLSelectElement;
      expect(select).toBeInTheDocument();
    });

    it("changes language and saves to localStorage", () => {
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
      renderSettings();
      const select = screen.getByLabelText("言語") as HTMLSelectElement;
      fireEvent.change(select, { target: { value: "en" } });
      expect(setItemSpy).toHaveBeenCalledWith("clipor-lang", "en");
      setItemSpy.mockRestore();
    });

    it("rerenders labels in English after switching language", async () => {
      renderSettings();
      const select = screen.getByLabelText("言語") as HTMLSelectElement;

      fireEvent.change(select, { target: { value: "en" } });

      await waitFor(() => {
        expect(screen.getByLabelText("Language")).toBeInTheDocument();
      });
      expect(screen.getByLabelText("Launch on Windows startup")).toBeInTheDocument();
    });
  });

  describe("activation mode", () => {
    it("shows hotkey input when activationMode is hotkey", () => {
      renderSettings({ activationMode: "hotkey" });
      expect(screen.getByPlaceholderText("Ctrl+Alt+Z")).toBeInTheDocument();
    });

    it("hides hotkey input when activationMode is double-ctrl", () => {
      renderSettings({ activationMode: "double-ctrl" });
      expect(screen.queryByPlaceholderText("Ctrl+Alt+Z")).not.toBeInTheDocument();
    });

    it("hides hotkey input when activationMode is double-alt", () => {
      renderSettings({ activationMode: "double-alt" });
      expect(screen.queryByPlaceholderText("Ctrl+Alt+Z")).not.toBeInTheDocument();
    });

    it("switches activation mode via radio buttons", () => {
      renderSettings({ activationMode: "hotkey" });
      const doubleCtrlRadio = screen.getByLabelText("Ctrl x2") as HTMLInputElement;
      fireEvent.click(doubleCtrlRadio);
      expect(doubleCtrlRadio.checked).toBe(true);
      // Hotkey input should now be hidden
      expect(screen.queryByPlaceholderText("Ctrl+Alt+Z")).not.toBeInTheDocument();
    });

    it("shows hotkey input again when switching back to hotkey mode", () => {
      renderSettings({ activationMode: "double-ctrl" });
      expect(screen.queryByPlaceholderText("Ctrl+Alt+Z")).not.toBeInTheDocument();
      const hotkeyRadio = screen.getByLabelText("ホットキー") as HTMLInputElement;
      fireEvent.click(hotkeyRadio);
      expect(screen.getByPlaceholderText("Ctrl+Alt+Z")).toBeInTheDocument();
    });
  });

  describe("auto-save on checkbox change", () => {
    it("calls onSave immediately when launchOnStartup is toggled", () => {
      const { onSave } = renderSettings({ launchOnStartup: false });
      const checkbox = screen.getByLabelText("Windows 起動時に自動起動") as HTMLInputElement;
      fireEvent.click(checkbox);
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ launchOnStartup: true }),
      );
    });
  });

  describe("error/success messages", () => {
    it("does not show error or success initially", () => {
      renderSettings();
      // No error or success paragraphs
      const dangerPs = document.querySelectorAll('p[style*="danger"]');
      const accentPs = document.querySelectorAll('p[style*="accent"]');
      expect(dangerPs.length).toBe(0);
      expect(accentPs.length).toBe(0);
    });

    it("clears previous error when new action starts", async () => {
      renderSettings({ requirePassword: false });
      // Trigger an error first
      await act(async () => {
        fireEvent.click(screen.getByText("パスワードを設定"));
      });
      expect(screen.getByText("パスワードを入力してください。")).toBeInTheDocument();

      // Now fill in passwords and trigger again - the old error clears
      const inputs = screen.getAllByLabelText(/パスワード/) as HTMLInputElement[];
      fireEvent.change(inputs[0], { target: { value: "abc" } });
      fireEvent.change(inputs[1], { target: { value: "different" } });
      await act(async () => {
        fireEvent.click(screen.getByText("パスワードを設定"));
      });
      // Old error gone, new error shown
      expect(screen.queryByText("パスワードを入力してください。")).not.toBeInTheDocument();
      expect(screen.getByText("パスワードが一致しません。")).toBeInTheDocument();
    });
  });
});
