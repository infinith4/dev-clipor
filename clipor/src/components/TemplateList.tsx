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

  // refs for synchronous access inside drag event handlers
  const dragSourceIdRef = useRef<number | null>(null);
  const orderedIdsRef = useRef<number[]>([]);

  // state only to trigger re-render for visual update
  const [displayTemplates, setDisplayTemplates] = useState<TemplateEntry[]>(templates);
  const [dragOverId, setDragOverId] = useState<number | null>(null);

  // Sync displayTemplates when templates prop changes (and no drag in progress)
  const prevTemplatesRef = useRef(templates);
  if (prevTemplatesRef.current !== templates && dragSourceIdRef.current === null) {
    prevTemplatesRef.current = templates;
    setDisplayTemplates(templates);
  }

  if (templates.length === 0) {
    return <div className="empty-state">{t("empty_state.no_templates")}</div>;
  }

  const handleDragStart = (id: number) => {
    dragSourceIdRef.current = id;
    orderedIdsRef.current = templates.map((t) => t.id);
    setDisplayTemplates([...templates]);
  };

  const handleDragEnter = (id: number) => {
    const sourceId = dragSourceIdRef.current;
    if (sourceId === null || sourceId === id) return;

    setDragOverId(id);

    const current = [...orderedIdsRef.current];
    const fromIndex = current.indexOf(sourceId);
    const toIndex = current.indexOf(id);
    if (fromIndex === -1 || toIndex === -1) return;
    current.splice(fromIndex, 1);
    current.splice(toIndex, 0, sourceId);
    orderedIdsRef.current = current;

    // Re-build display list from the new order
    const templateMap = new Map(templates.map((t) => [t.id, t]));
    const reordered = current
      .map((tid) => templateMap.get(tid))
      .filter((t): t is TemplateEntry => t !== undefined);
    setDisplayTemplates(reordered);
  };

  const handleDragEnd = () => {
    if (dragSourceIdRef.current !== null && onReorder) {
      onReorder(orderedIdsRef.current);
    }
    dragSourceIdRef.current = null;
    setDragOverId(null);
  };

  return (
    <div className="card-list">
      {displayTemplates.map((template) => (
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
