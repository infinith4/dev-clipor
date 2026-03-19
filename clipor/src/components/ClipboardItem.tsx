import type { ClipboardEntry } from "../types";

interface ClipboardItemProps {
  entry: ClipboardEntry;
  isSelected: boolean;
  onSelect: (id: number) => void;
  onPaste: (id: number) => void;
  onContextMenu: (event: React.MouseEvent, entry: ClipboardEntry) => void;
}

function ClipboardItem({ entry, isSelected, onSelect, onPaste, onContextMenu }: ClipboardItemProps) {
  const preview = entry.text.replace(/\r?\n/g, " ").slice(0, 80);

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
    >
      <div className="clipboard-body">
        <p>{preview}</p>
      </div>
      <footer className="clipboard-meta">
        {entry.isPinned ? <span className="badge">Pin</span> : null}
        <span>{entry.charCount}文字</span>
      </footer>
    </article>
  );
}

export default ClipboardItem;
