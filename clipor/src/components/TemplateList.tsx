import { useEffect, useRef, useState } from "react";
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

interface DragState {
  sourceId: number;
  orderedIds: number[];
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
  const listRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [displayTemplates, setDisplayTemplates] = useState<TemplateEntry[]>(templates);

  // Keep displayTemplates in sync when templates prop changes and no drag in progress
  useEffect(() => {
    if (dragStateRef.current === null) {
      setDisplayTemplates(templates);
    }
  }, [templates]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const state = dragStateRef.current;
      if (!state || !listRef.current) return;

      // Find which item the cursor is over
      const items = listRef.current.querySelectorAll<HTMLElement>("[data-tid]");
      let overId: number | null = null;
      for (const item of items) {
        const rect = item.getBoundingClientRect();
        if (e.clientY >= rect.top && e.clientY < rect.bottom) {
          overId = Number(item.dataset.tid);
          break;
        }
      }

      if (overId === null || overId === state.sourceId) return;

      setDragOverId(overId);

      const current = [...state.orderedIds];
      const fromIdx = current.indexOf(state.sourceId);
      const toIdx = current.indexOf(overId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;

      current.splice(fromIdx, 1);
      current.splice(toIdx, 0, state.sourceId);
      state.orderedIds = current;

      const map = new Map(templates.map((t) => [t.id, t]));
      const reordered = current
        .map((id) => map.get(id))
        .filter((t): t is TemplateEntry => t !== undefined);
      setDisplayTemplates(reordered);
    };

    const onMouseUp = () => {
      const state = dragStateRef.current;
      if (state) {
        onReorder?.(state.orderedIds);
      }
      dragStateRef.current = null;
      setDragOverId(null);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [templates, onReorder]);

  if (templates.length === 0) {
    return <div className="empty-state">{t("empty_state.no_templates")}</div>;
  }

  const handleHandleMouseDown = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    dragStateRef.current = {
      sourceId: id,
      orderedIds: templates.map((t) => t.id),
    };
    setDisplayTemplates([...templates]);
  };

  return (
    <div className="card-list" ref={listRef}>
      {displayTemplates.map((template) => {
        const isImage = template.contentType === "image" && template.imageData;
        return (
          <article
            key={template.id}
            data-tid={template.id}
            className={`panel-card clipboard-item${selectedTemplateId === template.id ? " selected" : ""}${dragOverId === template.id ? " drag-over" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => {
              if (dragStateRef.current === null) onPaste(template.id);
            }}
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
          >
            <div className="clipboard-body">
              <span
                className="drag-handle"
                onMouseDown={(e) => handleHandleMouseDown(e, template.id)}
              >
                ⠿
              </span>
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
      })}
    </div>
  );
}

export default TemplateList;
