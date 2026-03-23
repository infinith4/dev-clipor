import { useCallback, useRef } from "react";
import type { HoverPreviewPayload, TemplateEntry } from "../types";

interface TemplateListProps {
  templates: TemplateEntry[];
  selectedTemplateId: number | null;
  onSelect: (template: TemplateEntry) => void;
  onPaste: (id: number) => void;
  onHoverPreview: (payload: HoverPreviewPayload & { anchorRect: DOMRect }) => void;
  onHoverPreviewEnd: () => void;
}

function TemplateItemRow({
  template,
  isSelected,
  onSelect,
  onPaste,
  onHoverPreview,
  onHoverPreviewEnd,
}: {
  template: TemplateEntry;
  isSelected: boolean;
  onSelect: (template: TemplateEntry) => void;
  onPaste: (id: number) => void;
  onHoverPreview: (payload: HoverPreviewPayload & { anchorRect: DOMRect }) => void;
  onHoverPreviewEnd: () => void;
}) {
  const isImage = template.contentType === "image" && template.imageData;
  const preview = template.text.replace(/\r?\n/g, " ").slice(0, 60);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemRef = useRef<HTMLElement | null>(null);

  const handleMouseEnter = useCallback(() => {
    hoverTimerRef.current = setTimeout(() => {
      const anchorRect = itemRef.current?.getBoundingClientRect();
      if (!anchorRect) {
        return;
      }

      onHoverPreview({
        anchorRect,
        title: template.title,
        text: isImage ? null : template.text,
        imageData: isImage ? (template.imageData ?? null) : null,
        charCount: null,
        copiedAt: null,
        contextLabel: template.groupName,
      });
    }, 300);
  }, [isImage, onHoverPreview, template]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    onHoverPreviewEnd();
  }, [onHoverPreviewEnd]);

  return (
    <article
      ref={itemRef}
      className={`panel-card${isSelected ? " selected" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => onPaste(template.id)}
      onFocus={() => onSelect(template)}
      onMouseEnter={() => onSelect(template)}
    >
      <div className="template-header">
        <div>
          <h3>{template.title}</h3>
          <span className="badge">{template.groupName}</span>
        </div>
      </div>
      {isImage ? (
        <img
          src={`data:image/png;base64,${template.imageData}`}
          alt={template.title}
          className="template-image-thumb"
        />
      ) : (
        <p className="template-text">{preview}</p>
      )}
    </article>
  );
}

function TemplateList({
  templates,
  selectedTemplateId,
  onSelect,
  onPaste,
  onHoverPreview,
  onHoverPreviewEnd,
}: TemplateListProps) {
  if (templates.length === 0) {
    return <div className="empty-state">定型文はまだありません。</div>;
  }

  return (
    <div className="card-list">
      {templates.map((template) => (
        <TemplateItemRow
          key={template.id}
          template={template}
          isSelected={selectedTemplateId === template.id}
          onSelect={onSelect}
          onPaste={onPaste}
          onHoverPreview={onHoverPreview}
          onHoverPreviewEnd={onHoverPreviewEnd}
        />
      ))}
    </div>
  );
}

export default TemplateList;
