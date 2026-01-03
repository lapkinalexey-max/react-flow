import * as pdfjsLib from "pdfjs-dist";
import { type PdfPage } from "../types";
import Tesseract from 'tesseract.js';

// --- ТИПЫ ---
type UniversalTextItem = {
    str: string;
    x: number;
    y: number;
    width: number;
    height: number;
    bottom: number;
    right: number;
};

type Rect = {
    left: number; top: number; right: number; bottom: number; width: number; height: number;
};

const CONFIG = {
    ROW_TOLERANCE: 10,
    COLUMN_GAP_THRESHOLD: 15
};

// --- ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ (КЛАСТЕРИЗАЦИЯ) ---
const clusterItemsToTable = (items: UniversalTextItem[]): string[][] | null => {
    if (items.length === 0) return null;

    items.sort((a, b) => a.y - b.y);

    const rows: UniversalTextItem[][] = [];
    let currentRow: UniversalTextItem[] = [];
    let currentY = items[0].y;

    items.forEach(item => {
        if (Math.abs(item.y - currentY) > CONFIG.ROW_TOLERANCE) {
            if (currentRow.length > 0) rows.push(currentRow);
            currentRow = [item];
            currentY = item.y;
        } else {
            currentRow.push(item);
        }
    });
    if (currentRow.length > 0) rows.push(currentRow);

    const finalTable: string[][] = [];

    rows.forEach(rowItems => {
        rowItems.sort((a, b) => a.x - b.x);

        const cells: string[] = [];
        let currentCellText = "";
        let lastItemRight = -999;

        rowItems.forEach(item => {
            if (lastItemRight !== -999 && (item.x - lastItemRight) > CONFIG.COLUMN_GAP_THRESHOLD) {
                cells.push(currentCellText.trim());
                currentCellText = item.str;
            } else {
                const space = (lastItemRight !== -999 && (item.x - lastItemRight) > 4) ? " " : "";
                currentCellText += space + item.str;
            }
            lastItemRight = item.right;
        });

        if (currentCellText) cells.push(currentCellText.trim());
        finalTable.push(cells);
    });

    const maxCols = Math.max(...finalTable.map(r => r.length));
    return finalTable.map(row => {
        const newRow = [...row];
        while (newRow.length < maxCols) newRow.push("");
        return newRow;
    });
};

// --- МЕТОД 1: Векторный + Аннотации ---
export const extractTableFromPdf = async (page: PdfPage, selectionRect: Rect): Promise<string[][] | null> => {
    const rawItems: UniversalTextItem[] = [];

    page.textItems.forEach(item => {
        const tx = pdfjsLib.Util.transform(page.viewport.transform, item.transform);
        const x = tx[4];
        const y = tx[5] - (item.height || 0);
        const w = item.width || 0;
        const h = item.height || 10;

        if (x >= selectionRect.left && x + w <= selectionRect.right && y >= selectionRect.top && y + h <= selectionRect.bottom) {
            rawItems.push({
                str: item.str, x, y, width: w, height: h, bottom: y + h, right: x + w
            });
        }
    });

    return clusterItemsToTable(rawItems);
};

// --- МЕТОД 2: OCR (Tesseract) ---
export const extractTableFromImage = async (
    imageUrl: string,
    selectionRect: Rect
): Promise<string[][] | null> => {

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = imageUrl;
    });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    canvas.width = selectionRect.width;
    canvas.height = selectionRect.height;

    ctx.drawImage(
        image,
        selectionRect.left, selectionRect.top, selectionRect.width, selectionRect.height,
        0, 0, selectionRect.width, selectionRect.height
    );

    const croppedImageUrl = canvas.toDataURL('image/png');

    const { data } = await Tesseract.recognize(croppedImageUrl, 'rus+eng', {});

    // 👇 ИСПРАВЛЕНИЕ: приводим (data as any), чтобы TS увидел свойство .words
    const ocrItems: UniversalTextItem[] = (data as any).words.map((word: any) => {
        const { x0, y0, x1, y1 } = word.bbox;
        return {
            str: word.text,
            x: x0,
            y: y0,
            width: x1 - x0,
            height: y1 - y0,
            right: x1,
            bottom: y1
        };
    });

    return clusterItemsToTable(ocrItems);
};