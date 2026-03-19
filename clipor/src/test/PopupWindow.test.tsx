import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PopupWindow from "../components/PopupWindow";

describe("PopupWindow", () => {
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
});
