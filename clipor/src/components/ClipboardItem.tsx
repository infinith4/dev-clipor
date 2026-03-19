import { useCallback, useRef, useState } from "react";
import type { ClipboardEntry } from "../types";
import TooltipPreview from "./TooltipPreview";

interface ClipboardItemProps {
  entry: ClipboardEntry;
  isSelected: boolean;
  onSelect: (id: number) => void;
  onPaste: (id: number) => void;
  onContextMenu: (event: React.MouseEvent, entry: ClipboardEntry) => void;
}

function ClipboardItem({ entry, isSelected, onSelect, onPaste, onContextMenu }: ClipboardItemProps) {
  const preview = entry.text.replace(/\r?\n/g, " ").slice(0, 80);
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
      className={`panel-card clipboard-item${isSelected ? " selected" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => onPaste(entry.id)}
      onFocus={() => onSelect(entry.id)}
      onContextMenu={(event) => {
        event.preventDefault();
        onContextMenu(event, entry);
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="clipboard-body">
        <p>{preview}</p>
      </div>
      <footer className="clipboard-meta">
        {entry.isPinned ? <span className="badge">Pin</span> : null}
        <span>{entry.charCount}文字</span>
      </footer>
      <TooltipPreview text={entry.text} anchorRect={hoverRect} />
    </article>
  );
}

export default ClipboardItem;
