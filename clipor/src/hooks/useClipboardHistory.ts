import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ClipboardEntry, ClipboardHistoryPage } from "../types";

type SetError = (message: string | null) => void;

export function useClipboardHistory(initialPageSize: number, setError: SetError) {
  const [entries, setEntries] = useState<ClipboardEntry[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPageSize(initialPageSize);
  }, [initialPageSize]);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const result = await invoke<ClipboardHistoryPage>("get_history", {
        page,
        pageSize,
        search: search.trim() || null,
      });
      setEntries(result.entries);
      setTotal(result.total);
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "履歴の取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, setError]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selectEntry = useCallback(
    async (id: number) => {
      try {
        await invoke("hide_preview").catch(() => {});
        await invoke("paste_history_entry", { id });
        setError(null);
      } catch (error) {
        setError(error instanceof Error ? error.message : "履歴の貼り付けに失敗しました。");
      }
    },
    [setError],
  );

  const togglePinned = useCallback(
    async (entry: ClipboardEntry) => {
      try {
        await invoke("set_history_pinned", { id: entry.id, pinned: !entry.isPinned });
        await refresh();
      } catch (error) {
        setError(error instanceof Error ? error.message : "ピン留め更新に失敗しました。");
      }
    },
    [refresh, setError],
  );

  const updateEntry = useCallback(
    async (id: number, text: string) => {
      try {
        await invoke("update_history_entry", { id, text });
        await refresh();
      } catch (error) {
        setError(error instanceof Error ? error.message : "履歴の更新に失敗しました。");
      }
    },
    [refresh, setError],
  );

  const deleteEntry = useCallback(
    async (id: number) => {
      try {
        await invoke("delete_history_entry", { id });
        if (entries.length === 1 && page > 1) {
          setPage((current) => current - 1);
          return;
        }
        await refresh();
      } catch (error) {
        setError(error instanceof Error ? error.message : "履歴の削除に失敗しました。");
      }
    },
    [entries.length, page, refresh, setError],
  );

  const setClipboardFormatted = useCallback(
    async (id: number) => {
      try {
        await invoke("set_clipboard_formatted", { id });
      } catch (error) {
        setError(error instanceof Error ? error.message : "整形に失敗しました。");
      }
    },
    [setError],
  );

  const setClipboardConverted = useCallback(
    async (id: number) => {
      try {
        await invoke("set_clipboard_converted", { id });
      } catch (error) {
        setError(error instanceof Error ? error.message : "変換に失敗しました。");
      }
    },
    [setError],
  );

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [pageSize, total]);

  return {
    entries,
    loading,
    page,
    pageSize,
    search,
    total,
    totalPages,
    setSearch: (value: string) => {
      setSearch(value);
      setPage(1);
    },
    nextPage: () => setPage((current) => Math.min(current + 1, totalPages)),
    previousPage: () => setPage((current) => Math.max(current - 1, 1)),
    refresh,
    selectEntry,
    updateEntry,
    togglePinned,
    deleteEntry,
    setClipboardFormatted,
    setClipboardConverted,
  };
}
