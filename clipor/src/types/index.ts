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

export interface HoverPreviewPayload {
  title?: string;
  text?: string | null;
  imageData?: string | null;
  charCount?: number | null;
  copiedAt?: string | null;
  contextLabel?: string | null;
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
  contentType: string;
  imageData?: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateExportPayload {
  groups: TemplateGroup[];
  templates: TemplateEntry[];
}

export type ActivationMode = "hotkey" | "double-ctrl" | "double-alt";

export interface AppSettings {
  maxHistoryItems: number;
  pageSize: number;
  hotkey: string;
  activationMode: ActivationMode;
  launchOnStartup: boolean;
  blurDelayMs: number;
  previewWidth: number;
  previewHeight: number;
  previewImageWidth: number;
  previewImageHeight: number;
  requirePassword: boolean;
  rememberLastTab: boolean;
}
