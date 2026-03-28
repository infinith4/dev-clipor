import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Pagination from "../components/Pagination";

describe("Pagination", () => {
  it("disables previous button on first page and next button on last page", async () => {
    const user = userEvent.setup();
    const onPrevious = vi.fn();
    const onNext = vi.fn();

    const { rerender } = render(
      <Pagination
        page={1}
        totalPages={3}
        totalItems={44}
        onPrevious={onPrevious}
        onNext={onNext}
      />,
    );

    expect(screen.getByRole("button", { name: "<" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: ">" }));
    expect(onNext).toHaveBeenCalledTimes(1);

    rerender(
      <Pagination
        page={3}
        totalPages={3}
        totalItems={44}
        onPrevious={onPrevious}
        onNext={onNext}
      />,
    );

    expect(screen.getByRole("button", { name: ">" })).toBeDisabled();
  });

  it("renders page number and total", () => {
    render(
      <Pagination
        page={2}
        totalPages={5}
        totalItems={100}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
      />,
    );
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("/ 5")).toBeInTheDocument();
  });

  it("renders items count with suffix", () => {
    render(
      <Pagination
        page={1}
        totalPages={1}
        totalItems={42}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
      />,
    );
    // The suffix is from i18n: "件"
    expect(screen.getByText(/42/)).toBeInTheDocument();
  });

  it("disables both buttons when totalPages is 1", () => {
    render(
      <Pagination
        page={1}
        totalPages={1}
        totalItems={5}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "<" })).toBeDisabled();
    expect(screen.getByRole("button", { name: ">" })).toBeDisabled();
  });

  it("enables both buttons when on a middle page", async () => {
    const user = userEvent.setup();
    const onPrevious = vi.fn();
    const onNext = vi.fn();
    render(
      <Pagination
        page={2}
        totalPages={3}
        totalItems={30}
        onPrevious={onPrevious}
        onNext={onNext}
      />,
    );
    expect(screen.getByRole("button", { name: "<" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: ">" })).not.toBeDisabled();
    await user.click(screen.getByRole("button", { name: "<" }));
    expect(onPrevious).toHaveBeenCalledTimes(1);
  });
});
