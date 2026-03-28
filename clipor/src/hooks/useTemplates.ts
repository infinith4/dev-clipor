import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import i18n from "../i18n";
import type { TemplateEntry, TemplateExportPayload, TemplateGroup } from "../types";

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

export function useTemplates(setError: SetError) {
  const [groups, setGroups] = useState<TemplateGroup[]>([]);
  const [templates, setTemplates] = useState<TemplateEntry[]>([]);
  const [search, setSearch] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [groupResult, templateResult] = await Promise.all([
        invoke<TemplateGroup[]>("get_template_groups"),
        invoke<TemplateEntry[]>("get_templates", {
          search: search.trim() || null,
          groupId: selectedGroupId,
        }),
      ]);
      setGroups(groupResult);
      setTemplates(templateResult);
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : i18n.t("errors.templates_fetch"));
    }
  }, [search, selectedGroupId, setError]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
    search,
    selectedGroupId,
    setSearch,
    setSelectedGroupId,
    refresh,
    pasteTemplate,
    saveTemplate,
    deleteTemplate,
    exportTemplates,
    importTemplates,
  };
}
