import { render, screen, fireEvent, act } from "@testing-library/react";
import TemplateEditor from "../components/TemplateEditor";
import type { TemplateEntry, TemplateGroup } from "../types";

function makeGroup(overrides?: Partial<TemplateGroup>): TemplateGroup {
  return {
    id: 1,
    name: "Default",
    sortOrder: 0,
    createdAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeTemplate(overrides?: Partial<TemplateEntry>): TemplateEntry {
  return {
    id: 10,
    groupId: 1,
    groupName: "Default",
    title: "Greeting",
    text: "Hello {{name}}",
    contentType: "text",
    imageData: null,
    sortOrder: 0,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function defaultProps(overrides?: Partial<Parameters<typeof TemplateEditor>[0]>) {
  return {
    groups: [makeGroup(), makeGroup({ id: 2, name: "Signatures" })],
    editingTemplate: null as TemplateEntry | null,
    onSave: vi.fn(),
    onCancel: vi.fn(),
    onExport: vi.fn(),
    onImport: vi.fn(),
    ...overrides,
  };
}

describe("TemplateEditor", () => {
  describe("initial state (no editingTemplate)", () => {
    it("renders Create button", () => {
      render(<TemplateEditor {...defaultProps()} />);
      expect(screen.getByText("Create")).toBeInTheDocument();
    });

    it("renders empty title and text fields", () => {
      render(<TemplateEditor {...defaultProps()} />);
      const titleInput = screen.getByLabelText("Title") as HTMLInputElement;
      expect(titleInput.value).toBe("");
      const textarea = screen.getByLabelText("Template body") as HTMLTextAreaElement;
      expect(textarea.value).toBe("");
    });

    it("selects first group by default", () => {
      render(<TemplateEditor {...defaultProps()} />);
      const select = screen.getByLabelText("Group") as HTMLSelectElement;
      expect(select.value).toBe("1");
    });

    it("selects 'new' when groups is empty", () => {
      render(<TemplateEditor {...defaultProps({ groups: [] })} />);
      const select = screen.getByLabelText("Group") as HTMLSelectElement;
      expect(select.value).toBe("new");
    });
  });

  describe("editing an existing template", () => {
    it("renders Update button", () => {
      const template = makeTemplate();
      render(<TemplateEditor {...defaultProps({ editingTemplate: template })} />);
      expect(screen.getByText("Update")).toBeInTheDocument();
    });

    it("populates fields from editingTemplate", () => {
      const template = makeTemplate({ title: "Test", text: "Body text", groupId: 2 });
      render(<TemplateEditor {...defaultProps({ editingTemplate: template })} />);
      expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Test");
      expect((screen.getByLabelText("Template body") as HTMLTextAreaElement).value).toBe("Body text");
      expect((screen.getByLabelText("Group") as HTMLSelectElement).value).toBe("2");
    });

    it("sets contentType to image when editingTemplate is image", () => {
      const template = makeTemplate({
        contentType: "image",
        imageData: "base64data",
      });
      render(<TemplateEditor {...defaultProps({ editingTemplate: template })} />);
      const typeSelect = screen.getByLabelText("Type") as HTMLSelectElement;
      expect(typeSelect.value).toBe("image");
      // Should show image preview
      expect(screen.getByAltText("preview")).toBeInTheDocument();
    });

    it("clears form when editingTemplate becomes null", () => {
      const template = makeTemplate({ title: "Test", text: "Body" });
      const props = defaultProps({ editingTemplate: template });
      const { rerender } = render(<TemplateEditor {...props} />);
      expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Test");

      rerender(<TemplateEditor {...defaultProps({ editingTemplate: null })} />);
      expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("");
    });
  });

  describe("save", () => {
    it("does not call onSave when title is empty", () => {
      const props = defaultProps();
      render(<TemplateEditor {...props} />);
      fireEvent.change(screen.getByLabelText("Template body"), {
        target: { value: "Some body" },
      });
      fireEvent.click(screen.getByText("Create"));
      expect(props.onSave).not.toHaveBeenCalled();
    });

    it("does not call onSave when text is empty for text type", () => {
      const props = defaultProps();
      render(<TemplateEditor {...props} />);
      fireEvent.change(screen.getByLabelText("Title"), {
        target: { value: "Title" },
      });
      fireEvent.click(screen.getByText("Create"));
      expect(props.onSave).not.toHaveBeenCalled();
    });

    it("calls onSave with correct payload for new template with existing group", () => {
      const props = defaultProps();
      render(<TemplateEditor {...props} />);
      fireEvent.change(screen.getByLabelText("Title"), { target: { value: "My Title" } });
      fireEvent.change(screen.getByLabelText("Template body"), { target: { value: "My Body" } });
      fireEvent.change(screen.getByLabelText("Group"), { target: { value: "2" } });
      fireEvent.click(screen.getByText("Create"));
      expect(props.onSave).toHaveBeenCalledWith({
        id: undefined,
        title: "My Title",
        text: "My Body",
        contentType: "text",
        imageData: null,
        groupId: 2,
        newGroupName: undefined,
      });
    });

    it("calls onSave with newGroupName when group is 'new'", () => {
      const props = defaultProps();
      render(<TemplateEditor {...props} />);
      fireEvent.change(screen.getByLabelText("Title"), { target: { value: "T" } });
      fireEvent.change(screen.getByLabelText("Template body"), { target: { value: "B" } });
      fireEvent.change(screen.getByLabelText("Group"), { target: { value: "new" } });
      fireEvent.change(screen.getByLabelText("New group name"), { target: { value: "NewGrp" } });
      fireEvent.click(screen.getByText("Create"));
      expect(props.onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          groupId: undefined,
          newGroupName: "NewGrp",
        }),
      );
    });

    it("calls onSave with id when editing", () => {
      const template = makeTemplate({ id: 42 });
      const props = defaultProps({ editingTemplate: template });
      render(<TemplateEditor {...props} />);
      fireEvent.click(screen.getByText("Update"));
      expect(props.onSave).toHaveBeenCalledWith(
        expect.objectContaining({ id: 42 }),
      );
    });

    it("does not call onSave when contentType is image but no imageData", () => {
      const props = defaultProps();
      render(<TemplateEditor {...props} />);
      fireEvent.change(screen.getByLabelText("Title"), { target: { value: "T" } });
      fireEvent.change(screen.getByLabelText("Type"), { target: { value: "image" } });
      fireEvent.click(screen.getByText("Create"));
      expect(props.onSave).not.toHaveBeenCalled();
    });

    it("saves image template with default text [画像]", () => {
      const template = makeTemplate({
        contentType: "image",
        imageData: "base64",
        text: "",
      });
      const props = defaultProps({ editingTemplate: template });
      render(<TemplateEditor {...props} />);
      fireEvent.click(screen.getByText("Update"));
      expect(props.onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          text: "[画像]",
          contentType: "image",
          imageData: "base64",
        }),
      );
    });
  });

  describe("cancel", () => {
    it("calls onCancel", () => {
      const props = defaultProps();
      render(<TemplateEditor {...props} />);
      fireEvent.click(screen.getByText("Clear"));
      expect(props.onCancel).toHaveBeenCalled();
    });
  });

  describe("new group name field", () => {
    it("shows new group name input when group is 'new'", () => {
      render(<TemplateEditor {...defaultProps()} />);
      fireEvent.change(screen.getByLabelText("Group"), { target: { value: "new" } });
      expect(screen.getByLabelText("New group name")).toBeInTheDocument();
    });

    it("hides new group name input when group is not 'new'", () => {
      render(<TemplateEditor {...defaultProps()} />);
      expect(screen.queryByLabelText("New group name")).not.toBeInTheDocument();
    });
  });

  describe("contentType toggle", () => {
    it("switches to image mode", () => {
      render(<TemplateEditor {...defaultProps()} />);
      fireEvent.change(screen.getByLabelText("Type"), { target: { value: "image" } });
      expect(screen.getByText("Select image file")).toBeInTheDocument();
      expect(screen.queryByLabelText("Template body")).not.toBeInTheDocument();
    });

    it("switches back to text mode and clears imageData", () => {
      const template = makeTemplate({
        contentType: "image",
        imageData: "base64",
        text: "[画像]",
      });
      const { rerender } = render(
        <TemplateEditor {...defaultProps({ editingTemplate: template })} />,
      );
      // Change type back to text
      fireEvent.change(screen.getByLabelText("Type"), { target: { value: "text" } });
      expect(screen.getByLabelText("Template body")).toBeInTheDocument();
      // text "[画像]" should be cleared
      expect((screen.getByLabelText("Template body") as HTMLTextAreaElement).value).toBe("");
    });

    it("does not clear text when switching to text if text is not [画像]", () => {
      const template = makeTemplate({
        contentType: "image",
        imageData: "base64",
        text: "custom text",
      });
      render(<TemplateEditor {...defaultProps({ editingTemplate: template })} />);
      fireEvent.change(screen.getByLabelText("Type"), { target: { value: "text" } });
      expect((screen.getByLabelText("Template body") as HTMLTextAreaElement).value).toBe(
        "custom text",
      );
    });
  });

  describe("image upload", () => {
    function createFile(name: string, size: number, type: string): File {
      const content = new Uint8Array(size);
      return new File([content], name, { type });
    }

    it("does nothing when no file is selected", () => {
      render(<TemplateEditor {...defaultProps()} />);
      fireEvent.change(screen.getByLabelText("Type"), { target: { value: "image" } });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [] } });
      // Should still show "Select image file"
      expect(screen.getByText("Select image file")).toBeInTheDocument();
    });

    it("rejects non-image file", () => {
      render(<TemplateEditor {...defaultProps()} />);
      fireEvent.change(screen.getByLabelText("Type"), { target: { value: "image" } });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const textFile = createFile("test.txt", 100, "text/plain");
      fireEvent.change(fileInput, { target: { files: [textFile] } });
      expect(screen.getByText("Select image file")).toBeInTheDocument();
    });

    it("rejects oversized file (>2MB)", () => {
      render(<TemplateEditor {...defaultProps()} />);
      fireEvent.change(screen.getByLabelText("Type"), { target: { value: "image" } });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const bigFile = createFile("big.png", 3 * 1024 * 1024, "image/png");
      fireEvent.change(fileInput, { target: { files: [bigFile] } });
      expect(screen.getByText("Select image file")).toBeInTheDocument();
    });

    it("accepts valid image file and reads it", async () => {
      let capturedOnload: (() => void) | null = null;
      const mockReaderInstance = {
        readAsDataURL: vi.fn(),
        result: "data:image/png;base64,AAAA",
        onload: null as (() => void) | null,
      };
      const OriginalFileReader = globalThis.FileReader;
      globalThis.FileReader = class MockFileReader {
        readAsDataURL = (...args: unknown[]) => {
          mockReaderInstance.readAsDataURL(...args);
          // Capture the onload that was set
          capturedOnload = this.onload;
        };
        onload: (() => void) | null = null;
        result = mockReaderInstance.result;
      } as unknown as typeof FileReader;

      render(<TemplateEditor {...defaultProps()} />);
      fireEvent.change(screen.getByLabelText("Title"), { target: { value: "" } });
      fireEvent.change(screen.getByLabelText("Type"), { target: { value: "image" } });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const imageFile = createFile("photo.png", 100, "image/png");

      fireEvent.change(fileInput, { target: { files: [imageFile] } });
      // Trigger onload
      await act(async () => {
        capturedOnload?.();
      });

      // Should show preview image
      expect(screen.getByAltText("preview")).toBeInTheDocument();
      // Title should be set to filename without extension
      expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("photo");

      globalThis.FileReader = OriginalFileReader;
    });

    it("does not overwrite title if already filled", async () => {
      let capturedOnload: (() => void) | null = null;
      const OriginalFileReader = globalThis.FileReader;
      globalThis.FileReader = class MockFileReader {
        readAsDataURL = () => {
          capturedOnload = this.onload;
        };
        onload: (() => void) | null = null;
        result = "data:image/png;base64,BBBB";
      } as unknown as typeof FileReader;

      render(<TemplateEditor {...defaultProps()} />);
      fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Existing" } });
      fireEvent.change(screen.getByLabelText("Type"), { target: { value: "image" } });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const imageFile = createFile("photo.png", 100, "image/png");

      fireEvent.change(fileInput, { target: { files: [imageFile] } });
      await act(async () => {
        capturedOnload?.();
      });

      expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Existing");

      globalThis.FileReader = OriginalFileReader;
    });

    it("does not overwrite text if already filled", async () => {
      let capturedOnload: (() => void) | null = null;
      const OriginalFileReader = globalThis.FileReader;
      globalThis.FileReader = class MockFileReader {
        readAsDataURL = () => {
          capturedOnload = this.onload;
        };
        onload: (() => void) | null = null;
        result = "data:image/png;base64,CCCC";
      } as unknown as typeof FileReader;

      render(<TemplateEditor {...defaultProps()} />);
      fireEvent.change(screen.getByLabelText("Title"), { target: { value: "" } });
      // Set text before switching to image
      fireEvent.change(screen.getByLabelText("Template body"), { target: { value: "my text" } });
      fireEvent.change(screen.getByLabelText("Type"), { target: { value: "image" } });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const imageFile = createFile("photo.png", 100, "image/png");

      fireEvent.change(fileInput, { target: { files: [imageFile] } });
      await act(async () => {
        capturedOnload?.();
      });

      // text should remain as "my text", not "[画像]"
      // We can't directly check it since text field is hidden in image mode,
      // but we can verify by switching back to text
      fireEvent.change(screen.getByLabelText("Type"), { target: { value: "text" } });
      expect((screen.getByLabelText("Template body") as HTMLTextAreaElement).value).toBe("my text");

      globalThis.FileReader = OriginalFileReader;
    });

    it("handles base64 result without comma gracefully", async () => {
      let capturedOnload: (() => void) | null = null;
      const OriginalFileReader = globalThis.FileReader;
      globalThis.FileReader = class MockFileReader {
        readAsDataURL = () => {
          capturedOnload = this.onload;
        };
        onload: (() => void) | null = null;
        result = "nodataprefix";
      } as unknown as typeof FileReader;

      render(<TemplateEditor {...defaultProps()} />);
      fireEvent.change(screen.getByLabelText("Type"), { target: { value: "image" } });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const imageFile = createFile("photo.png", 100, "image/png");

      fireEvent.change(fileInput, { target: { files: [imageFile] } });
      await act(async () => {
        capturedOnload?.();
      });

      // Should still show "Select image file" since base64 is empty
      expect(screen.getByText("Select image file")).toBeInTheDocument();

      globalThis.FileReader = OriginalFileReader;
    });
  });

  describe("image preview controls", () => {
    it("shows Change and Remove buttons when imageData exists", () => {
      const template = makeTemplate({ contentType: "image", imageData: "base64" });
      render(<TemplateEditor {...defaultProps({ editingTemplate: template })} />);
      expect(screen.getByText("Change")).toBeInTheDocument();
      expect(screen.getByText("Remove")).toBeInTheDocument();
    });

    it("Remove clears image and sets type to text", () => {
      const template = makeTemplate({
        contentType: "image",
        imageData: "base64",
        text: "[画像]",
      });
      render(<TemplateEditor {...defaultProps({ editingTemplate: template })} />);
      fireEvent.click(screen.getByText("Remove"));
      expect(screen.getByLabelText("Template body")).toBeInTheDocument();
      expect((screen.getByLabelText("Template body") as HTMLTextAreaElement).value).toBe("");
    });

    it("Remove does not clear text if it is not [画像]", () => {
      const template = makeTemplate({
        contentType: "image",
        imageData: "base64",
        text: "custom",
      });
      render(<TemplateEditor {...defaultProps({ editingTemplate: template })} />);
      fireEvent.click(screen.getByText("Remove"));
      // Text should remain
      expect((screen.getByLabelText("Template body") as HTMLTextAreaElement).value).toBe("custom");
    });

    it("Change button triggers file input click", () => {
      const template = makeTemplate({ contentType: "image", imageData: "base64" });
      render(<TemplateEditor {...defaultProps({ editingTemplate: template })} />);
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const clickSpy = vi.spyOn(fileInput, "click");
      fireEvent.click(screen.getByText("Change"));
      expect(clickSpy).toHaveBeenCalled();
    });

    it("Select image file button triggers file input click", () => {
      render(<TemplateEditor {...defaultProps()} />);
      fireEvent.change(screen.getByLabelText("Type"), { target: { value: "image" } });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const clickSpy = vi.spyOn(fileInput, "click");
      fireEvent.click(screen.getByText("Select image file"));
      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe("export", () => {
    it("calls onExport when Export JSON is clicked", () => {
      const props = defaultProps();
      render(<TemplateEditor {...props} />);
      fireEvent.click(screen.getByText("Export JSON"));
      expect(props.onExport).toHaveBeenCalled();
    });
  });

  describe("import dialog", () => {
    it("opens import dialog when Import JSON is clicked", () => {
      render(<TemplateEditor {...defaultProps()} />);
      fireEvent.click(screen.getByText("Import JSON"));
      expect(screen.getByText("Import template JSON")).toBeInTheDocument();
    });

    it("import button is disabled when textarea is empty", () => {
      render(<TemplateEditor {...defaultProps()} />);
      fireEvent.click(screen.getByText("Import JSON"));
      const importBtn = screen.getAllByText("Import").find(
        (el) => el.tagName === "BUTTON" && el.closest(".edit-dialog-actions"),
      ) as HTMLButtonElement;
      expect(importBtn.disabled).toBe(true);
    });

    it("calls onImport with trimmed JSON when submitted", () => {
      const props = defaultProps();
      render(<TemplateEditor {...props} />);
      fireEvent.click(screen.getByText("Import JSON"));
      const textarea = screen.getByPlaceholderText('{"groups":[...],"templates":[...]}');
      fireEvent.change(textarea, { target: { value: '  {"groups":[]}  ' } });
      const importBtn = screen.getAllByText("Import").find(
        (el) => el.tagName === "BUTTON" && el.closest(".edit-dialog-actions"),
      ) as HTMLButtonElement;
      fireEvent.click(importBtn);
      expect(props.onImport).toHaveBeenCalledWith('{"groups":[]}');
      // Dialog should be closed
      expect(screen.queryByText("Import template JSON")).not.toBeInTheDocument();
    });

    it("does not call onImport when json is whitespace only (button disabled)", () => {
      const props = defaultProps();
      render(<TemplateEditor {...props} />);
      fireEvent.click(screen.getByText("Import JSON"));
      const textarea = screen.getByPlaceholderText('{"groups":[...],"templates":[...]}');
      fireEvent.change(textarea, { target: { value: "   " } });
      // Button is still disabled due to !importJson.trim()
      const importBtn = screen.getAllByText("Import").find(
        (el) => el.tagName === "BUTTON" && el.closest(".edit-dialog-actions"),
      ) as HTMLButtonElement;
      expect(importBtn.disabled).toBe(true);
    });


    it("closes dialog when cancel is clicked", () => {
      render(<TemplateEditor {...defaultProps()} />);
      fireEvent.click(screen.getByText("Import JSON"));
      expect(screen.getByText("Import template JSON")).toBeInTheDocument();
      const cancelBtn = screen.getAllByText("Cancel").find(
        (el) => el.tagName === "BUTTON" && el.closest(".edit-dialog-actions"),
      ) as HTMLButtonElement;
      fireEvent.click(cancelBtn);
      expect(screen.queryByText("Import template JSON")).not.toBeInTheDocument();
    });

    it("closes dialog when overlay is clicked", () => {
      render(<TemplateEditor {...defaultProps()} />);
      fireEvent.click(screen.getByText("Import JSON"));
      const overlay = document.querySelector(".edit-overlay")!;
      fireEvent.click(overlay);
      expect(screen.queryByText("Import template JSON")).not.toBeInTheDocument();
    });

    it("does not close dialog when dialog body is clicked", () => {
      render(<TemplateEditor {...defaultProps()} />);
      fireEvent.click(screen.getByText("Import JSON"));
      const dialog = document.querySelector(".edit-dialog")!;
      fireEvent.click(dialog);
      expect(screen.getByText("Import template JSON")).toBeInTheDocument();
    });
  });
});
