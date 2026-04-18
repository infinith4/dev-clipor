import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import i18n from "../i18n";
import type { TemplateEntry, TemplateExportPayload, TemplateGroup, TemplatePage } from "../types";

type SetError = (message: string | null) => void;

interface SaveTemplateInput {
  id?: number;
  title: string;
  text: string;
  contentType?: string;
  imageData?: string | null;
  groupId?: number;
  newGroupName?: string;
}

export function useTemplates(initialPageSize: number, setError: SetError) {
  const [groups, setGroups] = useState<TemplateGroup[]>([]);
  const [templates, setTemplates] = useState<TemplateEntry[]>([]);
  const [search, setSearch] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const pageRef = useRef(1);
  const totalRef = useRef(0);

  useEffect(() => {
    setPageSize(initialPageSize);
  }, [initialPageSize]);

  const doFetch = useCallback(async (targetPage: number) => {
    try {
      setLoading(true);
      const [groupResult, templateResult] = await Promise.all([
        invoke<TemplateGroup[]>("get_template_groups"),
        invoke<TemplatePage>("get_templates", {
          search: search.trim() || null,
          groupId: selectedGroupId,
          page: targetPage,
          pageSize,
        }),
      ]);
      setGroups(groupResult);
      setTemplates(templateResult.entries);
      setTotal(templateResult.total);
      totalRef.current = templateResult.total;
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : i18n.t("errors.templates_fetch"));
    } finally {
      setLoading(false);
    }
  }, [search, selectedGroupId, pageSize, setError]);

  useEffect(() => {
    pageRef.current = 1;
    setPage(1);
    void doFetch(1);
  }, [doFetch]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [pageSize, total],
  );

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

  const refresh = useCallback(async () => {
    pageRef.current = 1;
    setPage(1);
    await doFetch(1);
  }, [doFetch]);

  const pasteTemplate = useCallback(
    async (id: number) => {
      try {
        await invoke("hide_preview").catch(() => {});
        await invoke("paste_template", { id });
        setError(null);
      } catch (error) {
        setError(error instanceof Error ? error.message : i18n.t("errors.templates_paste"));
      }
    },
    [setError],
  );

  const saveTemplate = useCallback(
    async (payload: SaveTemplateInput) => {
      try {
        await invoke("upsert_template", {
          id: payload.id,
          title: payload.title,
          text: payload.text,
          contentType: payload.contentType ?? "text",
          imageData: payload.imageData ?? null,
          groupId: payload.groupId,
          newGroupName: payload.newGroupName,
        });
        await refresh();
      } catch (error) {
        setError(error instanceof Error ? error.message : i18n.t("errors.templates_save"));
      }
    },
    [refresh, setError],
  );

  const deleteTemplate = useCallback(
    async (id: number) => {
      try {
        await invoke("delete_template", { id });
        await refresh();
      } catch (error) {
        setError(error instanceof Error ? error.message : i18n.t("errors.templates_delete"));
      }
    },
    [refresh, setError],
  );

  const exportTemplates = useCallback(async () => {
    try {
      const payload = await invoke<TemplateExportPayload>("export_templates");
      const json = JSON.stringify(payload, null, 2);
      await navigator.clipboard.writeText(json);
      setError(null);
      return json;
    } catch (error) {
      setError(error instanceof Error ? error.message : i18n.t("errors.templates_export"));
      return null;
    }
  }, [setError]);

  const importTemplates = useCallback(
    async (json: string) => {
      const MAX_IMPORT_SIZE = 1024 * 1024; // 1MB
      if (json.length > MAX_IMPORT_SIZE) {
        setError(i18n.t("errors.templates_import_too_large", { sizeKb: MAX_IMPORT_SIZE / 1024 }));
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch {
        setError(i18n.t("errors.templates_import_invalid_json"));
        return;
      }

      if (
        typeof parsed !== "object" ||
        parsed === null ||
        !Array.isArray((parsed as Record<string, unknown>).groups) ||
        !Array.isArray((parsed as Record<string, unknown>).templates)
      ) {
        setError(i18n.t("errors.templates_import_invalid_format"));
        return;
      }

      try {
        await invoke("import_templates", { json });
        await refresh();
      } catch (error) {
        setError(error instanceof Error ? error.message : i18n.t("errors.templates_import"));
      }
    },
    [refresh, setError],
  );

  return {
    groups,
    templates,
    loading,
    page,
    pageSize,
    total,
    totalPages,
    search,
    selectedGroupId,
    setSearch: (value: string) => { setSearch(value); },
    setSelectedGroupId,
    nextPage,
    previousPage,
    refresh,
    pasteTemplate,
    saveTemplate,
    deleteTemplate,
    exportTemplates,
    importTemplates,
  };
}
