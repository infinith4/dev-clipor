import { renderHook, act } from "@testing-library/react";
import i18n from "../i18n";
import { useClipboardHistory } from "../hooks/useClipboardHistory";
import type { ClipboardEntry, ClipboardHistoryPage } from "../types";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

const makeEntry = (overrides: Partial<ClipboardEntry> = {}): ClipboardEntry => ({
  id: 1,
  text: "hello",
  copiedAt: "2026-01-01T00:00:00Z",
  isPinned: false,
  charCount: 5,
  sourceApp: null,
  contentType: "text",
  imageData: null,
  ...overrides,
});

const makePage = (entries: ClipboardEntry[], total: number): ClipboardHistoryPage => ({
  entries,
  total,
  page: 1,
  pageSize: 10,
});

describe("useClipboardHistory", () => {
  let setError: (message: string | null) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    setError = vi.fn<(message: string | null) => void>();
    invokeMock.mockResolvedValue(undefined);
    localStorage.setItem("clipor-lang", "ja");
    void i18n.changeLanguage("ja");
  });

  const setup = (pageSize = 10) => {
    invokeMock.mockResolvedValue(makePage([], 0));
    return renderHook(() => useClipboardHistory(pageSize, setError));
  };

  it("calls get_history on mount and sets entries", async () => {
    const entries = [makeEntry({ id: 1 }), makeEntry({ id: 2, text: "world" })];
    invokeMock.mockResolvedValue(makePage(entries, 2));

    const { result } = renderHook(() => useClipboardHistory(10, setError));

    await vi.waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(invokeMock).toHaveBeenCalledWith("get_history", {
      page: 1,
      pageSize: 10,
      search: null,
    });
    expect(result.current.entries).toEqual(entries);
    expect(result.current.total).toBe(2);
    expect(setError).toHaveBeenCalledWith(null);
  });

  it("sets error when get_history rejects with Error", async () => {
    invokeMock.mockRejectedValue(new Error("network fail"));

    const { result } = renderHook(() => useClipboardHistory(10, setError));

    await vi.waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(setError).toHaveBeenCalledWith("network fail");
  });

  it("sets default error when get_history rejects with non-Error", async () => {
    invokeMock.mockRejectedValue("string error");

    const { result } = renderHook(() => useClipboardHistory(10, setError));

    await vi.waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(setError).toHaveBeenCalledWith(i18n.t("errors.history_fetch"));
  });

  it("updates pageSize when initialPageSize changes", async () => {
    invokeMock.mockResolvedValue(makePage([], 0));

    const { result, rerender } = renderHook(
      ({ pageSize }) => useClipboardHistory(pageSize, setError),
      { initialProps: { pageSize: 10 } },
    );

    await vi.waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.pageSize).toBe(10);

    rerender({ pageSize: 20 });

    await vi.waitFor(() => {
      expect(result.current.pageSize).toBe(20);
    });
  });

  describe("setSearch", () => {
    it("updates search and resets page to 1", async () => {
      const { result } = setup();

      await vi.waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      invokeMock.mockResolvedValue(makePage([], 0));

      act(() => {
        result.current.setSearch("test");
      });

      expect(result.current.search).toBe("test");

      await vi.waitFor(() => {
        expect(invokeMock).toHaveBeenCalledWith(
          "get_history",
          expect.objectContaining({ search: "test", page: 1 }),
        );
      });
    });
  });

  describe("pagination", () => {
    it("nextPage increments page up to totalPages", async () => {
      const entries = [makeEntry()];
      invokeMock.mockResolvedValue(makePage(entries, 25));

      const { result } = renderHook(() => useClipboardHistory(10, setError));

      await vi.waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.totalPages).toBe(3);

      act(() => { result.current.nextPage(); });
      expect(result.current.page).toBe(2);

      act(() => { result.current.nextPage(); });
      expect(result.current.page).toBe(3);

      // Should not go past totalPages
      act(() => { result.current.nextPage(); });
      expect(result.current.page).toBe(3);
    });

    it("previousPage decrements page down to 1", async () => {
      const entries = [makeEntry()];
      invokeMock.mockResolvedValue(makePage(entries, 25));

      const { result } = renderHook(() => useClipboardHistory(10, setError));

      await vi.waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => { result.current.nextPage(); });
      act(() => { result.current.nextPage(); });
      expect(result.current.page).toBe(3);

      act(() => { result.current.previousPage(); });
      expect(result.current.page).toBe(2);

      act(() => { result.current.previousPage(); });
      expect(result.current.page).toBe(1);

      // Should not go below 1
      act(() => { result.current.previousPage(); });
      expect(result.current.page).toBe(1);
    });
  });

  describe("totalPages", () => {
    it("returns at least 1 when total is 0", async () => {
      invokeMock.mockResolvedValue(makePage([], 0));

      const { result } = renderHook(() => useClipboardHistory(10, setError));

      await vi.waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.totalPages).toBe(1);
    });
  });

  describe("selectEntry", () => {
    it("calls hide_preview then paste_history_entry", async () => {
      const { result } = setup();

      await vi.waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      invokeMock.mockResolvedValue(undefined);

      await act(async () => {
        await result.current.selectEntry(42);
      });

      expect(invokeMock).toHaveBeenCalledWith("hide_preview");
      expect(invokeMock).toHaveBeenCalledWith("paste_history_entry", { id: 42 });
      expect(setError).toHaveBeenCalledWith(null);
    });

    it("still calls paste_history_entry when hide_preview rejects", async () => {
      const { result } = setup();

      await vi.waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      invokeMock.mockImplementation((cmd: string) => {
        if (cmd === "hide_preview") return Promise.reject(new Error("no window"));
        return Promise.resolve(undefined);
      });

      await act(async () => {
        await result.current.selectEntry(7);
      });

      expect(invokeMock).toHaveBeenCalledWith("paste_history_entry", { id: 7 });
    });

    it("sets error when paste_history_entry rejects with Error", async () => {
      const { result } = setup();

      await vi.waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      invokeMock.mockImplementation((cmd: string) => {
        if (cmd === "paste_history_entry") return Promise.reject(new Error("paste fail"));
        return Promise.resolve(undefined);
      });

      await act(async () => {
        await result.current.selectEntry(1);
      });

      expect(setError).toHaveBeenCalledWith("paste fail");
    });

    it("sets default error when paste_history_entry rejects with non-Error", async () => {
      const { result } = setup();

      await vi.waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      invokeMock.mockImplementation((cmd: string) => {
        if (cmd === "paste_history_entry") return Promise.reject("string");
        return Promise.resolve(undefined);
      });

      await act(async () => {
        await result.current.selectEntry(1);
      });

      expect(setError).toHaveBeenCalledWith(i18n.t("errors.history_paste"));
    });
  });

  describe("togglePinned", () => {
    it("calls set_history_pinned with toggled value and refreshes", async () => {
      const entry = makeEntry({ id: 5, isPinned: false });
      invokeMock.mockResolvedValue(makePage([entry], 1));

      const { result } = renderHook(() => useClipboardHistory(10, setError));

      await vi.waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      invokeMock.mockResolvedValue(undefined);

      await act(async () => {
        await result.current.togglePinned(entry);
      });

      expect(invokeMock).toHaveBeenCalledWith("set_history_pinned", { id: 5, pinned: true });
    });

    it("calls set_history_pinned with false when entry is pinned", async () => {
      const entry = makeEntry({ id: 5, isPinned: true });
      const { result } = setup();

      await vi.waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      invokeMock.mockResolvedValue(undefined);

      await act(async () => {
        await result.current.togglePinned(entry);
      });

      expect(invokeMock).toHaveBeenCalledWith("set_history_pinned", { id: 5, pinned: false });
    });

    it("sets error when set_history_pinned rejects with Error", async () => {
      const { result } = setup();

      await vi.waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      invokeMock.mockRejectedValue(new Error("pin fail"));

      await act(async () => {
        await result.current.togglePinned(makeEntry());
      });

      expect(setError).toHaveBeenCalledWith("pin fail");
    });

    it("sets default error when set_history_pinned rejects with non-Error", async () => {
      const { result } = setup();

      await vi.waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      invokeMock.mockRejectedValue(42);

      await act(async () => {
        await result.current.togglePinned(makeEntry());
      });

      expect(setError).toHaveBeenCalledWith(i18n.t("errors.history_pin_update"));
    });
  });

  describe("updateEntry", () => {
    it("calls update_history_entry and refreshes", async () => {
      const { result } = setup();

      await vi.waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      invokeMock.mockResolvedValue(makePage([], 0));

      await act(async () => {
        await result.current.updateEntry(3, "new text");
      });

      expect(invokeMock).toHaveBeenCalledWith("update_history_entry", { id: 3, text: "new text" });
    });

    it("sets error when update_history_entry rejects with Error", async () => {
      const { result } = setup();

      await vi.waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      invokeMock.mockRejectedValue(new Error("update fail"));

      await act(async () => {
        await result.current.updateEntry(1, "x");
      });

      expect(setError).toHaveBeenCalledWith("update fail");
    });

    it("sets default error when update_history_entry rejects with non-Error", async () => {
      const { result } = setup();

      await vi.waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      invokeMock.mockRejectedValue(null);

      await act(async () => {
        await result.current.updateEntry(1, "x");
      });

      expect(setError).toHaveBeenCalledWith(i18n.t("errors.history_update"));
    });
  });

  describe("deleteEntry", () => {
    it("calls delete_history_entry and refreshes when more than 1 entry on page", async () => {
      const entries = [makeEntry({ id: 1 }), makeEntry({ id: 2 })];
      invokeMock.mockResolvedValue(makePage(entries, 2));

      const { result } = renderHook(() => useClipboardHistory(10, setError));

      await vi.waitFor(() => {
        expect(result.current.entries).toHaveLength(2);
      });

      invokeMock.mockResolvedValue(makePage([makeEntry({ id: 2 })], 1));

      await act(async () => {
        await result.current.deleteEntry(1);
      });

      expect(invokeMock).toHaveBeenCalledWith("delete_history_entry", { id: 1 });
    });

    it("deletes entry and refreshes from page 1 (infinite scroll)", async () => {
      const entries = [makeEntry({ id: 3 })];
      invokeMock.mockResolvedValue(makePage(entries, 15));

      const { result } = renderHook(() => useClipboardHistory(10, setError));

      await vi.waitFor(() => {
        expect(result.current.entries).toHaveLength(1);
      });

      // Delete an entry — should always call delete + refresh (no page decrement)
      invokeMock.mockResolvedValue(makePage([], 0));

      await act(async () => {
        await result.current.deleteEntry(3);
      });

      expect(invokeMock).toHaveBeenCalledWith("delete_history_entry", { id: 3 });
      // After delete, refresh is called — entries reset to page 1 result
      await vi.waitFor(() => {
        expect(result.current.entries).toHaveLength(0);
      });
    });

    it("sets error when delete_history_entry rejects with Error", async () => {
      const { result } = setup();

      await vi.waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      invokeMock.mockRejectedValue(new Error("delete fail"));

      await act(async () => {
        await result.current.deleteEntry(1);
      });

      expect(setError).toHaveBeenCalledWith("delete fail");
    });

    it("sets default error when delete_history_entry rejects with non-Error", async () => {
      const { result } = setup();

      await vi.waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      invokeMock.mockRejectedValue(undefined);

      await act(async () => {
        await result.current.deleteEntry(1);
      });

      expect(setError).toHaveBeenCalledWith(i18n.t("errors.history_delete"));
    });
  });

  describe("setClipboardFormatted", () => {
    it("calls set_clipboard_formatted", async () => {
      const { result } = setup();

      await vi.waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      invokeMock.mockResolvedValue(undefined);

      await act(async () => {
        await result.current.setClipboardFormatted(9);
      });

      expect(invokeMock).toHaveBeenCalledWith("set_clipboard_formatted", { id: 9 });
    });

    it("sets error when set_clipboard_formatted rejects with Error", async () => {
      const { result } = setup();

      await vi.waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      invokeMock.mockRejectedValue(new Error("format fail"));

      await act(async () => {
        await result.current.setClipboardFormatted(1);
      });

      expect(setError).toHaveBeenCalledWith("format fail");
    });

    it("sets default error when set_clipboard_formatted rejects with non-Error", async () => {
      const { result } = setup();

      await vi.waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      invokeMock.mockRejectedValue("oops");

      await act(async () => {
        await result.current.setClipboardFormatted(1);
      });

      expect(setError).toHaveBeenCalledWith(i18n.t("errors.clipboard_format"));
    });
  });

  describe("setClipboardConverted", () => {
    it("calls set_clipboard_converted", async () => {
      const { result } = setup();

      await vi.waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      invokeMock.mockResolvedValue(undefined);

      await act(async () => {
        await result.current.setClipboardConverted(8);
      });

      expect(invokeMock).toHaveBeenCalledWith("set_clipboard_converted", { id: 8 });
    });

    it("sets error when set_clipboard_converted rejects with Error", async () => {
      const { result } = setup();

      await vi.waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      invokeMock.mockRejectedValue(new Error("convert fail"));

      await act(async () => {
        await result.current.setClipboardConverted(1);
      });

      expect(setError).toHaveBeenCalledWith("convert fail");
    });

    it("sets default error when set_clipboard_converted rejects with non-Error", async () => {
      const { result } = setup();

      await vi.waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      invokeMock.mockRejectedValue(false);

      await act(async () => {
        await result.current.setClipboardConverted(1);
      });

      expect(setError).toHaveBeenCalledWith(i18n.t("errors.clipboard_convert"));
    });
  });

  describe("refresh", () => {
    it("sends trimmed search string", async () => {
      invokeMock.mockResolvedValue(makePage([], 0));

      const { result } = renderHook(() => useClipboardHistory(10, setError));

      await vi.waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.setSearch("  foo  ");
      });

      await vi.waitFor(() => {
        expect(invokeMock).toHaveBeenCalledWith("get_history", {
          page: 1,
          pageSize: 10,
          search: "foo",
        });
      });
    });

    it("deleting the only entry refreshes to an empty list", async () => {
      const entries = [makeEntry({ id: 1 })];
      invokeMock.mockResolvedValue(makePage(entries, 1));

      const { result } = renderHook(() => useClipboardHistory(10, setError));

      await vi.waitFor(() => {
        expect(result.current.entries).toHaveLength(1);
      });

      invokeMock.mockResolvedValue(makePage([], 0));

      await act(async () => {
        await result.current.deleteEntry(1);
      });

      expect(invokeMock).toHaveBeenCalledWith("delete_history_entry", { id: 1 });

      await vi.waitFor(() => {
        expect(result.current.entries).toHaveLength(0);
      });
    });

    it("updates pageSize when initialPageSize prop changes", async () => {
      invokeMock.mockResolvedValue(makePage([], 0));

      const { result, rerender } = renderHook(
        ({ pageSize }: { pageSize: number }) => useClipboardHistory(pageSize, setError),
        { initialProps: { pageSize: 10 } },
      );

      await vi.waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.pageSize).toBe(10);

      rerender({ pageSize: 25 });

      await vi.waitFor(() => {
        expect(result.current.pageSize).toBe(25);
      });
    });

    it("sends null when search is only whitespace", async () => {
      invokeMock.mockResolvedValue(makePage([], 0));

      const { result } = renderHook(() => useClipboardHistory(10, setError));

      await vi.waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.setSearch("   ");
      });

      await vi.waitFor(() => {
        expect(invokeMock).toHaveBeenCalledWith("get_history", {
          page: 1,
          pageSize: 10,
          search: null,
        });
      });
    });
  });
});
