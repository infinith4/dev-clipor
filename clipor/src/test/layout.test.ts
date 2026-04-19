import { describe, expect, it } from "vitest";
import { getElementStackHeight } from "../utils/layout";

function appendMeasuredChild(container: HTMLElement, top: number, height: number): HTMLElement {
  const child = document.createElement("div");

  Object.defineProperty(child, "offsetTop", {
    configurable: true,
    get: () => top,
  });

  Object.defineProperty(child, "offsetHeight", {
    configurable: true,
    get: () => height,
  });

  container.appendChild(child);

  return child;
}

describe("getElementStackHeight", () => {
  it("returns zero when the container has no children", () => {
    const container = document.createElement("div");

    expect(getElementStackHeight(container)).toBe(0);
  });

  it("measures the occupied height from the first child to the last child", () => {
    const container = document.createElement("div");

    appendMeasuredChild(container, 0, 28);
    appendMeasuredChild(container, 28, 28);
    appendMeasuredChild(container, 56, 28);

    expect(getElementStackHeight(container)).toBe(84);
  });

  it("handles non-zero starting offsets", () => {
    const container = document.createElement("div");

    appendMeasuredChild(container, 12, 24);
    appendMeasuredChild(container, 36, 24);

    expect(getElementStackHeight(container)).toBe(48);
  });
});
