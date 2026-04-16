import "@testing-library/jest-dom/vitest";
import "../i18n";

// jsdom does not implement IntersectionObserver — provide a no-op stub
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
Object.defineProperty(globalThis, "IntersectionObserver", {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
});
