import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TemplateEntry } from "../types";

interface TemplateListProps {
  templates: TemplateEntry[];
  selectedTemplateId: number | null;
  onSelect: (template: TemplateEntry) => void;
  onPaste: (id: number) => void;
  onContextMenu?: (event: React.MouseEvent, template: TemplateEntry) => void;
  onReorder?: (ids: number[]) => void;
}

function TemplateItemRow({
  template,
  isSelected,
  isDragOver,
  onSelect,
  onPaste,
  onContextMenu,
  onDragStart,
  onDragEnter,
  onDragEnd,
}: {
  template: TemplateEntry;
  isSelected: boolean;
  isDragOver: boolean;
  onSelect: (template: TemplateEntry) => void;
  onPaste: (id: number) => void;
  onContextMenu?: (event: React.MouseEvent, template: TemplateEntry) => void;
  onDragStart: (id: number) => void;
  onDragEnter: (id: number) => void;
  onDragEnd: () => void;
}) {
  const isImage = template.contentType === "image" && template.imageData;

  return (
    <article
      className={`panel-card clipboard-item${isSelected ? " selected" : ""}${isDragOver ? " drag-over" : ""}`}
      role="button"
      tabIndex={0}
      draggable
      onClick={() => onPaste(template.id)}
      onFocus={() => onSelect(template)}
      onMouseEnter={() => onSelect(template)}
      onContextMenu={
        onContextMenu
          ? (event) => {
              event.preventDefault();
              onContextMenu(event, template);
            }
          : undefined
      }
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        onDragStart(template.id);
      }}
      onDragEnter={(event) => {
        event.preventDefault();
        onDragEnter(template.id);
      }}
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDragEnd={onDragEnd}
    >
      <div className="clipboard-body">
        <span className="drag-handle">⠿</span>
        {isImage ? (
          <img
            src={`data:image/png;base64,${template.imageData}`}
            alt={template.title}
            className="clipboard-thumbnail"
          />
        ) : (
          <p>{template.title}</p>
        )}
      </div>
    </article>
  );
}

function TemplateList({
  templates,
  selectedTemplateId,
  onSelect,
  onPaste,
  onContextMenu,
  onReorder,
}: TemplateListProps) {
  const { t } = useTranslation();
  const [dragSourceId, setDragSourceId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const orderedRef = useRef<number[]>([]);

  if (templates.length === 0) {
    return <div className="empty-state">{t("empty_state.no_templates")}</div>;
  }

  const handleDragStart = (id: number) => {
    setDragSourceId(id);
    orderedRef.current = templates.map((t) => t.id);
  };

  const handleDragEnter = (id: number) => {
    if (dragSourceId === null || dragSourceId === id) return;
    setDragOverId(id);
    const current = [...orderedRef.current];
    const fromIndex = current.indexOf(dragSourceId);
    const toIndex = current.indexOf(id);
    if (fromIndex === -1 || toIndex === -1) return;
    current.splice(fromIndex, 1);
    current.splice(toIndex, 0, dragSourceId);
    orderedRef.current = current;
  };

  const handleDragEnd = () => {
    if (dragSourceId !== null && onReorder) {
      onReorder(orderedRef.current);
    }
    setDragSourceId(null);
    setDragOverId(null);
  };

  const displayOrder = dragSourceId !== null
    ? orderedRef.current
        .map((id) => templates.find((t) => t.id === id))
        .filter((t): t is TemplateEntry => t !== undefined)
    : templates;

  return (
    <div className="card-list">
      {displayOrder.map((template) => (
        <TemplateItemRow
          key={template.id}
          template={template}
          isSelected={selectedTemplateId === template.id}
          isDragOver={dragOverId === template.id}
          onSelect={onSelect}
          onPaste={onPaste}
          onContextMenu={onContextMenu}
          onDragStart={handleDragStart}
          onDragEnter={handleDragEnter}
          onDragEnd={handleDragEnd}
        />
      ))}
    </div>
  );
}

export default TemplateList;
