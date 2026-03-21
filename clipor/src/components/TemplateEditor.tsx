import { useCallback, useEffect, useRef, useState } from "react";
import type { TemplateEntry, TemplateGroup } from "../types";

interface TemplateEditorProps {
  groups: TemplateGroup[];
  editingTemplate: TemplateEntry | null;
  onSave: (payload: {
    id?: number;
    title: string;
    text: string;
    contentType?: string;
    imageData?: string | null;
    groupId?: number;
    newGroupName?: string;
  }) => void;
  onCancel: () => void;
  onExport: () => void;
  onImport: (json: string) => void;
}

function TemplateEditor({
  groups,
  editingTemplate,
  onSave,
  onCancel,
  onExport,
  onImport,
}: TemplateEditorProps) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [contentType, setContentType] = useState<"text" | "image">("text");
  const [imageData, setImageData] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<number | "new">("new");
  const [newGroupName, setNewGroupName] = useState("");
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importJson, setImportJson] = useState("");
  const importTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportSubmit = useCallback(() => {
    const trimmed = importJson.trim();
    if (trimmed) {
      onImport(trimmed);
    }
    setImportJson("");
    setShowImportDialog(false);
  }, [importJson, onImport]);

  const handleImportCancel = useCallback(() => {
    setImportJson("");
    setShowImportDialog(false);
  }, []);

  const handleImageSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) return;

    const MAX_SIZE = 2 * 1024 * 1024; // 2MB
    if (file.size > MAX_SIZE) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove "data:image/png;base64," prefix
      const base64 = result.split(",")[1];
      if (base64) {
        setImageData(base64);
        setContentType("image");
        if (!title.trim()) {
          setTitle(file.name.replace(/\.[^.]+$/, ""));
        }
        if (!text.trim()) {
          setText("[画像]");
        }
      }
    };
    reader.readAsDataURL(file);
    // Reset input so the same file can be selected again
    event.target.value = "";
  }, [title, text]);

  useEffect(() => {
    if (editingTemplate) {
      setTitle(editingTemplate.title);
      setText(editingTemplate.text);
      setContentType(editingTemplate.contentType === "image" ? "image" : "text");
      setImageData(editingTemplate.imageData ?? null);
      setGroupId(editingTemplate.groupId);
      setNewGroupName("");
      return;
    }

    setTitle("");
    setText("");
    setContentType("text");
    setImageData(null);
    setGroupId(groups[0]?.id ?? "new");
    setNewGroupName("");
  }, [editingTemplate, groups]);

  const handleSave = () => {
    if (!title.trim()) return;
    if (contentType === "text" && !text.trim()) return;
    if (contentType === "image" && !imageData) return;

    onSave({
      id: editingTemplate?.id,
      title: title.trim(),
      text: contentType === "image" ? (text.trim() || "[画像]") : text.trim(),
      contentType,
      imageData: contentType === "image" ? imageData : null,
      groupId: typeof groupId === "number" ? groupId : undefined,
      newGroupName: groupId === "new" ? newGroupName.trim() : undefined,
    });
  };

  const handleClearImage = () => {
    setContentType("text");
    setImageData(null);
    if (text === "[画像]") setText("");
  };

  return (
    <section className="editor-panel">
      <div className="field-grid">
        <label>
          <span>Title</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label>
          <span>Group</span>
          <select
            value={groupId}
            onChange={(event) =>
              setGroupId(event.target.value === "new" ? "new" : Number(event.target.value))
            }
          >
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
            <option value="new">+ New group</option>
          </select>
        </label>
      </div>
      {groupId === "new" ? (
        <label>
          <span>New group name</span>
          <input
            value={newGroupName}
            onChange={(event) => setNewGroupName(event.target.value)}
            placeholder="署名"
          />
        </label>
      ) : null}
      <div className="field-grid">
        <label>
          <span>Type</span>
          <select
            value={contentType}
            onChange={(event) => {
              const val = event.target.value as "text" | "image";
              setContentType(val);
              if (val === "text") {
                setImageData(null);
                if (text === "[画像]") setText("");
              }
            }}
          >
            <option value="text">Text</option>
            <option value="image">Image</option>
          </select>
        </label>
      </div>
      {contentType === "image" ? (
        <div className="image-upload-area">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            style={{ display: "none" }}
          />
          {imageData ? (
            <div className="image-preview-container">
              <img
                src={`data:image/png;base64,${imageData}`}
                alt="preview"
                className="template-image-preview"
              />
              <div className="row-actions">
                <button type="button" onClick={() => fileInputRef.current?.click()}>
                  Change
                </button>
                <button type="button" onClick={handleClearImage}>
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => fileInputRef.current?.click()}>
              Select image file
            </button>
          )}
        </div>
      ) : (
        <label>
          <span>Template body</span>
          <textarea
            rows={6}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={"{{date}} や {{clipboard}} を利用できます。"}
          />
        </label>
      )}
      <div className="row-actions">
        <button type="button" onClick={handleSave}>
          {editingTemplate ? "Update" : "Create"}
        </button>
        <button type="button" onClick={onCancel}>
          Clear
        </button>
        <button type="button" onClick={onExport}>
          Export JSON
        </button>
        <button
          type="button"
          onClick={() => {
            setImportJson("");
            setShowImportDialog(true);
          }}
        >
          Import JSON
        </button>
      </div>
      {showImportDialog ? (
        <div className="edit-overlay" onClick={handleImportCancel}>
          <div
            className="edit-dialog"
            onClick={(event) => event.stopPropagation()}
            style={{ width: 280 }}
          >
            <div className="edit-dialog-header">Import template JSON</div>
            <textarea
              ref={importTextareaRef}
              rows={8}
              value={importJson}
              onChange={(event) => setImportJson(event.target.value)}
              placeholder='{"groups":[...],"templates":[...]}'
              autoFocus
            />
            <div className="edit-dialog-actions">
              <button type="button" onClick={handleImportCancel}>
                Cancel
              </button>
              <button type="button" onClick={handleImportSubmit} disabled={!importJson.trim()}>
                Import
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default TemplateEditor;
