import type React from "react";
import { render, screen } from "@testing-library/react";
import AppErrorBoundary from "../components/AppErrorBoundary";

function GoodChild() {
  return <p>Hello</p>;
}

function ThrowingChild({ message }: { message?: string }): React.ReactNode {
  throw new Error(message || "boom");
}

describe("AppErrorBoundary", () => {
  beforeEach(() => {
    // Suppress console.error noise from React and componentDidCatch
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders children when no error occurs", () => {
    render(
      <AppErrorBoundary>
        <GoodChild />
      </AppErrorBoundary>,
    );
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("renders fallback UI when a child throws", () => {
    render(
      <AppErrorBoundary>
        <ThrowingChild message="test failure" />
      </AppErrorBoundary>,
    );

    expect(screen.getByText("UI の初期化に失敗しました")).toBeInTheDocument();
    expect(screen.getByText("test failure")).toBeInTheDocument();
    expect(screen.getByText("Clipor")).toBeInTheDocument();
  });

  it("uses default message when error.message is empty", () => {
    function ThrowEmpty(): React.ReactNode {
      const err = new Error();
      err.message = "";
      throw err;
    }

    render(
      <AppErrorBoundary>
        <ThrowEmpty />
      </AppErrorBoundary>,
    );

    expect(screen.getByText("アプリの描画に失敗しました。")).toBeInTheDocument();
  });

  it("logs the error via componentDidCatch", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <AppErrorBoundary>
        <ThrowingChild message="catch me" />
      </AppErrorBoundary>,
    );

    expect(errorSpy).toHaveBeenCalledWith(
      "App render failed",
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) }),
    );
  });
});
