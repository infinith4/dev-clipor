import { render, screen, waitFor, act } from "@testing-library/react";
import PreviewPanel from "../components/PreviewPanel";

const { invokeMock, listenMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  listenMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: listenMock,
}));

describe("PreviewPanel", () => {
  let unlistenFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    unlistenFn = vi.fn();
    listenMock.mockResolvedValue(unlistenFn);
    invokeMock.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty div when no data is available", async () => {
    invokeMock.mockResolvedValue(null);

    const { container } = render(<PreviewPanel />);

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("get_preview_data");
    });

    expect(container.querySelector(".preview-panel-empty")).toBeInTheDocument();
  });

  it("fetches and displays text data from initial invoke", async () => {
    invokeMock.mockResolvedValue({
      text: "Hello world",
      charCount: 11,
      copiedAt: "2025-01-15T10:30:00Z",
    });

    render(<PreviewPanel />);

    await waitFor(() => {
      expect(screen.getByText("Hello world")).toBeInTheDocument();
    });

    expect(screen.getByText("11文字")).toBeInTheDocument();
    expect(screen.getByText(/2025/)).toBeInTheDocument();
  });

  it("fetches and displays image data from initial invoke", async () => {
    invokeMock.mockResolvedValue({
      imageData: "abc123base64",
      charCount: 0,
      copiedAt: null,
    });

    render(<PreviewPanel />);

    await waitFor(() => {
      expect(screen.getByAltText("preview")).toBeInTheDocument();
    });

    const img = screen.getByAltText("preview") as HTMLImageElement;
    expect(img.src).toContain("data:image/png;base64,abc123base64");
  });

  it("listens for preview://update events and updates data", async () => {
    invokeMock.mockResolvedValue(null);

    render(<PreviewPanel />);

    await waitFor(() => {
      expect(listenMock).toHaveBeenCalledWith("preview://update", expect.any(Function));
    });

    const callback = listenMock.mock.calls[0][1];

    act(() => {
      callback({ payload: { text: "Updated text", charCount: 12, copiedAt: null } });
    });

    expect(screen.getByText("Updated text")).toBeInTheDocument();
    expect(screen.getByText("12文字")).toBeInTheDocument();
  });

  it("calls unlisten on unmount", async () => {
    const { unmount } = render(<PreviewPanel />);

    await waitFor(() => {
      expect(listenMock).toHaveBeenCalled();
    });

    unmount();

    await waitFor(() => {
      expect(unlistenFn).toHaveBeenCalled();
    });
  });

  it("handles invoke rejection gracefully", async () => {
    invokeMock.mockRejectedValue(new Error("fail"));

    const { container } = render(<PreviewPanel />);

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalled();
    });

    // Should still render the empty state without crashing
    expect(container.querySelector(".preview-panel-empty")).toBeInTheDocument();
  });

  it("does not display charCount when it is null", async () => {
    invokeMock.mockResolvedValue({
      text: "test",
      charCount: null,
      copiedAt: null,
    });

    render(<PreviewPanel />);

    await waitFor(() => {
      expect(screen.getByText("test")).toBeInTheDocument();
    });

    expect(screen.queryByText(/文字/)).not.toBeInTheDocument();
  });

  it("does not display charCount when it is 0", async () => {
    invokeMock.mockResolvedValue({
      text: "test",
      charCount: 0,
      copiedAt: null,
    });

    render(<PreviewPanel />);

    await waitFor(() => {
      expect(screen.getByText("test")).toBeInTheDocument();
    });

    expect(screen.queryByText(/文字/)).not.toBeInTheDocument();
  });

  it("renders nothing in content area when neither text nor imageData", async () => {
    invokeMock.mockResolvedValue({
      text: null,
      imageData: null,
      charCount: 5,
      copiedAt: null,
    });

    render(<PreviewPanel />);

    await waitFor(() => {
      expect(screen.getByText("5文字")).toBeInTheDocument();
    });

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(document.querySelector(".preview-panel-text")).not.toBeInTheDocument();
  });

  it("formats date correctly", async () => {
    invokeMock.mockResolvedValue({
      text: "test",
      charCount: 4,
      copiedAt: "2025-03-05T08:05:00Z",
    });

    render(<PreviewPanel />);

    await waitFor(() => {
      // The date should be formatted - exact output depends on timezone
      expect(screen.getByText(/2025/)).toBeInTheDocument();
    });
  });

  it("returns the raw string for invalid date", async () => {
    invokeMock.mockResolvedValue({
      text: "test",
      charCount: 4,
      copiedAt: "not-a-date",
    });

    render(<PreviewPanel />);

    await waitFor(() => {
      expect(screen.getByText("not-a-date")).toBeInTheDocument();
    });
  });

  it("does not set data when initial invoke returns null", async () => {
    invokeMock.mockResolvedValue(null);

    const { container } = render(<PreviewPanel />);

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalled();
    });

    expect(container.querySelector(".preview-panel-empty")).toBeInTheDocument();
    expect(container.querySelector(".preview-panel")).not.toBeInTheDocument();
  });
});
