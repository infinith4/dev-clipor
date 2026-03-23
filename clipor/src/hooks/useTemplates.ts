import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
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
      setError(error instanceof Error ? error.message : "定型文の取得に失敗しました。");
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
        setError(error instanceof Error ? error.message : "定型文の貼り付けに失敗しました。");
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
        setError(error instanceof Error ? error.message : "定型文の保存に失敗しました。");
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
        setError(error instanceof Error ? error.message : "定型文の削除に失敗しました。");
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
      setError(error instanceof Error ? error.message : "定型文のエクスポートに失敗しました。");
      return null;
    }
  }, [setError]);

  const importTemplates = useCallback(
    async (json: string) => {
      const MAX_IMPORT_SIZE = 1024 * 1024; // 1MB
      if (json.length > MAX_IMPORT_SIZE) {
        setError(`インポートデータが大きすぎます（上限: ${MAX_IMPORT_SIZE / 1024}KB）。`);
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch {
        setError("無効なJSON形式です。正しいJSON文字列を入力してください。");
        return;
      }

      if (
        typeof parsed !== "object" ||
        parsed === null ||
        !Array.isArray((parsed as Record<string, unknown>).groups) ||
        !Array.isArray((parsed as Record<string, unknown>).templates)
      ) {
        setError("インポートデータの形式が正しくありません。groups と templates が必要です。");
        return;
      }

      try {
        await invoke("import_templates", { json });
        await refresh();
      } catch (error) {
        setError(error instanceof Error ? error.message : "定型文のインポートに失敗しました。");
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
