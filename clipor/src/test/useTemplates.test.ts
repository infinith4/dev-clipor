import { renderHook, act } from "@testing-library/react";
import { useTemplates } from "../hooks/useTemplates";
import type { TemplateEntry, TemplateGroup, TemplateExportPayload } from "../types";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

const makeGroup = (overrides: Partial<TemplateGroup> = {}): TemplateGroup => ({
  id: 1,
  name: "Default",
  sortOrder: 0,
  createdAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

const makeTemplate = (overrides: Partial<TemplateEntry> = {}): TemplateEntry => ({
  id: 1,
  groupId: 1,
  groupName: "Default",
  title: "Template 1",
  text: "hello",
  contentType: "text",
  imageData: null,
  sortOrder: 0,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

describe("useTemplates", () => {
  let setError: (message: string | null) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    setError = vi.fn<(message: string | null) => void>();
    // Default: both calls resolve to empty arrays
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "get_template_groups") return Promise.resolve([]);
      if (cmd === "get_templates") return Promise.resolve([]);
      return Promise.resolve(undefined);
    });
  });

  const setup = () => renderHook(() => useTemplates(setError));

  const waitForMount = async (result: { current: ReturnType<typeof useTemplates> }) => {
    await vi.waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("get_template_groups");
    });
  };

  it("fetches groups and templates on mount", async () => {
    const groups = [makeGroup()];
    const templates = [makeTemplate()];

    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "get_template_groups") return Promise.resolve(groups);
      if (cmd === "get_templates") return Promise.resolve(templates);
      return Promise.resolve(undefined);
    });

    const { result } = renderHook(() => useTemplates(setError));

    await vi.waitFor(() => {
      expect(result.current.groups).toEqual(groups);
    });

    expect(result.current.templates).toEqual(templates);
    expect(invokeMock).toHaveBeenCalledWith("get_templates", { search: null, groupId: null });
    expect(setError).toHaveBeenCalledWith(null);
  });

  it("sets error when refresh rejects with Error", async () => {
    invokeMock.mockRejectedValue(new Error("load fail"));

    const { result } = setup();

    await vi.waitFor(() => {
      expect(setError).toHaveBeenCalledWith("load fail");
    });

    expect(result.current.groups).toEqual([]);
    expect(result.current.templates).toEqual([]);
  });

  it("sets default error when refresh rejects with non-Error", async () => {
    invokeMock.mockRejectedValue("bad");

    setup();

    await vi.waitFor(() => {
      expect(setError).toHaveBeenCalledWith("定型文の取得に失敗しました。");
    });
  });

  describe("setSearch and setSelectedGroupId", () => {
    it("updates search and triggers refresh", async () => {
      const { result } = setup();

      await waitForMount(result);

      act(() => {
        result.current.setSearch("test");
      });

      expect(result.current.search).toBe("test");

      await vi.waitFor(() => {
        expect(invokeMock).toHaveBeenCalledWith("get_templates", { search: "test", groupId: null });
      });
    });

    it("sends null for empty/whitespace search", async () => {
      const { result } = setup();

      await waitForMount(result);

      act(() => {
        result.current.setSearch("   ");
      });

      await vi.waitFor(() => {
        // The hook trims and converts empty to null
        expect(invokeMock).toHaveBeenCalledWith("get_templates", { search: null, groupId: null });
      });
    });

    it("updates selectedGroupId", async () => {
      const { result } = setup();

      await waitForMount(result);

      act(() => {
        result.current.setSelectedGroupId(5);
      });

      expect(result.current.selectedGroupId).toBe(5);

      await vi.waitFor(() => {
        expect(invokeMock).toHaveBeenCalledWith("get_templates", { search: null, groupId: 5 });
      });
    });
  });

  describe("pasteTemplate", () => {
    it("calls hide_preview then paste_template", async () => {
      const { result } = setup();

      await waitForMount(result);

      invokeMock.mockResolvedValue(undefined);

      await act(async () => {
        await result.current.pasteTemplate(10);
      });

      expect(invokeMock).toHaveBeenCalledWith("hide_preview");
      expect(invokeMock).toHaveBeenCalledWith("paste_template", { id: 10 });
      expect(setError).toHaveBeenCalledWith(null);
    });

    it("continues when hide_preview rejects", async () => {
      const { result } = setup();

      await waitForMount(result);

      invokeMock.mockImplementation((cmd: string) => {
        if (cmd === "hide_preview") return Promise.reject(new Error("no window"));
        if (cmd === "get_template_groups") return Promise.resolve([]);
        if (cmd === "get_templates") return Promise.resolve([]);
        return Promise.resolve(undefined);
      });

      await act(async () => {
        await result.current.pasteTemplate(10);
      });

      expect(invokeMock).toHaveBeenCalledWith("paste_template", { id: 10 });
    });

    it("sets error when paste_template rejects with Error", async () => {
      const { result } = setup();

      await waitForMount(result);

      invokeMock.mockImplementation((cmd: string) => {
        if (cmd === "paste_template") return Promise.reject(new Error("paste fail"));
        if (cmd === "get_template_groups") return Promise.resolve([]);
        if (cmd === "get_templates") return Promise.resolve([]);
        return Promise.resolve(undefined);
      });

      await act(async () => {
        await result.current.pasteTemplate(1);
      });

      expect(setError).toHaveBeenCalledWith("paste fail");
    });

    it("sets default error when paste_template rejects with non-Error", async () => {
      const { result } = setup();

      await waitForMount(result);

      invokeMock.mockImplementation((cmd: string) => {
        if (cmd === "paste_template") return Promise.reject(42);
        if (cmd === "get_template_groups") return Promise.resolve([]);
        if (cmd === "get_templates") return Promise.resolve([]);
        return Promise.resolve(undefined);
      });

      await act(async () => {
        await result.current.pasteTemplate(1);
      });

      expect(setError).toHaveBeenCalledWith("定型文の貼り付けに失敗しました。");
    });
  });

  describe("saveTemplate", () => {
    it("calls upsert_template with correct args and refreshes", async () => {
      const { result } = setup();

      await waitForMount(result);

      await act(async () => {
        await result.current.saveTemplate({
          id: 5,
          title: "My Template",
          text: "body text",
          contentType: "text",
          imageData: "base64data",
          groupId: 2,
          newGroupName: "New Group",
        });
      });

      expect(invokeMock).toHaveBeenCalledWith("upsert_template", {
        id: 5,
        title: "My Template",
        text: "body text",
        contentType: "text",
        imageData: "base64data",
        groupId: 2,
        newGroupName: "New Group",
      });
    });

    it("defaults contentType to text and imageData to null", async () => {
      const { result } = setup();

      await waitForMount(result);

      await act(async () => {
        await result.current.saveTemplate({
          title: "T",
          text: "B",
        });
      });

      expect(invokeMock).toHaveBeenCalledWith("upsert_template", {
        id: undefined,
        title: "T",
        text: "B",
        contentType: "text",
        imageData: null,
        groupId: undefined,
        newGroupName: undefined,
      });
    });

    it("sets error when upsert_template rejects with Error", async () => {
      const { result } = setup();

      await waitForMount(result);

      invokeMock.mockRejectedValue(new Error("save fail"));

      await act(async () => {
        await result.current.saveTemplate({ title: "T", text: "B" });
      });

      expect(setError).toHaveBeenCalledWith("save fail");
    });

    it("sets default error when upsert_template rejects with non-Error", async () => {
      const { result } = setup();

      await waitForMount(result);

      invokeMock.mockRejectedValue(false);

      await act(async () => {
        await result.current.saveTemplate({ title: "T", text: "B" });
      });

      expect(setError).toHaveBeenCalledWith("定型文の保存に失敗しました。");
    });
  });

  describe("deleteTemplate", () => {
    it("calls delete_template and refreshes", async () => {
      const { result } = setup();

      await waitForMount(result);

      await act(async () => {
        await result.current.deleteTemplate(7);
      });

      expect(invokeMock).toHaveBeenCalledWith("delete_template", { id: 7 });
    });

    it("sets error when delete_template rejects with Error", async () => {
      const { result } = setup();

      await waitForMount(result);

      invokeMock.mockRejectedValue(new Error("delete fail"));

      await act(async () => {
        await result.current.deleteTemplate(1);
      });

      expect(setError).toHaveBeenCalledWith("delete fail");
    });

    it("sets default error when delete_template rejects with non-Error", async () => {
      const { result } = setup();

      await waitForMount(result);

      invokeMock.mockRejectedValue(null);

      await act(async () => {
        await result.current.deleteTemplate(1);
      });

      expect(setError).toHaveBeenCalledWith("定型文の削除に失敗しました。");
    });
  });

  describe("exportTemplates", () => {
    it("calls export_templates, copies to clipboard, and returns json", async () => {
      const payload: TemplateExportPayload = {
        groups: [makeGroup()],
        templates: [makeTemplate()],
      };

      const { result } = setup();

      await waitForMount(result);

      invokeMock.mockResolvedValue(payload);
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText: writeTextMock },
      });

      let jsonResult: string | null = null;
      await act(async () => {
        jsonResult = await result.current.exportTemplates();
      });

      expect(invokeMock).toHaveBeenCalledWith("export_templates");
      expect(writeTextMock).toHaveBeenCalledWith(JSON.stringify(payload, null, 2));
      expect(jsonResult).toBe(JSON.stringify(payload, null, 2));
      expect(setError).toHaveBeenCalledWith(null);
    });

    it("sets error and returns null when export_templates rejects with Error", async () => {
      const { result } = setup();

      await waitForMount(result);

      invokeMock.mockRejectedValue(new Error("export fail"));

      let jsonResult: string | null = "not null";
      await act(async () => {
        jsonResult = await result.current.exportTemplates();
      });

      expect(setError).toHaveBeenCalledWith("export fail");
      expect(jsonResult).toBeNull();
    });

    it("sets default error and returns null when export_templates rejects with non-Error", async () => {
      const { result } = setup();

      await waitForMount(result);

      invokeMock.mockRejectedValue(99);

      let jsonResult: string | null = "not null";
      await act(async () => {
        jsonResult = await result.current.exportTemplates();
      });

      expect(setError).toHaveBeenCalledWith("定型文のエクスポートに失敗しました。");
      expect(jsonResult).toBeNull();
    });
  });

  describe("importTemplates", () => {
    it("sets error when json is too large (> 1MB)", async () => {
      const { result } = setup();

      await waitForMount(result);

      const bigJson = "x".repeat(1024 * 1024 + 1);

      await act(async () => {
        await result.current.importTemplates(bigJson);
      });

      expect(setError).toHaveBeenCalledWith("インポートデータが大きすぎます（上限: 1024KB）。");
      expect(invokeMock).not.toHaveBeenCalledWith("import_templates", expect.anything());
    });

    it("sets error when json is invalid", async () => {
      const { result } = setup();

      await waitForMount(result);

      await act(async () => {
        await result.current.importTemplates("{not valid json");
      });

      expect(setError).toHaveBeenCalledWith(
        "無効なJSON形式です。正しいJSON文字列を入力してください。",
      );
    });

    it("sets error when parsed json has wrong format (missing groups)", async () => {
      const { result } = setup();

      await waitForMount(result);

      await act(async () => {
        await result.current.importTemplates(JSON.stringify({ templates: [] }));
      });

      expect(setError).toHaveBeenCalledWith(
        "インポートデータの形式が正しくありません。groups と templates が必要です。",
      );
    });

    it("sets error when parsed json has wrong format (missing templates)", async () => {
      const { result } = setup();

      await waitForMount(result);

      await act(async () => {
        await result.current.importTemplates(JSON.stringify({ groups: [] }));
      });

      expect(setError).toHaveBeenCalledWith(
        "インポートデータの形式が正しくありません。groups と templates が必要です。",
      );
    });

    it("sets error when parsed json is null", async () => {
      const { result } = setup();

      await waitForMount(result);

      await act(async () => {
        await result.current.importTemplates("null");
      });

      expect(setError).toHaveBeenCalledWith(
        "インポートデータの形式が正しくありません。groups と templates が必要です。",
      );
    });

    it("sets error when parsed json is an array (not object with groups/templates)", async () => {
      const { result } = setup();

      await waitForMount(result);

      await act(async () => {
        await result.current.importTemplates("[]");
      });

      expect(setError).toHaveBeenCalledWith(
        "インポートデータの形式が正しくありません。groups と templates が必要です。",
      );
    });

    it("sets error when groups is not an array", async () => {
      const { result } = setup();

      await waitForMount(result);

      await act(async () => {
        await result.current.importTemplates(
          JSON.stringify({ groups: "not array", templates: [] }),
        );
      });

      expect(setError).toHaveBeenCalledWith(
        "インポートデータの形式が正しくありません。groups と templates が必要です。",
      );
    });

    it("sets error when templates is not an array", async () => {
      const { result } = setup();

      await waitForMount(result);

      await act(async () => {
        await result.current.importTemplates(
          JSON.stringify({ groups: [], templates: "not array" }),
        );
      });

      expect(setError).toHaveBeenCalledWith(
        "インポートデータの形式が正しくありません。groups と templates が必要です。",
      );
    });

    it("calls import_templates and refreshes on valid json", async () => {
      const { result } = setup();

      await waitForMount(result);

      const validJson = JSON.stringify({ groups: [makeGroup()], templates: [makeTemplate()] });

      await act(async () => {
        await result.current.importTemplates(validJson);
      });

      expect(invokeMock).toHaveBeenCalledWith("import_templates", { json: validJson });
    });

    it("sets error when import_templates invoke rejects with Error", async () => {
      const { result } = setup();

      await waitForMount(result);

      invokeMock.mockImplementation((cmd: string) => {
        if (cmd === "import_templates") return Promise.reject(new Error("import fail"));
        if (cmd === "get_template_groups") return Promise.resolve([]);
        if (cmd === "get_templates") return Promise.resolve([]);
        return Promise.resolve(undefined);
      });

      const validJson = JSON.stringify({ groups: [], templates: [] });

      await act(async () => {
        await result.current.importTemplates(validJson);
      });

      expect(setError).toHaveBeenCalledWith("import fail");
    });

    it("sets default error when import_templates invoke rejects with non-Error", async () => {
      const { result } = setup();

      await waitForMount(result);

      invokeMock.mockImplementation((cmd: string) => {
        if (cmd === "import_templates") return Promise.reject(undefined);
        if (cmd === "get_template_groups") return Promise.resolve([]);
        if (cmd === "get_templates") return Promise.resolve([]);
        return Promise.resolve(undefined);
      });

      const validJson = JSON.stringify({ groups: [], templates: [] });

      await act(async () => {
        await result.current.importTemplates(validJson);
      });

      expect(setError).toHaveBeenCalledWith("定型文のインポートに失敗しました。");
    });
  });

  describe("refresh", () => {
    it("can be called manually", async () => {
      const { result } = setup();

      await waitForMount(result);

      const groups = [makeGroup()];
      const templates = [makeTemplate()];
      invokeMock.mockImplementation((cmd: string) => {
        if (cmd === "get_template_groups") return Promise.resolve(groups);
        if (cmd === "get_templates") return Promise.resolve(templates);
        return Promise.resolve(undefined);
      });

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.groups).toEqual(groups);
      expect(result.current.templates).toEqual(templates);
    });
  });
});
