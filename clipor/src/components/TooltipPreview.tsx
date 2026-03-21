import { useEffect, useRef, useState } from "react";

interface TooltipPreviewProps {
  title?: string;
  text?: string;
  imageData?: string | null;
  charCount?: number;
  copiedAt?: string;
  contextLabel?: string | null;
  anchorRect: DOMRect | null;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function TooltipPreview({
  title,
  text,
  imageData,
  charCount,
  copiedAt,
  contextLabel,
  anchorRect,
}: TooltipPreviewProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    if (!anchorRect || !tooltipRef.current) return;

    const tooltip = tooltipRef.current;
    const tooltipRect = tooltip.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // Position within the window as an overlay (Tauri webview clips to window bounds)
    const margin = 4;
    let left = Math.max(margin, (windowWidth - Math.min(tooltipRect.width, windowWidth - margin * 2)) / 2);
    let top = anchorRect.bottom + margin;

    // If tooltip overflows below, show above the anchor
    if (top + tooltipRect.height > windowHeight - margin) {
      top = anchorRect.top - tooltipRect.height - margin;
    }
    // If still overflows (top), pin to top
    if (top < margin) {
      top = margin;
    }

    setPosition({ top, left });
  }, [anchorRect, charCount, contextLabel, copiedAt, imageData, text, title]);

  if (!anchorRect) return null;
  if (!text && !imageData) return null;

  return (
    <div
      ref={tooltipRef}
      className="tooltip-preview"
      style={{ top: position.top, left: position.left }}
    >
      <div className="tooltip-preview-meta">
        {contextLabel ? <span>{contextLabel}</span> : null}
        {charCount != null && <span>{charCount}文字</span>}
        {copiedAt && <span>{formatDate(copiedAt)}</span>}
      </div>
      {title ? <div className="tooltip-preview-title">{title}</div> : null}
      <hr className="tooltip-preview-separator" />
      {imageData ? (
        <img
          src={`data:image/png;base64,${imageData}`}
          alt="preview"
          className="tooltip-preview-image"
        />
      ) : (
        <pre className="tooltip-preview-text">{text}</pre>
      )}
    </div>
  );
}

export default TooltipPreview;
