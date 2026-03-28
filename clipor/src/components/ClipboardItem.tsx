import { useTranslation } from "react-i18next";
import type { ClipboardEntry } from "../types";

interface ClipboardItemProps {
  entry: ClipboardEntry;
  isSelected: boolean;
  onSelect: (id: number) => void;
  onPaste: (id: number) => void;
  onContextMenu: (event: React.MouseEvent, entry: ClipboardEntry) => void;
}

function ClipboardItem({
  entry,
  isSelected,
  onSelect,
  onPaste,
  onContextMenu,
}: ClipboardItemProps) {
  const { t } = useTranslation();
  const isImage = entry.contentType === "image";
  const preview = isImage ? t("content.image_placeholder") : entry.text.replace(/\r?\n/g, " ").slice(0, 80);

  return (
    <article
      className={`panel-card clipboard-item${isSelected ? " selected" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => onPaste(entry.id)}
      onFocus={() => onSelect(entry.id)}
      onContextMenu={(event) => {
        event.preventDefault();
        onContextMenu(event, entry);
      }}
      onMouseEnter={() => onSelect(entry.id)}
    >
      <div className="clipboard-body">
        {isImage && entry.imageData ? (
          <img
            src={`data:image/png;base64,${entry.imageData}`}
            alt={t("clipboard.image_alt_text")}
            className="clipboard-thumbnail"
          />
        ) : (
          <p>{preview}</p>
        )}
      </div>
      {entry.isPinned ? (
        <footer className="clipboard-meta">
          <span className="badge">Pin</span>
        </footer>
      ) : null}
    </article>
  );
}

export default ClipboardItem;
