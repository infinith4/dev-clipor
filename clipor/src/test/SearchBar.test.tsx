import { render, screen, fireEvent } from "@testing-library/react";
import SearchBar from "../components/SearchBar";

describe("SearchBar", () => {
  it("renders an input with the given value and placeholder", () => {
    render(<SearchBar value="hello" placeholder="Search..." onChange={vi.fn()} />);

    const input = screen.getByPlaceholderText("Search...") as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe("hello");
    expect(input.type).toBe("search");
  });

  it("calls onChange with the new value when input changes", () => {
    const onChange = vi.fn();
    render(<SearchBar value="" placeholder="Type here" onChange={onChange} />);

    const input = screen.getByPlaceholderText("Type here");
    fireEvent.change(input, { target: { value: "new text" } });

    expect(onChange).toHaveBeenCalledWith("new text");
  });

  it("wraps the input in a div with search-bar class", () => {
    const { container } = render(
      <SearchBar value="" placeholder="" onChange={vi.fn()} />,
    );

    expect(container.querySelector(".search-bar")).toBeInTheDocument();
  });

  it("renders with empty value", () => {
    render(<SearchBar value="" placeholder="empty" onChange={vi.fn()} />);

    const input = screen.getByPlaceholderText("empty") as HTMLInputElement;
    expect(input.value).toBe("");
  });
});
