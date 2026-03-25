import { useEffect, useRef, useState } from "react";

export interface MenuItem {
  label: string;
  action?: () => void;
  danger?: boolean;
  children?: MenuItem[];
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

function SubMenu({ items, parentRect, onClose }: {
  items: MenuItem[];
  parentRect: DOMRect;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const style: React.CSSProperties = {
    position: "fixed",
    left: parentRect.right,
    top: parentRect.top,
    zIndex: 10000,
  };

  return (
    <div ref={ref} className="context-menu submenu" style={style}>
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          className={`context-menu-item${item.danger ? " danger" : ""}`}
          onClick={() => {
            item.action?.();
            onClose();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [openSub, setOpenSub] = useState<string | null>(null);
  const [subRect, setSubRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const style: React.CSSProperties = {
    position: "fixed",
    left: x,
    top: y,
    zIndex: 9999,
  };

  return (
    <div ref={menuRef} className="context-menu" style={style}>
      {items.map((item) => {
        if (item.children) {
          return (
            <div
              key={item.label}
              className="context-menu-parent"
              onMouseEnter={(e) => {
                setOpenSub(item.label);
                setSubRect((e.currentTarget as HTMLElement).getBoundingClientRect());
              }}
              onMouseLeave={() => setOpenSub(null)}
            >
              <button
                type="button"
                className="context-menu-item has-children"
              >
                {item.label}
                <span className="submenu-arrow">▶</span>
              </button>
              {openSub === item.label && subRect ? (
                <SubMenu
                  items={item.children}
                  parentRect={subRect}
                  onClose={onClose}
                />
              ) : null}
            </div>
          );
        }

        return (
          <button
            key={item.label}
            type="button"
            className={`context-menu-item${item.danger ? " danger" : ""}`}
            onClick={() => {
              item.action?.();
              onClose();
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export default ContextMenu;
