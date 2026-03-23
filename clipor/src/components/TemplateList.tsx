import type { TemplateEntry } from "../types";

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
  const isImage = template.contentType === "image" && template.imageData;
  const preview = template.text.replace(/\r?\n/g, " ").slice(0, 60);

  return (
    <article
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
        />
      ))}
    </div>
  );
}

export default TemplateList;
