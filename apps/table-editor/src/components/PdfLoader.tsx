import { useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

type PdfPageInfo = {
  pageNumber: number;
  hasText: boolean;
  text?: string;
  imageUrl: string; // Blob URL
};

const SCALE = 1.2;

export default function PdfLoader() {
  const [pages, setPages] = useState<PdfPageInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const yieldToBrowser = () =>
    new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

  const handleFile = async (file: File) => {
    setLoading(true);
    setPages([]);

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    setProgress({ current: 0, total: pdf.numPages });

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);

      // 🔍 текстовый слой (для информации)
      const textContent = await page.getTextContent();
      const text = textContent.items
        .map((item: any) => item.str)
        .join(" ")
        .trim();

      const hasText = text.length > 0;

      // 🖼 рендер страницы
      const viewport = page.getViewport({ scale: SCALE });
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvas,               // ✅ ОБЯЗАТЕЛЬНО
        canvasContext: ctx,   // ✅ ОБЯЗАТЕЛЬНО
        viewport,
      }).promise;

      // canvas → Blob → URL
      const blob: Blob = await new Promise(resolve =>
        canvas.toBlob(b => resolve(b!), "image/png")
      );

      const imageUrl = URL.createObjectURL(blob);

      setPages(prev => [
        ...prev,
        {
          pageNumber: i,
          hasText,
          text: hasText ? text : undefined,
          imageUrl,
        },
      ]);

      setProgress({ current: i, total: pdf.numPages });

      await yieldToBrowser(); // не блокируем UI
    }

    setLoading(false);
  };

  return (
    <div>
      <input
        type="file"
        accept="application/pdf"
        onChange={e => e.target.files && handleFile(e.target.files[0])}
      />

      {loading && (
        <p>
          Обработка: {progress.current} / {progress.total}
        </p>
      )}

      {pages.map(p => (
        <div
          key={p.pageNumber}
          style={{
            marginTop: 12,
            paddingBottom: 12,
            borderBottom: "1px solid #333",
          }}
        >
          <strong>Страница {p.pageNumber}</strong>
          <div style={{ fontSize: 12, color: p.hasText ? "#0f8" : "#f66" }}>
            {p.hasText ? "Есть текстовый слой" : "Без текстового слоя"}
          </div>

          <img
            src={p.imageUrl}
            style={{
              marginTop: 6,
              maxWidth: "100%",
              border: "1px solid #444",
            }}
          />
        </div>
      ))}
    </div>
  );
}
