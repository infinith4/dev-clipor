import { render, screen } from "@testing-library/react";
import TooltipPreview from "../components/TooltipPreview";

function makeAnchorRect(overrides?: Partial<DOMRect>): DOMRect {
  return {
    x: 100,
    y: 50,
    width: 200,
    height: 30,
    top: 50,
    bottom: 80,
    left: 100,
    right: 300,
    toJSON: () => {},
    ...overrides,
  } as DOMRect;
}

describe("TooltipPreview", () => {
  beforeEach(() => {
    // Mock getBoundingClientRect on the tooltip div
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      top: 0,
      bottom: 200,
      left: 0,
      right: 300,
      toJSON: () => {},
    });

    // Mock window dimensions
    Object.defineProperty(window, "innerWidth", { value: 1024, writable: true });
    Object.defineProperty(window, "innerHeight", { value: 768, writable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when anchorRect is null", () => {
    const { container } = render(
      <TooltipPreview text="test" anchorRect={null} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("returns null when neither text nor imageData is provided", () => {
    const { container } = render(
      <TooltipPreview anchorRect={makeAnchorRect()} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("returns null when text is undefined and imageData is null", () => {
    const { container } = render(
      <TooltipPreview text={undefined} imageData={null} anchorRect={makeAnchorRect()} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders text content", () => {
    render(
      <TooltipPreview text="Hello preview" anchorRect={makeAnchorRect()} />,
    );

    expect(screen.getByText("Hello preview")).toBeInTheDocument();
    expect(document.querySelector(".tooltip-preview-text")).toBeInTheDocument();
  });

  it("renders image content when imageData is provided", () => {
    render(
      <TooltipPreview imageData="base64data" anchorRect={makeAnchorRect()} />,
    );

    const img = screen.getByAltText("preview") as HTMLImageElement;
    expect(img.src).toContain("data:image/png;base64,base64data");
    expect(img).toHaveClass("tooltip-preview-image");
  });

  it("prefers imageData over text when both are provided", () => {
    render(
      <TooltipPreview text="text" imageData="imgdata" anchorRect={makeAnchorRect()} />,
    );

    expect(screen.getByAltText("preview")).toBeInTheDocument();
    expect(document.querySelector(".tooltip-preview-text")).not.toBeInTheDocument();
  });

  it("displays charCount metadata", () => {
    render(
      <TooltipPreview text="test" charCount={42} anchorRect={makeAnchorRect()} />,
    );

    expect(screen.getByText("42文字")).toBeInTheDocument();
  });

  it("does not display charCount when not provided", () => {
    render(
      <TooltipPreview text="test" anchorRect={makeAnchorRect()} />,
    );

    expect(screen.queryByText(/文字/)).not.toBeInTheDocument();
  });

  it("displays formatted copiedAt date", () => {
    render(
      <TooltipPreview
        text="test"
        copiedAt="2025-06-15T14:30:00Z"
        anchorRect={makeAnchorRect()}
      />,
    );

    expect(screen.getByText(/2025/)).toBeInTheDocument();
  });

  it("returns raw string for invalid copiedAt date", () => {
    render(
      <TooltipPreview
        text="test"
        copiedAt="invalid-date"
        anchorRect={makeAnchorRect()}
      />,
    );

    expect(screen.getByText("invalid-date")).toBeInTheDocument();
  });

  it("does not display copiedAt when not provided", () => {
    render(
      <TooltipPreview text="test" anchorRect={makeAnchorRect()} />,
    );

    expect(document.querySelector(".tooltip-preview-meta")?.children.length).toBe(0);
  });

  it("displays contextLabel", () => {
    render(
      <TooltipPreview text="test" contextLabel="テキスト" anchorRect={makeAnchorRect()} />,
    );

    expect(screen.getByText("テキスト")).toBeInTheDocument();
  });

  it("does not display contextLabel when null", () => {
    render(
      <TooltipPreview text="test" contextLabel={null} anchorRect={makeAnchorRect()} />,
    );

    // No contextLabel span
    const meta = document.querySelector(".tooltip-preview-meta")!;
    expect(meta.querySelectorAll("span").length).toBe(0);
  });

  it("displays title", () => {
    render(
      <TooltipPreview text="test" title="My Title" anchorRect={makeAnchorRect()} />,
    );

    expect(screen.getByText("My Title")).toBeInTheDocument();
    expect(document.querySelector(".tooltip-preview-title")).toBeInTheDocument();
  });

  it("does not display title when not provided", () => {
    render(
      <TooltipPreview text="test" anchorRect={makeAnchorRect()} />,
    );

    expect(document.querySelector(".tooltip-preview-title")).not.toBeInTheDocument();
  });

  it("positions tooltip below anchor when there is space", () => {
    render(
      <TooltipPreview text="test" anchorRect={makeAnchorRect()} />,
    );

    const tooltip = document.querySelector(".tooltip-preview") as HTMLElement;
    // top should be anchorRect.bottom + margin = 80 + 4 = 84
    expect(tooltip.style.top).toBe("84px");
  });

  it("positions tooltip above anchor when it overflows below", () => {
    // Tooltip would overflow: bottom(80) + 4 + height(200) = 284 which is < 768
    // To make it overflow, set innerHeight small
    Object.defineProperty(window, "innerHeight", { value: 250, writable: true });

    render(
      <TooltipPreview text="test" anchorRect={makeAnchorRect()} />,
    );

    const tooltip = document.querySelector(".tooltip-preview") as HTMLElement;
    // top = anchorRect.top - tooltipHeight - margin = 50 - 200 - 4 = -154
    // Then since -154 < margin(4), it pins to margin(4)
    expect(tooltip.style.top).toBe("4px");
  });

  it("pins to top margin when overflow both above and below", () => {
    // Very small window
    Object.defineProperty(window, "innerHeight", { value: 100, writable: true });

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 0, width: 300, height: 300,
      top: 0, bottom: 300, left: 0, right: 300,
      toJSON: () => {},
    });

    render(
      <TooltipPreview text="test" anchorRect={makeAnchorRect()} />,
    );

    const tooltip = document.querySelector(".tooltip-preview") as HTMLElement;
    expect(tooltip.style.top).toBe("4px");
  });

  it("centers horizontally within window", () => {
    render(
      <TooltipPreview text="test" anchorRect={makeAnchorRect()} />,
    );

    const tooltip = document.querySelector(".tooltip-preview") as HTMLElement;
    // left = max(4, (1024 - min(300, 1024 - 8)) / 2) = max(4, (1024 - 300) / 2) = max(4, 362) = 362
    expect(tooltip.style.left).toBe("362px");
  });

  it("uses margin when tooltip is wider than window", () => {
    Object.defineProperty(window, "innerWidth", { value: 100, writable: true });

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 0, width: 500, height: 200,
      top: 0, bottom: 200, left: 0, right: 500,
      toJSON: () => {},
    });

    render(
      <TooltipPreview text="test" anchorRect={makeAnchorRect()} />,
    );

    const tooltip = document.querySelector(".tooltip-preview") as HTMLElement;
    // left = max(4, (100 - min(500, 100 - 8)) / 2) = max(4, (100 - 92) / 2) = max(4, 4) = 4
    expect(tooltip.style.left).toBe("4px");
  });

  it("displays all metadata together", () => {
    render(
      <TooltipPreview
        text="full metadata"
        contextLabel="画像"
        charCount={100}
        copiedAt="2025-01-01T00:00:00Z"
        title="App"
        anchorRect={makeAnchorRect()}
      />,
    );

    expect(screen.getByText("画像")).toBeInTheDocument();
    expect(screen.getByText("100文字")).toBeInTheDocument();
    expect(screen.getByText("App")).toBeInTheDocument();
    expect(screen.getByText(/2025/)).toBeInTheDocument();
  });
});
