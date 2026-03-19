import { useEffect, useRef, useState } from "react";

interface TooltipPreviewProps {
  text?: string;
  imageData?: string | null;
  anchorRect: DOMRect | null;
}

function TooltipPreview({ text, imageData, anchorRect }: TooltipPreviewProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    if (!anchorRect || !tooltipRef.current) return;

    const tooltip = tooltipRef.current;
    const tooltipRect = tooltip.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // Try to place to the right of the popup window
    let left = windowWidth + 4;
    // If it overflows screen right, place to the left
    if (left + tooltipRect.width > screen.availWidth) {
      left = -tooltipRect.width - 4;
    }

    // Vertically align to the hovered item
    let top = anchorRect.top;
    if (top + tooltipRect.height > windowHeight) {
      top = windowHeight - tooltipRect.height - 4;
    }
    if (top < 0) top = 4;

    setPosition({ top, left });
  }, [anchorRect]);

  if (!anchorRect) return null;
  if (!text && !imageData) return null;

  return (
    <div
      ref={tooltipRef}
      className="tooltip-preview"
      style={{ top: position.top, left: position.left }}
    >
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
