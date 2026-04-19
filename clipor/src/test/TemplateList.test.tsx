import { render, screen, fireEvent } from "@testing-library/react";
import TemplateList from "../components/TemplateList";
import type { TemplateEntry } from "../types";

function makeTemplate(overrides?: Partial<TemplateEntry>): TemplateEntry {
  return {
    id: 1,
    groupId: 1,
    groupName: "Default",
    title: "Greeting",
    text: "Hello world",
    contentType: "text",
    imageData: null,
    sortOrder: 0,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function defaultProps(overrides?: Partial<Parameters<typeof TemplateList>[0]>) {
  return {
    templates: [makeTemplate()],
    selectedTemplateId: null as number | null,
    onSelect: vi.fn(),
    onPaste: vi.fn(),
    ...overrides,
  };
}

describe("TemplateList", () => {
  describe("empty state", () => {
    it("shows empty state message when templates is empty", () => {
      render(<TemplateList {...defaultProps({ templates: [] })} />);
      expect(screen.getByText("定型文はまだありません。")).toBeInTheDocument();
    });
  });

  describe("rendering template items", () => {
    it("renders template title", () => {
      render(<TemplateList {...defaultProps()} />);
      expect(screen.getByText("Greeting")).toBeInTheDocument();
    });

    it("does not render group badge", () => {
      render(<TemplateList {...defaultProps()} />);
      expect(screen.queryByText("Default")).not.toBeInTheDocument();
    });

    it("renders title for text templates", () => {
      render(<TemplateList {...defaultProps()} />);
      expect(screen.getByText("Greeting")).toBeInTheDocument();
    });

    it("renders image for image templates", () => {
      const template = makeTemplate({
        contentType: "image",
        imageData: "base64data",
        title: "Screenshot",
      });
      render(<TemplateList {...defaultProps({ templates: [template] })} />);
      const img = screen.getByAltText("Screenshot");
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("src", "data:image/png;base64,base64data");
    });

    it("renders title for image template without imageData", () => {
      const template = makeTemplate({
        contentType: "image",
        imageData: null,
        title: "Image Title",
      });
      render(<TemplateList {...defaultProps({ templates: [template] })} />);
      expect(screen.getByText("Image Title")).toBeInTheDocument();
    });

    it("renders title for image template with undefined imageData", () => {
      const template = makeTemplate({
        contentType: "image",
        imageData: undefined,
        title: "Image Title",
      });
      render(<TemplateList {...defaultProps({ templates: [template] })} />);
      expect(screen.getByText("Image Title")).toBeInTheDocument();
    });

    it("renders multiple templates", () => {
      const templates = [
        makeTemplate({ id: 1, title: "First" }),
        makeTemplate({ id: 2, title: "Second" }),
      ];
      render(<TemplateList {...defaultProps({ templates })} />);
      expect(screen.getByText("First")).toBeInTheDocument();
      expect(screen.getByText("Second")).toBeInTheDocument();
    });
  });

  describe("selected state", () => {
    it("applies selected class to selected template", () => {
      render(<TemplateList {...defaultProps({ selectedTemplateId: 1 })} />);
      const article = screen.getByRole("button");
      expect(article.className).toContain("selected");
    });

    it("does not apply selected class when not selected", () => {
      render(<TemplateList {...defaultProps({ selectedTemplateId: null })} />);
      const article = screen.getByRole("button");
      expect(article.className).not.toContain("selected");
    });

    it("does not apply selected class when different id is selected", () => {
      render(<TemplateList {...defaultProps({ selectedTemplateId: 999 })} />);
      const article = screen.getByRole("button");
      expect(article.className).not.toContain("selected");
    });
  });

  describe("click calls onPaste", () => {
    it("calls onPaste with template id", () => {
      const props = defaultProps();
      render(<TemplateList {...props} />);
      fireEvent.click(screen.getByRole("button"));
      expect(props.onPaste).toHaveBeenCalledWith(1);
    });
  });

  describe("focus calls onSelect", () => {
    it("calls onSelect with template on focus", () => {
      const props = defaultProps();
      render(<TemplateList {...props} />);
      fireEvent.focus(screen.getByRole("button"));
      expect(props.onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, title: "Greeting" }),
      );
    });
  });

  describe("mouseEnter calls onSelect", () => {
    it("calls onSelect with template on mouseEnter", () => {
      const props = defaultProps();
      render(<TemplateList {...props} />);
      fireEvent.mouseEnter(screen.getByRole("button"));
      expect(props.onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, title: "Greeting" }),
      );
    });
  });

  describe("context menu", () => {
    it("calls onContextMenu with event and template on right-click", () => {
      const onContextMenu = vi.fn();
      const props = defaultProps({ onContextMenu });
      render(<TemplateList {...props} />);
      fireEvent.contextMenu(screen.getByRole("button"));
      expect(onContextMenu).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ id: 1, title: "Greeting" }),
      );
    });

    it("prevents default on right-click when onContextMenu is provided", () => {
      const onContextMenu = vi.fn();
      const props = defaultProps({ onContextMenu });
      render(<TemplateList {...props} />);
      const prevented = fireEvent.contextMenu(screen.getByRole("button"));
      expect(prevented).toBe(false);
    });

    it("does not set onContextMenu handler when prop is not provided", () => {
      const props = defaultProps();
      render(<TemplateList {...props} />);
      const prevented = fireEvent.contextMenu(screen.getByRole("button"));
      expect(prevented).toBe(true);
    });
  });

});
