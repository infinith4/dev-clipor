import { useCallback, useEffect, useRef, useState } from "react";
import type { TemplateEntry, TemplateGroup } from "../types";

interface TemplateEditorProps {
  groups: TemplateGroup[];
  editingTemplate: TemplateEntry | null;
  onSave: (payload: {
    id?: number;
    title: string;
    text: string;
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
  const [groupId, setGroupId] = useState<number | "new">("new");
  const [newGroupName, setNewGroupName] = useState("");
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importJson, setImportJson] = useState("");
  const importTextareaRef = useRef<HTMLTextAreaElement>(null);

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

  useEffect(() => {
    if (editingTemplate) {
      setTitle(editingTemplate.title);
      setText(editingTemplate.text);
      setGroupId(editingTemplate.groupId);
      setNewGroupName("");
      return;
    }

    setTitle("");
    setText("");
    setGroupId(groups[0]?.id ?? "new");
    setNewGroupName("");
  }, [editingTemplate, groups]);

  const handleSave = () => {
    if (!title.trim() || !text.trim()) {
      return;
    }

    onSave({
      id: editingTemplate?.id,
      title: title.trim(),
      text: text.trim(),
      groupId: typeof groupId === "number" ? groupId : undefined,
      newGroupName: groupId === "new" ? newGroupName.trim() : undefined,
    });
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
      <label>
        <span>Template body</span>
        <textarea
          rows={6}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={"{{date}} や {{clipboard}} を利用できます。"}
        />
      </label>
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
