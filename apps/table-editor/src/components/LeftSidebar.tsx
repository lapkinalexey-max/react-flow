import { useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker?url";
import { type PdfPage } from "../types";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

type Props = {
  pages: PdfPage[];
  activePageId: number | null;
  onPagesLoaded: (pages: PdfPage[]) => void;
  onPageSelect: (pageId: number) => void;
};

export default function LeftSidebar({ pages = [], activePageId, onPagesLoaded, onPageSelect }: Props) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFile = async (file: File) => {
    setLoading(true);
    setProgress(0);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      const newPages: PdfPage[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });

        // 1. Получаем основной текст
        const textContent = await page.getTextContent();
        // Приводим к any[], чтобы мутировать и добавлять свои свойства
        const textItems = textContent.items.filter((item: any) => 'str' in item) as any[];

        // 2. Получаем аннотации (AutoCAD SHX часто прячется здесь)
        const annotations = await page.getAnnotations();

        annotations.forEach((ann: any) => {
          if (ann.contents) {
            // Превращаем аннотацию в подобие TextItem
            const [x1, y1, x2, y2] = ann.rect;

            textItems.push({
              str: ann.contents,
              dir: 'ltr',
              width: x2 - x1,
              height: y2 - y1,
              // Имитируем матрицу трансформации [scaleX, skewY, skewX, scaleY, x, y]
              // Identity matrix + координаты
              transform: [1, 0, 0, 1, x1, y1],
              fontName: 'annotation',
              hasEOL: false
            });
          }
        });

        // 3. Рендер картинки
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d")!;
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvas, canvasContext: ctx, viewport }).promise;

        const blob: Blob = await new Promise(resolve => canvas.toBlob(b => resolve(b!), "image/png"));

        newPages.push({
          id: i,
          imageUrl: URL.createObjectURL(blob),
          textItems: textItems,
          viewport
        });

        const percent = Math.round((i / pdf.numPages) * 100);
        setProgress(percent);
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      onPagesLoaded(newPages);
    } catch (err) {
      console.error("Ошибка загрузки PDF:", err);
      alert("Не удалось загрузить PDF файл.");
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  return (
    <div style={{
      width: 320, background: "#181818", borderRight: "1px solid #333",
      display: "flex", flexDirection: "column", height: "100vh", zIndex: 20
    }}>

      {/* Заголовок */}
      <div style={{ padding: 16, borderBottom: "1px solid #333" }}>
        <h3 style={{ marginTop: 0, marginBottom: 12, color: "#fff", fontSize: 16 }}>Документы</h3>

        <div style={{ position: "relative" }}>
          <input
            type="file"
            accept="application/pdf"
            onChange={e => e.target.files && handleFile(e.target.files[0])}
            disabled={loading}
            style={{
              width: "100%", color: "#ccc", fontSize: 13,
              opacity: loading ? 0.5 : 1
            }}
          />

          {loading && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12, color: "#888" }}>
                <span>Обработка...</span>
                <span>{progress}%</span>
              </div>
              <div style={{ width: "100%", height: 4, background: "#333", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${progress}%`, height: "100%", background: "#2e8", transition: "width 0.1s linear" }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Список */}
      <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        {pages && pages.length > 0 ? (
          pages.map(page => (
            <div
              key={page.id}
              onClick={() => onPageSelect(page.id)}
              style={{
                marginBottom: 16, cursor: "pointer",
                border: activePageId === page.id ? "2px solid #0af" : "2px solid transparent",
                borderRadius: 6, overflow: "hidden", transition: "0.2s",
                opacity: activePageId && activePageId !== page.id ? 0.6 : 1,
                background: "#000"
              }}
            >
              <div style={{ padding: "4px 8px", background: "#222", color: "#aaa", fontSize: 12, borderBottom: "1px solid #333" }}>
                Страница {page.id}
              </div>
              <img src={page.imageUrl} style={{ width: "100%", display: "block", opacity: 0.8 }} />
            </div>
          ))
        ) : (
          <div style={{ color: "#555", textAlign: "center", marginTop: 40, fontSize: 13, lineHeight: 1.5 }}>
            {!loading && <>Нет документов.<br />Загрузите PDF файл.</>}
          </div>
        )}
      </div>
    </div>
  );
}