import { useState, useRef, useCallback, useEffect } from "react";
import { type PdfPage } from "../types";
// Импорт сервиса распознавания
import { extractTableFromPdf } from "../services/TableRecognitionService";

type Props = {
  page: PdfPage;
  onClose: () => void;
  onImport: (rows: string[][]) => void;
};

type SelectionRect = {
  startX: number; startY: number; width: number; height: number;
};

type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export default function PdfWorkspace({ page, onClose, onImport }: Props) {
  // --- STATE ---
  const [selection, setSelection] = useState<SelectionRect | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [draggedHandle, setDraggedHandle] = useState<ResizeHandle | null>(null);

  // Preview State
  const [previewData, setPreviewData] = useState<string[][] | null>(null);

  // Transform State
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePosition, setLastMousePosition] = useState({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // --- ЭФФЕКТЫ ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.code === "Space") setIsSpacePressed(true); };
    const handleKeyUp = (e: KeyboardEvent) => { if (e.code === "Space") setIsSpacePressed(false); };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // --- МАТЕМАТИКА ---
  const getPdfCoords = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - transform.x) / transform.scale,
      y: (clientY - rect.top - transform.y) / transform.scale
    };
  }, [transform]);

  const getNormalizedRect = useCallback(() => {
    if (!selection) return null;
    const { startX, startY, width, height } = selection;
    const x1 = Math.min(startX, startX + width);
    const x2 = Math.max(startX, startX + width);
    const y1 = Math.min(startY, startY + height);
    const y2 = Math.max(startY, startY + height);
    return { left: x1, top: y1, right: x2, bottom: y2, width: x2 - x1, height: y2 - y1 };
  }, [selection]);

  // --- ОБРАБОТЧИКИ ---
  const handleProcessTable = () => {
    const rect = getNormalizedRect();
    if (!rect) return;
    const tableData = extractTableFromPdf(page, rect);
    if (tableData) setPreviewData(tableData);
    else alert("В выделенной области не найден текст.");
  };

  const handleImport = () => {
    if (previewData) onImport(previewData);
  };

  // --- Zoom & Pan ---
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault(); e.stopPropagation();
    const ZOOM_SPEED = 0.001; const minScale = 0.1; const maxScale = 5;
    const delta = -e.deltaY;
    const scaleChange = Math.exp(delta * ZOOM_SPEED);
    const newScale = Math.min(maxScale, Math.max(minScale, transform.scale * scaleChange));
    const rect = containerRef.current!.getBoundingClientRect();
    const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top;
    const newX = mouseX - (mouseX - transform.x) * (newScale / transform.scale);
    const newY = mouseY - (mouseY - transform.y) * (newScale / transform.scale);
    setTransform({ x: newX, y: newY, scale: newScale });
  };
  const handleZoomIn = () => setTransform(p => ({ ...p, scale: Math.min(5, p.scale * 1.2) }));
  const handleZoomOut = () => setTransform(p => ({ ...p, scale: Math.max(0.1, p.scale / 1.2) }));
  const handleFitView = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scale = (rect.width - 100) / page.viewport.width;
    setTransform({ x: 50, y: 50, scale });
  };

  // --- Mouse Actions ---
  const onMouseDownCanvas = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && isSpacePressed)) {
      e.preventDefault(); setIsPanning(true); setLastMousePosition({ x: e.clientX, y: e.clientY }); return;
    }
    if ((e.target as HTMLElement).dataset.handle) return;
    if (e.button === 0) {
      const { x, y } = getPdfCoords(e.clientX, e.clientY);
      setIsCreating(true); setSelection({ startX: x, startY: y, width: 0, height: 0 });
    }
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const deltaX = e.clientX - lastMousePosition.x; const deltaY = e.clientY - lastMousePosition.y;
      setTransform(prev => ({ ...prev, x: prev.x + deltaX, y: prev.y + deltaY }));
      setLastMousePosition({ x: e.clientX, y: e.clientY }); return;
    }
    const { x, y } = getPdfCoords(e.clientX, e.clientY);
    if (isCreating && selection) { setSelection({ ...selection, width: x - selection.startX, height: y - selection.startY }); return; }
    if (draggedHandle && selection) {
      const rect = getNormalizedRect(); if (!rect) return;
      let newSel = { ...selection };
      switch (draggedHandle) {
        case 'e': newSel.startX = rect.left; newSel.width = x - rect.left; break;
        case 'w': newSel.startX = x; newSel.width = rect.right - x; break;
        case 's': newSel.startY = rect.top; newSel.height = y - rect.top; break;
        case 'n': newSel.startY = y; newSel.height = rect.bottom - y; break;
        case 'se': newSel.startX = rect.left; newSel.width = x - rect.left; newSel.startY = rect.top; newSel.height = y - rect.top; break;
        case 'sw': newSel.startX = x; newSel.width = rect.right - x; newSel.startY = rect.top; newSel.height = y - rect.top; break;
        case 'ne': newSel.startX = rect.left; newSel.width = x - rect.left; newSel.startY = y; newSel.height = rect.bottom - y; break;
        case 'nw': newSel.startX = x; newSel.width = rect.right - x; newSel.startY = y; newSel.height = rect.bottom - y; break;
      }
      setSelection(newSel);
    }
  };
  const onMouseUp = () => {
    setIsPanning(false); setIsCreating(false); setDraggedHandle(null);
    if (selection) { const rect = getNormalizedRect(); if (rect && (rect.width < 5 || rect.height < 5)) setSelection(null); else if (rect) setSelection({ startX: rect.left, startY: rect.top, width: rect.width, height: rect.height }); }
  };
  const onMouseDownHandle = (e: React.MouseEvent, handle: ResizeHandle) => { e.stopPropagation(); e.preventDefault(); if (e.button === 0) setDraggedHandle(handle); };

  // --- STYLES ---
  const normalizedRect = getNormalizedRect();
  const handleStyle: React.CSSProperties = { position: 'absolute', width: 8, height: 8, background: '#fff', border: '1px solid #0af', zIndex: 20, pointerEvents: 'auto', boxSizing: 'border-box', transform: `scale(${1 / transform.scale})` };
  const zoomBtnStyle: React.CSSProperties = { width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "#222", color: "#fff", border: "1px solid #444", borderBottom: "none", cursor: "pointer" };
  const headerBtnStyle: React.CSSProperties = {
    padding: "8px 16px", borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: "pointer",
    whiteSpace: "nowrap", minWidth: "max-content", flexShrink: 0 // 👈 ГАРАНТИЯ ШИРИНЫ
  };
  const cursorStyle = isPanning ? "grabbing" : isSpacePressed ? "grab" : isCreating ? "crosshair" : "default";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100vh", background: "#111" }}>

      {/* 1. HEADER (Исправлен layout) */}
      <div style={{
        height: 60, background: "#252526", borderBottom: "1px solid #333",
        display: "flex", alignItems: "center", padding: "0 20px", justifyContent: "space-between",
        zIndex: 200, flexShrink: 0, position: "relative" // zIndex 200 чтобы быть выше всего
      }}>
        {/* Левая часть: flex: 1 и minWidth: 0 позволяют тексту сокращаться, если места мало */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, overflow: "hidden", flex: 1, minWidth: 0 }}>
          <span style={{ background: "#0af", color: "#000", padding: "2px 6px", borderRadius: 4, fontSize: 12, fontWeight: "bold", flexShrink: 0 }}>PDF</span>
          <span style={{ color: "#eee", fontWeight: 600, fontSize: 16, whiteSpace: "nowrap" }}>Стр. {page.id}</span>
          <span style={{ color: "#777", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            — Выделите таблицу мышкой
          </span>
        </div>

        {/* Правая часть: flexShrink: 0 гарантирует, что кнопки НЕ исчезнут */}
        <div style={{ display: 'flex', gap: 12, flexShrink: 0, marginLeft: 16 }}>
          {selection && (
            <button onClick={handleProcessTable} style={{ ...headerBtnStyle, background: "#2e8", color: "#000", border: "none" }}>
              Распознать
            </button>
          )}
          <button onClick={onClose} style={{ ...headerBtnStyle, background: "#333", color: "#ddd", border: "1px solid #555" }}>
            Закрыть
          </button>
        </div>
      </div>

      {/* 2. WORKSPACE */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <div ref={containerRef} onWheel={handleWheel} onMouseDown={onMouseDownCanvas} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp} style={{ width: "100%", height: "100%", cursor: cursorStyle, userSelect: "none" }}>
          <div style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`, transformOrigin: "0 0", width: "fit-content", height: "fit-content", pointerEvents: "none" }}>
            <img src={page.imageUrl} style={{ display: "block", boxShadow: "0 0 50px rgba(0,0,0,0.5)", pointerEvents: "auto" }} draggable={false} />
            {normalizedRect && (
              <div style={{ position: "absolute", left: normalizedRect.left, top: normalizedRect.top, width: normalizedRect.width, height: normalizedRect.height, border: `${2 / transform.scale}px solid #0af`, background: "rgba(0, 170, 255, 0.1)", pointerEvents: "auto", zIndex: 10 }}>
                {!isCreating && !draggedHandle && <>
                  {/* Ручки изменения размера */}
                  <div data-handle="nw" onMouseDown={e => onMouseDownHandle(e, 'nw')} style={{ ...handleStyle, top: 0, left: 0, cursor: 'nwse-resize', transform: `translate(-50%, -50%) scale(${1 / transform.scale})` }} />
                  <div data-handle="se" onMouseDown={e => onMouseDownHandle(e, 'se')} style={{ ...handleStyle, bottom: 0, right: 0, cursor: 'nwse-resize', transform: `translate(50%, 50%) scale(${1 / transform.scale})` }} />
                  <div data-handle="ne" onMouseDown={e => onMouseDownHandle(e, 'ne')} style={{ ...handleStyle, top: 0, right: 0, cursor: 'nesw-resize', transform: `translate(50%, -50%) scale(${1 / transform.scale})` }} />
                  <div data-handle="sw" onMouseDown={e => onMouseDownHandle(e, 'sw')} style={{ ...handleStyle, bottom: 0, left: 0, cursor: 'nesw-resize', transform: `translate(-50%, 50%) scale(${1 / transform.scale})` }} />
                  <div data-handle="n" onMouseDown={e => onMouseDownHandle(e, 'n')} style={{ ...handleStyle, top: 0, left: '50%', cursor: 'ns-resize', transform: `translate(-50%, -50%) scale(${1 / transform.scale})` }} />
                  <div data-handle="s" onMouseDown={e => onMouseDownHandle(e, 's')} style={{ ...handleStyle, bottom: 0, left: '50%', cursor: 'ns-resize', transform: `translate(-50%, 50%) scale(${1 / transform.scale})` }} />
                  <div data-handle="w" onMouseDown={e => onMouseDownHandle(e, 'w')} style={{ ...handleStyle, left: 0, top: '50%', cursor: 'ew-resize', transform: `translate(-50%, -50%) scale(${1 / transform.scale})` }} />
                  <div data-handle="e" onMouseDown={e => onMouseDownHandle(e, 'e')} style={{ ...handleStyle, right: 0, top: '50%', cursor: 'ew-resize', transform: `translate(50%, -50%) scale(${1 / transform.scale})` }} />
                </>}
              </div>
            )}
          </div>
        </div>

        {/* Кнопки зума */}
        <div style={{ position: "absolute", bottom: 20, left: 20, display: "flex", flexDirection: "column", boxShadow: "0 4px 12px rgba(0,0,0,0.4)", borderRadius: 4, overflow: "hidden", zIndex: 100 }}>
          <button onClick={handleZoomIn} style={zoomBtnStyle} title="Zoom In">+</button>
          <button onClick={handleZoomOut} style={zoomBtnStyle} title="Zoom Out">−</button>
          <button onClick={handleFitView} style={{ ...zoomBtnStyle, borderBottom: "none" }} title="Fit View">⛶</button>
        </div>
      </div>

      {/* 3. PREVIEW MODAL */}
      {previewData && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 40 }}>
          <div style={{ background: "#1e1e1e", border: "1px solid #444", borderRadius: 12, display: "flex", flexDirection: "column", maxWidth: "90%", maxHeight: "90%", boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #333", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, color: "#fff" }}>Результат распознавания</h3>
              <button onClick={() => setPreviewData(null)} style={{ background: "transparent", border: "none", color: "#888", cursor: "pointer", fontSize: 24 }}>&times;</button>
            </div>
            <div style={{ padding: 24, overflow: "auto", flex: 1 }}>
              <table style={{ borderCollapse: "collapse", width: "100%", color: "#ccc", fontSize: 14 }}>
                <tbody>
                  {previewData.map((row, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #333" }}>
                      {row.map((cell, j) => (
                        <td key={j} style={{ padding: "8px 12px", borderRight: "1px solid #333", background: i === 0 ? "#252526" : "transparent", fontWeight: i === 0 ? "bold" : "normal" }}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: "16px 24px", borderTop: "1px solid #333", display: "flex", justifyContent: "flex-end", gap: 12, background: "#252526", borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
              <button onClick={() => setPreviewData(null)} style={{ padding: "10px 20px", background: "#333", color: "#ddd", border: "1px solid #555", borderRadius: 6, cursor: "pointer" }}>Отмена</button>
              <button onClick={handleImport} style={{ padding: "10px 20px", background: "#2e8", color: "#000", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold" }}>
                Добавить в граф
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}