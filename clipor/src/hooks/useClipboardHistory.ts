import { useCallback, useEffect, useRef, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import i18n from "../i18n";
import type { ClipboardEntry, ClipboardHistoryPage } from "../types";

type SetError = (message: string | null) => void;

export function useClipboardHistory(initialPageSize: number, setError: SetError) {
  const [entries, setEntries] = useState<ClipboardEntry[]>([]);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Refs to avoid stale closures in loadMore / IntersectionObserver callbacks
  const pageRef = useRef(1);
  const totalRef = useRef(0);
  const entriesLengthRef = useRef(0);

  useEffect(() => {
    setPageSize(initialPageSize);
  }, [initialPageSize]);

  // Core fetch helper. Recreated when search or pageSize changes.
  // append=false  → replace entries (reset to page 1)
  // append=true   → accumulate (load next page)
  const fetchPage = useCallback(
    async (targetPage: number, append: boolean) => {
      try {
        if (append) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }
        const result = await invoke<ClipboardHistoryPage>("get_history", {
          page: targetPage,
          pageSize,
          search: search.trim() || null,
        });
        if (append) {
          setEntries((prev) => [...prev, ...result.entries]);
        } else {
          setEntries(result.entries);
        }
        setTotal(result.total);
        totalRef.current = result.total;
        pageRef.current = targetPage;
        setError(null);
      } catch (error) {
        setError(
          error instanceof Error ? error.message : i18n.t("errors.history_fetch"),
        );
      } finally {
        if (append) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    },
    [pageSize, search, setError],
  );

  // Keep entriesLengthRef in sync for loadMore stale-closure safety
  useEffect(() => {
    entriesLengthRef.current = entries.length;
  }, [entries.length]);

  // Initial load + reload whenever search or pageSize changes (fetchPage identity changes)
  useEffect(() => {
    pageRef.current = 1;
    void fetchPage(1, false);
  }, [fetchPage]);

  // Full reset and re-fetch from page 1 (called on popup open, delete, pin-toggle)
  const refresh = useCallback(async () => {
    pageRef.current = 1;
    await fetchPage(1, false);
  }, [fetchPage]);

  // Append next page (called by scroll sentinel)
  const loadMore = useCallback(() => {
    const hasMore = entriesLengthRef.current < totalRef.current;
    if (!hasMore || loading || loadingMore) return;
    void fetchPage(pageRef.current + 1, true);
  }, [loading, loadingMore, fetchPage]);

  const hasMore = useMemo(
    () => entries.length < total,
    [entries.length, total],
  );

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
    loadingMore,
    hasMore,
    search,
    total,
    pageSize,
    setSearch: (value: string) => {
      setSearch(value);
      // fetchPage will auto-reset via useEffect when search state change
      // causes fetchPage identity to change
    },
    refresh,
    loadMore,
    selectEntry,
    updateEntry,
    togglePinned,
    deleteEntry,
    setClipboardFormatted,
    setClipboardConverted,
  };
}
