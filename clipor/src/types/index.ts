export type PopupTab = "history" | "templates" | "settings";

export interface ClipboardEntry {
  id: number;
  text: string;
  copiedAt: string;
  isPinned: boolean;
  charCount: number;
  sourceApp?: string | null;
  contentType: string;
  imageData?: string | null;
}

export interface ClipboardHistoryPage {
  entries: ClipboardEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TemplateGroup {
  id: number;
  name: string;
  sortOrder: number;
  createdAt: string;
}

export interface TemplateEntry {
  id: number;
  groupId: number;
  groupName: string;
  title: string;
  text: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateExportPayload {
  groups: TemplateGroup[];
  templates: TemplateEntry[];
}

export interface AppSettings {
  maxHistoryItems: number;
  pageSize: number;
  hotkey: string;
  launchOnStartup: boolean;
  requirePassword: boolean;
}
