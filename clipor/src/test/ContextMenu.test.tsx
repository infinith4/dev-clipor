import { render, screen, fireEvent } from "@testing-library/react";
import ContextMenu, { type MenuItem } from "../components/ContextMenu";

function makeItems(overrides?: Partial<MenuItem>[]): MenuItem[] {
  const defaults: MenuItem[] = [
    { label: "Copy", action: vi.fn() },
    { label: "Delete", action: vi.fn(), danger: true },
  ];
  if (!overrides) return defaults;
  return defaults.map((d, i) => ({ ...d, ...(overrides[i] ?? {}) }));
}

describe("ContextMenu", () => {
  it("renders all menu items", () => {
    const items = makeItems();
    render(<ContextMenu x={100} y={200} items={items} onClose={vi.fn()} />);

    expect(screen.getByText("Copy")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("applies danger class to danger items", () => {
    const items = makeItems();
    render(<ContextMenu x={0} y={0} items={items} onClose={vi.fn()} />);

    const deleteBtn = screen.getByText("Delete");
    expect(deleteBtn).toHaveClass("danger");

    const copyBtn = screen.getByText("Copy");
    expect(copyBtn).not.toHaveClass("danger");
  });

  it("calls item.action and onClose when a button is clicked", () => {
    const items = makeItems();
    const onClose = vi.fn();
    render(<ContextMenu x={0} y={0} items={items} onClose={onClose} />);

    fireEvent.click(screen.getByText("Copy"));

    expect(items[0].action).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when clicking outside the menu", () => {
    const onClose = vi.fn();
    render(<ContextMenu x={0} y={0} items={makeItems()} onClose={onClose} />);

    fireEvent.mouseDown(document.body);

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not call onClose when clicking inside the menu", () => {
    const onClose = vi.fn();
    render(<ContextMenu x={0} y={0} items={makeItems()} onClose={onClose} />);

    const menu = document.querySelector(".context-menu")!;
    fireEvent.mouseDown(menu);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose when Escape key is pressed", () => {
    const onClose = vi.fn();
    render(<ContextMenu x={0} y={0} items={makeItems()} onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not call onClose for non-Escape keys", () => {
    const onClose = vi.fn();
    render(<ContextMenu x={0} y={0} items={makeItems()} onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Enter" });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("sets fixed position style from x and y props", () => {
    render(<ContextMenu x={42} y={84} items={makeItems()} onClose={vi.fn()} />);

    const menu = document.querySelector(".context-menu") as HTMLElement;
    expect(menu.style.position).toBe("fixed");
    expect(menu.style.left).toBe("42px");
    expect(menu.style.top).toBe("84px");
    expect(menu.style.zIndex).toBe("9999");
  });

  it("removes event listeners on unmount", () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <ContextMenu x={0} y={0} items={makeItems()} onClose={onClose} />,
    );

    unmount();

    // After unmount, events should not trigger onClose
    fireEvent.mouseDown(document.body);
    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
  });

  describe("submenu", () => {
    function makeSubItems(): MenuItem[] {
      return [
        {
          label: "整形",
          children: [
            { label: "前後の空白を削除", action: vi.fn() },
            { label: "空行を削除", action: vi.fn() },
          ],
        },
        { label: "Delete", action: vi.fn(), danger: true },
      ];
    }

    it("renders parent item with arrow", () => {
      render(<ContextMenu x={0} y={0} items={makeSubItems()} onClose={vi.fn()} />);
      expect(screen.getByText("整形")).toBeInTheDocument();
      expect(screen.getByText("▶")).toBeInTheDocument();
    });

    it("does not show submenu items initially", () => {
      render(<ContextMenu x={0} y={0} items={makeSubItems()} onClose={vi.fn()} />);
      expect(screen.queryByText("前後の空白を削除")).not.toBeInTheDocument();
    });

    it("shows submenu on mouse enter of parent", () => {
      render(<ContextMenu x={0} y={0} items={makeSubItems()} onClose={vi.fn()} />);
      const parent = screen.getByText("整形").closest(".context-menu-parent")!;
      fireEvent.mouseEnter(parent);
      expect(screen.getByText("前後の空白を削除")).toBeInTheDocument();
      expect(screen.getByText("空行を削除")).toBeInTheDocument();
    });

    it("hides submenu on mouse leave of parent", () => {
      render(<ContextMenu x={0} y={0} items={makeSubItems()} onClose={vi.fn()} />);
      const parent = screen.getByText("整形").closest(".context-menu-parent")!;
      fireEvent.mouseEnter(parent);
      expect(screen.getByText("前後の空白を削除")).toBeInTheDocument();
      fireEvent.mouseLeave(parent);
      expect(screen.queryByText("前後の空白を削除")).not.toBeInTheDocument();
    });

    it("calls child action and onClose when submenu item is clicked", () => {
      const items = makeSubItems();
      const onClose = vi.fn();
      render(<ContextMenu x={0} y={0} items={items} onClose={onClose} />);
      const parent = screen.getByText("整形").closest(".context-menu-parent")!;
      fireEvent.mouseEnter(parent);
      fireEvent.click(screen.getByText("前後の空白を削除"));
      expect(items[0].children![0].action).toHaveBeenCalledOnce();
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("renders flat items alongside submenu items", () => {
      render(<ContextMenu x={0} y={0} items={makeSubItems()} onClose={vi.fn()} />);
      expect(screen.getByText("Delete")).toBeInTheDocument();
      expect(screen.getByText("Delete")).toHaveClass("danger");
    });
  });

  describe("viewport overflow positioning", () => {
    it("shifts menu left when overflowing right edge", () => {
      // Position at far right of viewport
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
        top: 0,
        left: 900,
        right: 1100,
        bottom: 100,
        width: 200,
        height: 100,
        x: 900,
        y: 0,
        toJSON: () => {},
      });
      Object.defineProperty(window, "innerWidth", { value: 1000, writable: true });
      Object.defineProperty(window, "innerHeight", { value: 800, writable: true });

      render(<ContextMenu x={900} y={0} items={makeItems()} onClose={vi.fn()} />);
      const menu = document.querySelector(".context-menu") as HTMLElement;
      // Should be shifted left: 1000 - 200 = 800
      expect(parseInt(menu.style.left)).toBeLessThanOrEqual(900);
    });

    it("shifts menu up when overflowing bottom edge", () => {
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
        top: 700,
        left: 0,
        right: 100,
        bottom: 900,
        width: 100,
        height: 200,
        x: 0,
        y: 700,
        toJSON: () => {},
      });
      Object.defineProperty(window, "innerWidth", { value: 1000, writable: true });
      Object.defineProperty(window, "innerHeight", { value: 800, writable: true });

      render(<ContextMenu x={0} y={750} items={makeItems()} onClose={vi.fn()} />);
      const menu = document.querySelector(".context-menu") as HTMLElement;
      expect(parseInt(menu.style.top)).toBeLessThanOrEqual(750);
    });

    it("clamps negative left position to 0", () => {
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
        top: 0,
        left: -100,
        right: 100,
        bottom: 50,
        width: 200,
        height: 50,
        x: -100,
        y: 0,
        toJSON: () => {},
      });
      Object.defineProperty(window, "innerWidth", { value: 50, writable: true });
      Object.defineProperty(window, "innerHeight", { value: 800, writable: true });

      render(<ContextMenu x={-100} y={0} items={makeItems()} onClose={vi.fn()} />);
      const menu = document.querySelector(".context-menu") as HTMLElement;
      expect(parseInt(menu.style.left)).toBeGreaterThanOrEqual(0);
    });

    it("clamps negative top position to 0", () => {
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
        top: -100,
        left: 0,
        right: 100,
        bottom: 100,
        width: 100,
        height: 200,
        x: 0,
        y: -100,
        toJSON: () => {},
      });
      Object.defineProperty(window, "innerWidth", { value: 1000, writable: true });
      Object.defineProperty(window, "innerHeight", { value: 50, writable: true });

      render(<ContextMenu x={0} y={-100} items={makeItems()} onClose={vi.fn()} />);
      const menu = document.querySelector(".context-menu") as HTMLElement;
      expect(parseInt(menu.style.top)).toBeGreaterThanOrEqual(0);
    });
  });

  describe("submenu positioning edge cases", () => {
    function makeSubItems(): MenuItem[] {
      return [
        {
          label: "Parent",
          children: [
            { label: "Child1", action: vi.fn() },
          ],
        },
      ];
    }

    it("positions submenu to left when right overflow", () => {
      Object.defineProperty(window, "innerWidth", { value: 300, writable: true });
      Object.defineProperty(window, "innerHeight", { value: 800, writable: true });

      render(<ContextMenu x={0} y={0} items={makeSubItems()} onClose={vi.fn()} />);
      const parent = screen.getByText("Parent").closest(".context-menu-parent")!;
      fireEvent.mouseEnter(parent);

      // Submenu should render
      expect(screen.getByText("Child1")).toBeInTheDocument();
    });

    it("handles submenu with no action (optional action)", () => {
      const items: MenuItem[] = [
        {
          label: "Parent",
          children: [
            { label: "No Action" }, // action is undefined
          ],
        },
      ];
      const onClose = vi.fn();
      render(<ContextMenu x={0} y={0} items={items} onClose={onClose} />);
      const parent = screen.getByText("Parent").closest(".context-menu-parent")!;
      fireEvent.mouseEnter(parent);
      fireEvent.click(screen.getByText("No Action"));
      // Should still call onClose even when action is undefined
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe("item without action", () => {
    it("calls onClose when item with no action is clicked", () => {
      const items: MenuItem[] = [{ label: "InfoOnly" }];
      const onClose = vi.fn();
      render(<ContextMenu x={0} y={0} items={items} onClose={onClose} />);
      fireEvent.click(screen.getByText("InfoOnly"));
      expect(onClose).toHaveBeenCalled();
    });
  });
});
