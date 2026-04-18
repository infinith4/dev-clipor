import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import i18n from "../i18n";
import type { ClipboardEntry, ClipboardHistoryPage } from "../types";

type SetError = (message: string | null) => void;

export function useClipboardHistory(initialPageSize: number, setError: SetError) {
  const [entries, setEntries] = useState<ClipboardEntry[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Refs to avoid stale closures in nextPage/previousPage/refresh
  const pageRef = useRef(1);
  const totalRef = useRef(0);

  useEffect(() => {
    setPageSize(initialPageSize);
  }, [initialPageSize]);

  // Core fetch. Recreated only when search or pageSize changes.
  const doFetch = useCallback(async (targetPage: number) => {
    try {
      setLoading(true);
      const result = await invoke<ClipboardHistoryPage>("get_history", {
        page: targetPage,
        pageSize,
        search: search.trim() || null,
      });
      setEntries(result.entries);
      setTotal(result.total);
      totalRef.current = result.total;
      setError(null);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : i18n.t("errors.history_fetch"),
      );
    } finally {
      setLoading(false);
    }
  }, [pageSize, search, setError]);

  // Initial load + auto-reload when search or pageSize changes (doFetch identity changes)
  useEffect(() => {
    pageRef.current = 1;
    setPage(1);
    void doFetch(1);
  }, [doFetch]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [pageSize, total],
  );

  // Page navigation: update ref+state synchronously, fetch asynchronously
  const nextPage = useCallback(() => {
    const maxPage = Math.max(1, Math.ceil(totalRef.current / pageSize));
    const next = Math.min(pageRef.current + 1, maxPage);
    if (next === pageRef.current) return;
    pageRef.current = next;
    setPage(next);
    void doFetch(next);
  }, [doFetch, pageSize]);

  const previousPage = useCallback(() => {
    const prev = Math.max(pageRef.current - 1, 1);
    if (prev === pageRef.current) return;
    pageRef.current = prev;
    setPage(prev);
    void doFetch(prev);
  }, [doFetch]);

  // Reset to page 1 and re-fetch (called on popup open, delete, pin-toggle)
  const refresh = useCallback(async () => {
    pageRef.current = 1;
    setPage(1);
    await doFetch(1);
  }, [doFetch]);

  const selectEntry = useCallback(
    async (id: number) => {
      try {
        await invoke("hide_preview").catch(() => {});
        await invoke("paste_history_entry", { id });
        setError(null);
      } catch (error) {
        setError(
          error instanceof Error ? error.message : i18n.t("errors.history_paste"),
        );
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
        setError(
          error instanceof Error ? error.message : i18n.t("errors.history_pin_update"),
        );
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
        setError(
          error instanceof Error ? error.message : i18n.t("errors.history_update"),
        );
      }
    },
    [refresh, setError],
  );

  const deleteEntry = useCallback(
    async (id: number) => {
      try {
        await invoke("delete_history_entry", { id });
        await refresh();
      } catch (error) {
        setError(
          error instanceof Error ? error.message : i18n.t("errors.history_delete"),
        );
      }
    },
    [refresh, setError],
  );

  const setClipboardFormatted = useCallback(
    async (id: number) => {
      try {
        await invoke("set_clipboard_formatted", { id });
      } catch (error) {
        setError(
          error instanceof Error ? error.message : i18n.t("errors.clipboard_format"),
        );
      }
    },
    [setError],
  );

  const setClipboardConverted = useCallback(
    async (id: number) => {
      try {
        await invoke("set_clipboard_converted", { id });
      } catch (error) {
        setError(
          error instanceof Error ? error.message : i18n.t("errors.clipboard_convert"),
        );
      }
    },
    [setError],
  );

  return {
    entries,
    loading,
    page,
    pageSize,
    search,
    total,
    totalPages,
    // setSearch just updates state; doFetch auto-resets to page 1 via useEffect
    setSearch: (value: string) => { setSearch(value); },
    nextPage,
    previousPage,
    refresh,
    selectEntry,
    updateEntry,
    togglePinned,
    deleteEntry,
    setClipboardFormatted,
    setClipboardConverted,
  };
}
