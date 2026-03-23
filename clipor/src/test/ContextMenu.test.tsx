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
});
