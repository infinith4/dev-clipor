import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

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
  const [data, setData] = useState<PreviewPayload | null>(null);

  useEffect(() => {
    const unlistenPromise = listen<PreviewPayload>("preview://update", (event) => {
      setData(event.payload);
    });

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  if (!data) {
    return <div className="preview-panel-empty" />;
  }

  return (
    <main className="preview-panel">
      <div className="preview-panel-meta">
        {data.charCount != null && data.charCount > 0 && <span>{data.charCount}文字</span>}
        {data.copiedAt && <span>{formatDate(data.copiedAt)}</span>}
      </div>
      <hr className="preview-panel-separator" />
      {data.imageData ? (
        <img
          src={`data:image/png;base64,${data.imageData}`}
          alt="preview"
          className="preview-panel-image"
        />
      ) : data.text ? (
        <pre className="preview-panel-text">{data.text}</pre>
      ) : null}
    </main>
  );
}

export default PreviewPanel;
