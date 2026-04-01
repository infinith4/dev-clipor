import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import i18n from "../i18n";

interface PreviewPayload {
  text?: string | null;
  imageData?: string | null;
  charCount?: number | null;
  copiedAt?: string | null;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function PreviewPanel() {
  const { t } = useTranslation();
  const [data, setData] = useState<PreviewPayload | null>(null);

  useEffect(() => {
    // Fetch initial data (stored before JS was ready)
    invoke<PreviewPayload | null>("get_preview_data")
      .then((result) => {
        if (result) setData(result);
      })
      .catch(() => {});

    // Listen for subsequent updates
    const unlistenPreviewPromise = listen<PreviewPayload>("preview://update", (event) => {
      setData(event.payload);
    });

    // Listen for language changes broadcast from the main window
    const unlistenLangPromise = listen<string>("ui://lang-change", (event) => {
      void i18n.changeLanguage(event.payload);
    });

    return () => {
      void unlistenPreviewPromise.then((unlisten) => unlisten());
      void unlistenLangPromise.then((unlisten) => unlisten());
    };
  }, []);

  if (!data) {
    return <div className="preview-panel-empty" />;
  }

  return (
    <main className="preview-panel">
      <div className="preview-panel-meta">
        {data.charCount != null && data.charCount > 0 && <span>{data.charCount}{t("preview.char_count_suffix")}</span>}
        {data.copiedAt && <span>{formatDate(data.copiedAt)}</span>}
      </div>
      <hr className="preview-panel-separator" />
      {data.imageData ? (
        <img
          src={`data:image/png;base64,${data.imageData}`}
          alt={t("preview_image.alt_text")}
          className="preview-panel-image"
        />
      ) : data.text ? (
        <pre className="preview-panel-text">{data.text}</pre>
      ) : null}
    </main>
  );
}

export default PreviewPanel;
