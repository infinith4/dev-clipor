import type { TemplateEntry } from "../types";

interface TemplateListProps {
  templates: TemplateEntry[];
  selectedTemplateId: number | null;
  onSelect: (template: TemplateEntry) => void;
  onPaste: (id: number) => void;
}

function TemplateList({ templates, selectedTemplateId, onSelect, onPaste }: TemplateListProps) {
  if (templates.length === 0) {
    return <div className="empty-state">定型文はまだありません。</div>;
  }

  return (
    <div className="card-list">
      {templates.map((template) => {
        const preview = template.text.replace(/\r?\n/g, " ").slice(0, 60);

        return (
          <article
            key={template.id}
            className={`panel-card${selectedTemplateId === template.id ? " selected" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => onPaste(template.id)}
            onFocus={() => onSelect(template)}
          >
            <div className="template-header">
              <div>
                <h3>{template.title}</h3>
                <span className="badge">{template.groupName}</span>
              </div>
            </div>
            <p className="template-text">{preview}</p>
          </article>
        );
      })}
    </div>
  );
}

export default TemplateList;
