import { useCallback, useRef, useState } from "react";
import type { TemplateEntry } from "../types";
import TooltipPreview from "./TooltipPreview";

interface TemplateListProps {
  templates: TemplateEntry[];
  selectedTemplateId: number | null;
  onSelect: (template: TemplateEntry) => void;
  onPaste: (id: number) => void;
}

function TemplateItemRow({
  template,
  isSelected,
  onSelect,
  onPaste,
}: {
  template: TemplateEntry;
  isSelected: boolean;
  onSelect: (template: TemplateEntry) => void;
  onPaste: (id: number) => void;
}) {
  const preview = template.text.replace(/\r?\n/g, " ").slice(0, 60);
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null);
  const articleRef = useRef<HTMLElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    hoverTimerRef.current = setTimeout(() => {
      if (articleRef.current) {
        setHoverRect(articleRef.current.getBoundingClientRect());
      }
    }, 300);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setHoverRect(null);
  }, []);

  return (
    <article
      ref={articleRef}
      className={`panel-card${isSelected ? " selected" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => onPaste(template.id)}
      onFocus={() => onSelect(template)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="template-header">
        <div>
          <h3>{template.title}</h3>
          <span className="badge">{template.groupName}</span>
        </div>
      </div>
      <p className="template-text">{preview}</p>
      <TooltipPreview text={template.text} anchorRect={hoverRect} />
    </article>
  );
}

function TemplateList({ templates, selectedTemplateId, onSelect, onPaste }: TemplateListProps) {
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
        />
      ))}
    </div>
  );
}

export default TemplateList;
