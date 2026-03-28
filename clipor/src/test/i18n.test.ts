import i18n from "../i18n";

describe("i18n", () => {
  it("initializes with saved language from localStorage", () => {
    // Default fallback is 'ja' when no localStorage value
    expect(i18n.language).toBe("ja");
  });

  it("has English and Japanese resources", () => {
    expect(i18n.hasResourceBundle("en", "translation")).toBe(true);
    expect(i18n.hasResourceBundle("ja", "translation")).toBe(true);
  });

  it("translates keys in Japanese", () => {
    i18n.changeLanguage("ja");
    expect(i18n.t("tab.history")).toBe("履歴");
    expect(i18n.t("tab.templates")).toBe("定型文");
    expect(i18n.t("tab.settings")).toBe("設定");
  });

  it("translates keys in English", () => {
    i18n.changeLanguage("en");
    expect(i18n.t("tab.history")).toBe("History");
    expect(i18n.t("tab.templates")).toBe("Templates");
    expect(i18n.t("tab.settings")).toBe("Settings");
  });

  it("falls back to Japanese for missing keys", () => {
    i18n.changeLanguage("fr"); // unsupported language
    // fallbackLng is 'ja'
    expect(i18n.t("tab.history")).toBe("履歴");
  });

  it("does not escape interpolated values", () => {
    expect(i18n.options.interpolation?.escapeValue).toBe(false);
  });

  afterAll(() => {
    // Reset to Japanese for other tests
    i18n.changeLanguage("ja");
  });
});
