import { useCallback, useRef } from "react";
import type { ClipboardEntry, HoverPreviewPayload } from "../types";

interface ClipboardItemProps {
  entry: ClipboardEntry;
  isSelected: boolean;
  onSelect: (id: number) => void;
  onPaste: (id: number) => void;
  onContextMenu: (event: React.MouseEvent, entry: ClipboardEntry) => void;
  onHoverPreview: (payload: HoverPreviewPayload & { anchorRect: DOMRect }) => void;
  onHoverPreviewEnd: () => void;
}

function ClipboardItem({
  entry,
  isSelected,
  onSelect,
  onPaste,
  onContextMenu,
  onHoverPreview,
  onHoverPreviewEnd,
}: ClipboardItemProps) {
  const isImage = entry.contentType === "image";
  const preview = isImage ? "[画像]" : entry.text.replace(/\r?\n/g, " ").slice(0, 80);
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
        title: entry.sourceApp ?? undefined,
        text: isImage ? null : entry.text,
        imageData: isImage ? (entry.imageData ?? null) : null,
        charCount: entry.charCount,
        copiedAt: entry.copiedAt,
        contextLabel: isImage ? "画像" : "テキスト",
      });
    }, 300);
  }, [entry, isImage, onHoverPreview]);

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
      className={`panel-card clipboard-item${isSelected ? " selected" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => onPaste(entry.id)}
      onFocus={() => onSelect(entry.id)}
      onBlur={handleMouseLeave}
      onContextMenu={(event) => {
        event.preventDefault();
        onContextMenu(event, entry);
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="clipboard-body">
        {isImage && entry.imageData ? (
          <img
            src={`data:image/png;base64,${entry.imageData}`}
            alt="clipboard image"
            className="clipboard-thumbnail"
          />
        ) : (
          <p>{preview}</p>
        )}
      </div>
      <footer className="clipboard-meta">
        {entry.isPinned ? <span className="badge">Pin</span> : null}
        {isImage ? <span>画像</span> : <span>{entry.charCount}文字</span>}
      </footer>
    </article>
  );
}

export default ClipboardItem;
