import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PopupWindow from "../components/PopupWindow";

describe("PopupWindow", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders template editor after switching tabs", async () => {
    const user = userEvent.setup();
    const onSelectTab = vi.fn();

    const { rerender } = render(
      <PopupWindow
        activeTab="history"
        error={null}
        history={{
          entries: [],
          loading: false,
          page: 1,
          total: 0,
          totalPages: 1,
          search: "",
          selectedEntryId: null,
          setSearch: vi.fn(),
          setSelectedEntryId: vi.fn(),
          previousPage: vi.fn(),
          nextPage: vi.fn(),
          selectEntry: vi.fn(),
          pasteEntry: vi.fn(),
          updateEntry: vi.fn(),
          togglePinned: vi.fn(),
          deleteEntry: vi.fn(),
          setClipboardFormatted: vi.fn(),
          setClipboardConverted: vi.fn(),
        }}
        templates={{
          groups: [],
          templates: [],
          search: "",
          selectedGroupId: null,
          selectedTemplateId: null,
          setSearch: vi.fn(),
          setSelectedGroupId: vi.fn(),
          setSelectedTemplate: vi.fn(),
          pasteTemplate: vi.fn(),
          saveTemplate: vi.fn(),
          deleteTemplate: vi.fn(),
          exportTemplates: vi.fn(),
          importTemplates: vi.fn(),
        }}
        settings={{
            settings: {
              maxHistoryItems: 1000,
              pageSize: 20,
              hotkey: "Ctrl+Alt+M",
              launchOnStartup: false,
              requirePassword: false,
            },
            saveSettings: vi.fn(),
            refresh: vi.fn(),
        }}
        onDismissError={vi.fn()}
        onSelectTab={onSelectTab}
        onRegisterAsTemplate={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "定型文" }));
    expect(onSelectTab).toHaveBeenCalledWith("templates");

    rerender(
      <PopupWindow
        activeTab="templates"
        error={null}
        history={{
          entries: [],
          loading: false,
          page: 1,
          total: 0,
          totalPages: 1,
          search: "",
          selectedEntryId: null,
          setSearch: vi.fn(),
          setSelectedEntryId: vi.fn(),
          previousPage: vi.fn(),
          nextPage: vi.fn(),
          selectEntry: vi.fn(),
          pasteEntry: vi.fn(),
          updateEntry: vi.fn(),
          togglePinned: vi.fn(),
          deleteEntry: vi.fn(),
          setClipboardFormatted: vi.fn(),
          setClipboardConverted: vi.fn(),
        }}
        templates={{
          groups: [],
          templates: [],
          search: "",
          selectedGroupId: null,
          selectedTemplateId: null,
          setSearch: vi.fn(),
          setSelectedGroupId: vi.fn(),
          setSelectedTemplate: vi.fn(),
          pasteTemplate: vi.fn(),
          saveTemplate: vi.fn(),
          deleteTemplate: vi.fn(),
          exportTemplates: vi.fn(),
          importTemplates: vi.fn(),
        }}
        settings={{
          settings: {
            maxHistoryItems: 1000,
            pageSize: 20,
            hotkey: "Ctrl+Alt+M",
            launchOnStartup: false,
            requirePassword: false,
          },
          saveSettings: vi.fn(),
          refresh: vi.fn(),
        }}
        onDismissError={vi.fn()}
        onSelectTab={onSelectTab}
        onRegisterAsTemplate={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
  });

  it("shows hover information for clipboard entries", async () => {
    vi.useFakeTimers();

    render(
      <PopupWindow
        activeTab="history"
        error={null}
        history={{
          entries: [
            {
              id: 1,
              text: "first line\nsecond line",
              copiedAt: "copied-at",
              isPinned: false,
              charCount: 22,
              sourceApp: "VS Code",
              contentType: "text",
            },
          ],
          loading: false,
          page: 1,
          total: 1,
          totalPages: 1,
          search: "",
          selectedEntryId: null,
          setSearch: vi.fn(),
          setSelectedEntryId: vi.fn(),
          previousPage: vi.fn(),
          nextPage: vi.fn(),
          selectEntry: vi.fn(),
          pasteEntry: vi.fn(),
          updateEntry: vi.fn(),
          togglePinned: vi.fn(),
          deleteEntry: vi.fn(),
          setClipboardFormatted: vi.fn(),
          setClipboardConverted: vi.fn(),
        }}
        templates={{
          groups: [],
          templates: [],
          search: "",
          selectedGroupId: null,
          selectedTemplateId: null,
          setSearch: vi.fn(),
          setSelectedGroupId: vi.fn(),
          setSelectedTemplate: vi.fn(),
          pasteTemplate: vi.fn(),
          saveTemplate: vi.fn(),
          deleteTemplate: vi.fn(),
          exportTemplates: vi.fn(),
          importTemplates: vi.fn(),
        }}
        settings={{
          settings: {
            maxHistoryItems: 1000,
            pageSize: 20,
            hotkey: "Ctrl+Alt+M",
            launchOnStartup: false,
            requirePassword: false,
          },
          saveSettings: vi.fn(),
          refresh: vi.fn(),
        }}
        onDismissError={vi.fn()}
        onSelectTab={vi.fn()}
        onRegisterAsTemplate={vi.fn()}
      />,
    );

    const item = screen.getByText("first line second line").closest("article");
    expect(item).not.toBeNull();

    await act(async () => {
      fireEvent.mouseEnter(item!);
      await vi.advanceTimersByTimeAsync(300);
    });

    const tooltip = document.querySelector(".tooltip-preview");
    expect(tooltip).not.toBeNull();

    const tooltipQueries = within(tooltip as HTMLElement);
    expect(tooltipQueries.getByText("VS Code")).toBeInTheDocument();
    expect(tooltipQueries.getByText("22文字")).toBeInTheDocument();
    expect(tooltipQueries.getByText("copied-at")).toBeInTheDocument();
    expect(
      tooltipQueries.getByText((_, element) => element?.textContent === "first line\nsecond line"),
    ).toBeInTheDocument();
  });
});
