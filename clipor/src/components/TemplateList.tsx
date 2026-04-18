import { useTranslation } from "react-i18next";
import type { TemplateEntry } from "../types";

interface TemplateListProps {
  templates: TemplateEntry[];
  selectedTemplateId: number | null;
  onSelect: (template: TemplateEntry) => void;
  onPaste: (id: number) => void;
  onContextMenu?: (event: React.MouseEvent, template: TemplateEntry) => void;
}

function TemplateItemRow({
  template,
  isSelected,
  onSelect,
  onPaste,
  onContextMenu,
}: {
  template: TemplateEntry;
  isSelected: boolean;
  onSelect: (template: TemplateEntry) => void;
  onPaste: (id: number) => void;
  onContextMenu?: (event: React.MouseEvent, template: TemplateEntry) => void;
}) {
  const isImage = template.contentType === "image" && template.imageData;

  return (
    <article
      className={`panel-card clipboard-item${isSelected ? " selected" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => onPaste(template.id)}
      onFocus={() => onSelect(template)}
      onMouseEnter={() => onSelect(template)}
      onContextMenu={onContextMenu ? (event) => {
        event.preventDefault();
        onContextMenu(event, template);
      } : undefined}
    >
      <div className="clipboard-body">
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
      <div className="clipboard-meta">
        <span className="badge">{template.groupName}</span>
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
}: TemplateListProps) {
  const { t } = useTranslation();
  if (templates.length === 0) {
    return <div className="empty-state">{t("empty_state.no_templates")}</div>;
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
          onContextMenu={onContextMenu}
        />
      ))}
    </div>
  );
}

export default TemplateList;
