import type { TextItem } from "pdfjs-dist/types/src/display/api";
import type { PageViewport } from "pdfjs-dist";

export type PdfPage = {
  id: number;           // Номер страницы
  imageUrl: string;     // Blob URL картинки (PNG)
  textItems: TextItem[]; // Слой текста для поиска
  viewport: PageViewport; // Размеры и метаданные
};