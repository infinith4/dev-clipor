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
});
