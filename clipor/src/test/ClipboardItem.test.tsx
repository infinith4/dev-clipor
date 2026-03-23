import { render, screen, fireEvent } from "@testing-library/react";
import ClipboardItem from "../components/ClipboardItem";
import type { ClipboardEntry } from "../types";

function makeTextEntry(overrides?: Partial<ClipboardEntry>): ClipboardEntry {
  return {
    id: 1,
    text: "Hello world",
    copiedAt: "2025-01-15T10:30:00Z",
    isPinned: false,
    charCount: 11,
    sourceApp: null,
    contentType: "text",
    imageData: null,
    ...overrides,
  };
}

function makeImageEntry(overrides?: Partial<ClipboardEntry>): ClipboardEntry {
  return {
    id: 2,
    text: "",
    copiedAt: "2025-01-15T10:30:00Z",
    isPinned: false,
    charCount: 0,
    sourceApp: "Screenshot",
    contentType: "image",
    imageData: "base64imagedata",
    ...overrides,
  };
}

function defaultProps(overrides?: Record<string, unknown>) {
  return {
    entry: makeTextEntry(),
    isSelected: false,
    onSelect: vi.fn(),
    onPaste: vi.fn(),
    onContextMenu: vi.fn(),
    ...overrides,
  };
}

describe("ClipboardItem", () => {
  it("renders text entry with preview text", () => {
    render(<ClipboardItem {...defaultProps()} />);

    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("truncates long text to 80 characters", () => {
    const longText = "a".repeat(100);
    render(
      <ClipboardItem {...defaultProps({ entry: makeTextEntry({ text: longText }) })} />,
    );

    expect(screen.getByText("a".repeat(80))).toBeInTheDocument();
  });

  it("replaces newlines with spaces in preview", () => {
    render(
      <ClipboardItem
        {...defaultProps({ entry: makeTextEntry({ text: "line1\nline2\r\nline3" }) })}
      />,
    );

    expect(screen.getByText("line1 line2 line3")).toBeInTheDocument();
  });

  it("renders [画像] for image entries", () => {
    render(
      <ClipboardItem {...defaultProps({ entry: makeImageEntry() })} />,
    );

    // Image entry with imageData renders an img element
    expect(screen.getByAltText("clipboard image")).toBeInTheDocument();
  });

  it("renders [画像] text for image entry without imageData", () => {
    render(
      <ClipboardItem
        {...defaultProps({ entry: makeImageEntry({ imageData: null }) })}
      />,
    );

    // When contentType is "image" but no imageData, falls through to text preview showing [画像]
    expect(screen.getByText("[画像]")).toBeInTheDocument();
  });

  it("renders image thumbnail when entry is image with imageData", () => {
    render(
      <ClipboardItem {...defaultProps({ entry: makeImageEntry() })} />,
    );

    const img = screen.getByAltText("clipboard image") as HTMLImageElement;
    expect(img.src).toContain("data:image/png;base64,base64imagedata");
    expect(img).toHaveClass("clipboard-thumbnail");
  });

  it("shows Pin badge when entry is pinned", () => {
    render(
      <ClipboardItem
        {...defaultProps({ entry: makeTextEntry({ isPinned: true }) })}
      />,
    );

    expect(screen.getByText("Pin")).toBeInTheDocument();
    expect(document.querySelector(".badge")).toBeInTheDocument();
  });

  it("does not show Pin badge when entry is not pinned", () => {
    render(<ClipboardItem {...defaultProps()} />);

    expect(screen.queryByText("Pin")).not.toBeInTheDocument();
  });

  it("applies selected class when isSelected is true", () => {
    render(
      <ClipboardItem {...defaultProps({ isSelected: true })} />,
    );

    const article = screen.getByRole("button");
    expect(article).toHaveClass("selected");
  });

  it("does not apply selected class when isSelected is false", () => {
    render(<ClipboardItem {...defaultProps()} />);

    const article = screen.getByRole("button");
    expect(article).not.toHaveClass("selected");
  });

  it("calls onPaste with entry id on click", () => {
    const onPaste = vi.fn();
    render(<ClipboardItem {...defaultProps({ onPaste })} />);

    fireEvent.click(screen.getByRole("button"));

    expect(onPaste).toHaveBeenCalledWith(1);
  });

  it("calls onSelect with entry id on focus", () => {
    const onSelect = vi.fn();
    render(<ClipboardItem {...defaultProps({ onSelect })} />);

    fireEvent.focus(screen.getByRole("button"));

    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("calls onSelect with entry id on mouse enter", () => {
    const onSelect = vi.fn();
    render(<ClipboardItem {...defaultProps({ onSelect })} />);

    fireEvent.mouseEnter(screen.getByRole("button"));

    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("calls onContextMenu on right click", () => {
    const onContextMenu = vi.fn();
    render(<ClipboardItem {...defaultProps({ onContextMenu })} />);

    const article = screen.getByRole("button");
    fireEvent.contextMenu(article);

    expect(onContextMenu).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ id: 1 }),
    );
  });

  it("prevents default on context menu", () => {
    const onContextMenu = vi.fn();
    render(<ClipboardItem {...defaultProps({ onContextMenu })} />);

    const article = screen.getByRole("button");
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    const preventSpy = vi.spyOn(event, "preventDefault");

    article.dispatchEvent(event);

    expect(preventSpy).toHaveBeenCalled();
  });

  it("has tabIndex 0 for keyboard accessibility", () => {
    render(<ClipboardItem {...defaultProps()} />);

    const article = screen.getByRole("button");
    expect(article).toHaveAttribute("tabindex", "0");
  });

  it("renders text entry with contentType text and no imageData", () => {
    const entry = makeTextEntry({ contentType: "text", imageData: undefined });
    render(<ClipboardItem {...defaultProps({ entry })} />);

    expect(screen.getByText("Hello world")).toBeInTheDocument();
    expect(screen.queryByAltText("clipboard image")).not.toBeInTheDocument();
  });
});
