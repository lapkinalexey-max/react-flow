import { useRef, useState, useEffect } from "react";
import schema from "./schema.json";
import './TableStyles.css';
import PdfLoader from "./components/PdfLoader";
import LeftSidebar from "./components/LeftSidebar";



type Pos = { x: number; y: number };
type DragState = { id: string; offsetX: number; offsetY: number } | null;

type Connection = {
  fromRow?: number;
  toRow?: number;
  fromTable?: string;
  toTable?: string;
};

type LinkingState = {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  source: "leftRow" | "rightTable";
  sourceId: number | string;
} | null;

type ContextMenuState = { x: number; y: number; connectionIndex: number } | null;

type EditingCell =
  | { table: "left"; row: number; col: number }
  | { table: "right"; tableId: string; row: number; col: number }
  | null;

type ColumnWidths = Record<string, number[]>;

const GRID_SIZE = 20;
const START_X = 520;
const START_Y = 40;
const STEP_Y = 200;
const MIN_COLUMN_WIDTH = 60;
const DEFAULT_COLUMN_WIDTH = 120;
const ROW_HEIGHT = 40;
const ACTION_COLUMN_WIDTH = 60;
const NUMBER_COLUMN_WIDTH = 60; // ширина столбца с номером строки

function snap(v: number) {
  return Math.round(v / GRID_SIZE) * GRID_SIZE;
}

function buildInitialPositions(): Record<string, Pos> {
  const pos: Record<string, Pos> = { left: { x: 40, y: 80 } };
  schema.rightTables.forEach((t: any, i: number) => {
    pos[t.id] = { x: START_X, y: START_Y + i * STEP_Y };
  });
  return pos;
}

export default function App() {
  const [positions, setPositions] = useState<Record<string, Pos>>(buildInitialPositions);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [linking, setLinking] = useState<LinkingState>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [svgSize, setSvgSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  const [data, setData] = useState(() => JSON.parse(JSON.stringify(schema)));

  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(() => {
    const widths: ColumnWidths = { left: schema.leftTable.columns.map(() => DEFAULT_COLUMN_WIDTH) };
    schema.rightTables.forEach((t: any) => {
      widths[t.id] = t.columns.map(() => DEFAULT_COLUMN_WIDTH);
    });
    return widths;
  });

  const [editing, setEditing] = useState<EditingCell>(null);
  const [selectedCell, setSelectedCell] = useState<EditingCell>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const resizeDrag = useRef<{ tableKey: string; colIndex: number; startX: number; startWidth: number } | null>(null);
  const leftRowRefs = useRef<(HTMLTableRowElement | null)[]>([]);
  const rightPortRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const dragRef = useRef<DragState>(null);

  const [deleteConfirm, setDeleteConfirm] = useState<{
    tableKey: "left" | string;
    rowIndex: number;
  } | null>(null);

  useEffect(() => {
    const updateSize = () => {
      setSvgSize({
        width: Math.max(document.documentElement.scrollWidth, window.innerWidth),
        height: Math.max(document.documentElement.scrollHeight, window.innerHeight),
      });
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    window.addEventListener("scroll", updateSize);
    return () => {
      window.removeEventListener("resize", updateSize);
      window.removeEventListener("scroll", updateSize);
    };
  }, []);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedCell) return;

      if (e.key === "Escape" && editing) {
        setEditing(null);
        e.preventDefault();
        return;
      }

      if (e.key === "Enter") {
        if (editing && inputRef.current) {
          saveEdit(inputRef.current.value);
        } else if (selectedCell) {
          setEditing(selectedCell);
        }
        e.preventDefault();
        return;
      }

      if (!editing && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        if (e.key === "ArrowUp") moveSelection("up");
        if (e.key === "ArrowDown") moveSelection("down");
        if (e.key === "ArrowLeft") moveSelection("left");
        if (e.key === "ArrowRight") moveSelection("right");
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editing, selectedCell]);

  const moveSelection = (direction: "up" | "down" | "left" | "right") => {
    if (!selectedCell) return;

    let newCell: EditingCell | null = null;

    if (selectedCell.table === "left") {
      const rows = data.leftTable.rows.length;
      const cols = data.leftTable.columns.length;
      let row = selectedCell.row;
      let col = selectedCell.col;

      if (direction === "up" && row > 0) row--;
      if (direction === "down" && row < rows - 1) row++;
      if (direction === "left" && col > 0) col--;
      if (direction === "right" && col < cols - 1) col++;

      newCell = { table: "left", row, col };
    } else {
      const table = data.rightTables.find(t => t.id === selectedCell.tableId);
      if (!table) return;
      const rows = table.rows.length;
      const cols = table.columns.length;
      let row = selectedCell.row;
      let col = selectedCell.col;

      if (direction === "up" && row > 0) row--;
      if (direction === "down" && row < rows - 1) row++;
      if (direction === "left" && col > 0) col--;
      if (direction === "right" && col < cols - 1) col++;

      newCell = { table: "right", tableId: selectedCell.tableId, row, col };
    }

    setSelectedCell(newCell);
  };

  const onMouseDownDrag = (e: React.MouseEvent, id: string, pos: Pos) => {
    if ((e.target as HTMLElement).dataset.port) return;
    dragRef.current = { id, offsetX: e.clientX - pos.x, offsetY: e.clientY - pos.y };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (dragRef.current) {
      const { id, offsetX, offsetY } = dragRef.current;
      setPositions(p => ({
        ...p,
        [id]: { x: snap(e.clientX - offsetX), y: snap(e.clientY - offsetY) },
      }));
    }

    if (linking) {
      setLinking(l => l ? { ...l, currentX: e.clientX + window.scrollX, currentY: e.clientY + window.scrollY } : null);
    }

    if (resizeDrag.current) {
      const delta = e.clientX - resizeDrag.current.startX;
      const newWidth = Math.max(MIN_COLUMN_WIDTH, resizeDrag.current.startWidth + delta);
      setColumnWidths(prev => {
        const widths = [...prev[resizeDrag.current!.tableKey]];
        widths[resizeDrag.current!.colIndex] = newWidth;
        return { ...prev, [resizeDrag.current!.tableKey]: widths };
      });
    }
  };

  const onMouseUp = (e: React.MouseEvent) => {
    dragRef.current = null;
    resizeDrag.current = null;

    if (linking) {
      const target = e.target as HTMLElement;
      if (!target.dataset.port && !target.closest('[data-port]')) {
        setLinking(null);
      }
    }
  };

  const getAbsolutePosition = (el: HTMLElement | null) => {
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY + rect.height / 2,
    };
  };

  const rowRight = (rowIndex: number) => {
    const rowEl = leftRowRefs.current[rowIndex];
    if (!rowEl) return null;
    const port = rowEl.querySelector('[data-port="out"]') as HTMLElement;
    return getAbsolutePosition(port || (rowEl.lastElementChild as HTMLElement));
  };

  const tableLeftPort = (tableId: string) => {
    const el = rightPortRefs.current[tableId];
    return getAbsolutePosition(el);
  };

  const startLinking = (source: "leftRow" | "rightTable", id: number | string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (linking) return;

    const point = source === "leftRow"
      ? rowRight(id as number)
      : tableLeftPort(id as string);

    if (!point) return;

    setLinking({
      source,
      sourceId: id,
      startX: point.x,
      startY: point.y,
      currentX: point.x,
      currentY: point.y,
    });
  };

  const finishLinking = (target: "leftRow" | "rightTable", id: number | string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!linking || linking.source === target) return;

    const newConn: Connection = linking.source === "leftRow"
      ? { fromRow: linking.sourceId as number, toTable: id as string }
      : { fromTable: linking.sourceId as string, toRow: id as number };

    setConnections(c => [...c, newConn]);
    setLinking(null);
  };

  const deleteConnection = (index: number) => {
    setConnections(c => c.filter((_, i) => i !== index));
    setContextMenu(null);
  };

  const startEdit = (cell: EditingCell, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditing(cell);
    setSelectedCell(cell);
  };

  const saveEdit = (value: string) => {
    if (!editing) return;

    setData(prev => {
      const newData = { ...prev };
      if (editing.table === "left") {
        newData.leftTable.rows[editing.row][editing.col] = value;
      } else {
        const table = newData.rightTables.find((t: any) => t.id === editing.tableId);
        if (table) table.rows[editing.row][editing.col] = value;
      }
      return newData;
    });

    setEditing(null);
    moveSelection("down");
  };

  const addRow = (tableKey: "left" | string) => {
    setData(prev => {
      const newData = { ...prev };
      const colCount = tableKey === "left"
        ? newData.leftTable.columns.length
        : newData.rightTables.find((t: any) => t.id === tableKey)!.columns.length;
      const emptyRow = new Array(colCount).fill("");

      if (tableKey === "left") {
        newData.leftTable.rows.push(emptyRow);
      } else {
        const table = newData.rightTables.find((t: any) => t.id === tableKey);
        if (table) table.rows.push(emptyRow);
      }
      return newData;
    });
  };

  const requestDeleteRow = (tableKey: "left" | string, rowIndex: number) => {
    let row: string[];
    if (tableKey === "left") {
      row = data.leftTable.rows[rowIndex];
    } else {
      const table = data.rightTables.find((t: any) => t.id === tableKey);
      if (!table) return;
      row = table.rows[rowIndex];
    }

    const isEmpty = row.every(cell => cell.trim() === "");

    if (isEmpty) {
      performDeleteRow(tableKey, rowIndex);
    } else {
      setDeleteConfirm({ tableKey, rowIndex });
    }
  };

  const performDeleteRow = (tableKey: "left" | string, rowIndex: number) => {
    setData(prev => {
      const newData = { ...prev };
      if (tableKey === "left") {
        newData.leftTable.rows.splice(rowIndex, 1);
        leftRowRefs.current[rowIndex] = null;
      } else {
        const table = newData.rightTables.find((t: any) => t.id === tableKey);
        if (table) table.rows.splice(rowIndex, 1);
      }
      return newData;
    });
    setDeleteConfirm(null);
  };

  const cellStyle: React.CSSProperties = {
    padding: "4px 8px",
    whiteSpace: "nowrap",
    position: "relative",
    boxSizing: "border-box",
  };

  const headerCellStyle: React.CSSProperties = {
    ...cellStyle,
    userSelect: "none",
    height: 36,
  };

  const actionButtonStyle: React.CSSProperties = {
    width: 36,
    height: 36,
    background: "#1e1e1e",
    border: "1px solid #444",
    borderRadius: "8px",
    fontSize: "24px",
    fontWeight: "bold",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
  };

  const isSelected = (cell: EditingCell) => {
    if (!selectedCell) return false;
    if (selectedCell.table !== cell.table) return false;
    if (selectedCell.row !== cell.row || selectedCell.col !== cell.col) return false;
    if (selectedCell.table === "right" && selectedCell.tableId !== (cell as any).tableId) return false;
    return true;
  };

  return (
    <>
    <LeftSidebar />
      <div
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onClick={() => setContextMenu(null)}
        onContextMenu={e => linking && (e.preventDefault(), e.stopPropagation(), setLinking(null))}
        style={{ position: "relative", minWidth: "100vw", minHeight: "100vh", background: "#111", color: "#fff", fontFamily: "Arial, sans-serif", paddingLeft: 320 }}
      >
        <svg width={svgSize.width} height={svgSize.height} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
          {connections.map((conn, i) => {
            let start = null, end = null;

            if (conn.fromRow !== undefined && conn.toTable !== undefined) {
              start = rowRight(conn.fromRow);
              end = tableLeftPort(conn.toTable);
            } else if (conn.fromTable !== undefined && conn.toRow !== undefined) {
              start = tableLeftPort(conn.fromTable);
              end = rowRight(conn.toRow);
            }

            if (!start || !end) return null;

            const dx = Math.abs(end.x - start.x) * 0.5;
            const dirX = end.x > start.x ? 1 : -1;
            const d = `M ${start.x} ${start.y} C ${start.x + dirX * dx} ${start.y}, ${end.x - dirX * dx} ${end.y}, ${end.x} ${end.y}`;

            return (
              <g key={i} style={{ pointerEvents: "stroke" }}>
                <path d={d} fill="none" stroke="transparent" strokeWidth={16}
                  onContextMenu={e => (e.preventDefault(), e.stopPropagation(), setContextMenu({ x: e.clientX, y: e.clientY, connectionIndex: i }))} />
                <path d={d} fill="none" stroke="#ff4444" strokeWidth={3} pointerEvents="none" />
              </g>
            );
          })}

          {linking && (() => {
            const startPoint = linking.source === "leftRow"
              ? rowRight(linking.sourceId as number)
              : tableLeftPort(linking.sourceId as string);

            if (!startPoint) return null;

            const endX = linking.currentX;
            const endY = linking.currentY;

            const dx = Math.abs(endX - startPoint.x) * 0.5;
            const dirX = endX > startPoint.x ? 1 : -1;
            const d = `M ${startPoint.x} ${startPoint.y} C ${startPoint.x + dirX * dx} ${startPoint.y}, ${endX - dirX * dx} ${endY}, ${endX} ${endY}`;

            return <path d={d} fill="none" stroke="#ff6666" strokeWidth={3} strokeDasharray="8 5" pointerEvents="none" />;
          })()}
        </svg>

        {contextMenu && (
          <div style={{ position: "fixed", left: contextMenu.x, top: contextMenu.y, background: "#222", border: "1px solid #444", padding: "4px 0", zIndex: 1000, fontSize: 13 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: "6px 16px", cursor: "pointer" }} onClick={() => deleteConnection(contextMenu.connectionIndex)}>
              🗑 Удалить связь
            </div>
          </div>
        )}

        {deleteConfirm && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }} onClick={() => setDeleteConfirm(null)}>
            <div style={{ background: "#222", padding: "24px", borderRadius: "12px", border: "1px solid #555", minWidth: 300, textAlign: "center" }} onClick={e => e.stopPropagation()}>
              <h3 style={{ margin: "0 0 16px 0" }}>Удалить строку?</h3>
              <p style={{ margin: "0 0 24px 0", color: "#ccc" }}>В строке есть данные. Удалить безвозвратно?</p>
              <div style={{ display: "flex", gap: "16px", justifyContent: "center", marginTop: "8px" }}>
                <button
                  onClick={() => performDeleteRow(deleteConfirm.tableKey, deleteConfirm.rowIndex)}
                  style={{
                    padding: "10px 24px",
                    background: "#c33",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "500",
                    minWidth: "120px",
                  }}
                >
                  Да, удалить
                </button>
                <button
                  onClick={() => setDeleteConfirm(null)}
                  style={{
                    padding: "10px 24px",
                    background: "#333",
                    color: "#fff",
                    border: "1px solid #555",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "500",
                    minWidth: "100px",
                  }}
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Левая таблица с нумерацией строк */}
        <table border={1} onMouseDown={e => onMouseDownDrag(e, "left", positions.left)}
          style={{ position: "absolute", left: positions.left.x, top: positions.left.y, borderCollapse: "collapse", background: "#111", cursor: "move", userSelect: "none" }}>
          <thead>
            <tr>
              <th colSpan={data.leftTable.columns.length + 2} style={headerCellStyle}>{data.leftTable.title}</th>
            </tr>
            <tr>
              <th style={{ ...headerCellStyle, width: ACTION_COLUMN_WIDTH }}></th>
              <th style={{ ...headerCellStyle, width: NUMBER_COLUMN_WIDTH, textAlign: "center" }}>№</th>
              {data.leftTable.columns.map((colName: string, colIdx: number) => (
                <th key={colIdx} style={{ ...headerCellStyle, width: columnWidths.left[colIdx] }}>
                  {colName}
                  <div
                    style={{ position: "absolute", right: 0, top: 0, width: 5, height: "100%", cursor: "col-resize", background: "transparent" }}
                    onMouseDown={e => {
                      e.stopPropagation();
                      resizeDrag.current = { tableKey: "left", colIndex: colIdx, startX: e.clientX, startWidth: columnWidths.left[colIdx] };
                    }}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.leftTable.rows.map((row: string[], rowIdx: number) => (
              <tr key={rowIdx} ref={el => (leftRowRefs.current[rowIdx] = el)} style={{ height: ROW_HEIGHT }}>
                <td style={{ ...cellStyle, width: ACTION_COLUMN_WIDTH, padding: "4px", textAlign: "center" }}>
                  <button
                    className="delete-row"
                    onClick={(e) => {
                      e.stopPropagation();
                      requestDeleteRow("left", rowIdx);
                    }}
                    style={actionButtonStyle}
                    onMouseOver={e => e.currentTarget.style.background = "#2a2a2a"}
                    onMouseOut={e => e.currentTarget.style.background = "#1e1e1e"}
                  >
                    −
                  </button>
                </td>
                <td style={{ ...cellStyle, width: NUMBER_COLUMN_WIDTH, textAlign: "center", fontWeight: "bold" }}>
                  {rowIdx + 1}
                </td>
                {row.map((cell: string, colIdx: number) => {
                  const cellKey: EditingCell = { table: "left", row: rowIdx, col: colIdx };
                  const isEditing = editing?.table === "left" && editing.row === rowIdx && editing.col === colIdx;
                  return (
                    <td
                      key={colIdx}
                      className={isSelected(cellKey) ? "selected" : ""}
                      style={{ ...cellStyle, width: columnWidths.left[colIdx] }}
                      onClick={() => setSelectedCell(cellKey)}
                      onDoubleClick={e => startEdit(cellKey, e)}
                    >
                      {isEditing ? (
                        <input ref={inputRef} type="text" defaultValue={cell}
                          style={{ background: "#333", color: "#fff", border: "1px solid #555", padding: "2px 4px", width: "100%", height: "100%" }}
                          onBlur={e => saveEdit(e.target.value)}
                          onKeyDown={e => { if (e.key === "Escape") setEditing(null); }}
                        />
                      ) : (
                        <>
                          {cell}
                          {colIdx === row.length - 1 && (
                            <span data-port="out"
                              onMouseDown={e => startLinking("leftRow", rowIdx, e)}
                              onMouseUp={e => finishLinking("leftRow", rowIdx, e)}
                              style={{ position: "absolute", right: -6, top: "50%", width: 10, height: 10, borderRadius: "50%", background: "red", transform: "translateY(-50%)", cursor: "crosshair" }}
                            />
                          )}
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}

            <tr style={{ height: ROW_HEIGHT }}>
              <td style={{ ...cellStyle, width: ACTION_COLUMN_WIDTH, padding: "4px", textAlign: "center" }}>
                <button
                  className="add-row"
                  onClick={() => addRow("left")}
                  style={actionButtonStyle}
                  onMouseOver={e => e.currentTarget.style.background = "#2a2a2a"}
                  onMouseOut={e => e.currentTarget.style.background = "#1e1e1e"}
                >
                  +
                </button>
              </td>
              <td style={{ ...cellStyle, width: NUMBER_COLUMN_WIDTH }}></td>
              {data.leftTable.columns.map((_, i) => <td key={i} style={{ border: "none" }} />)}
            </tr>
          </tbody>
        </table>

        {/* Правые таблицы с нумерацией строк */}
        {data.rightTables.map((t: any) => (
          <table key={t.id} border={1} onMouseDown={e => onMouseDownDrag(e, t.id, positions[t.id])}
            style={{ position: "absolute", left: positions[t.id].x, top: positions[t.id].y, borderCollapse: "collapse", background: "#111", cursor: "move", userSelect: "none" }}>
            <thead>
              <tr>
                <th colSpan={t.columns.length + 2} style={headerCellStyle}>
                  {t.title}
                  <span data-port="in" ref={el => (rightPortRefs.current[t.id] = el)}
                    onMouseDown={e => startLinking("rightTable", t.id, e)}
                    onMouseUp={e => finishLinking("rightTable", t.id, e)}
                    style={{ position: "absolute", left: -6, top: "50%", width: 10, height: 10, borderRadius: "50%", background: "red", transform: "translateY(-50%)", cursor: "crosshair" }}
                  />
                </th>
              </tr>
              <tr>
                <th style={{ ...headerCellStyle, width: ACTION_COLUMN_WIDTH }}></th>
                <th style={{ ...headerCellStyle, width: NUMBER_COLUMN_WIDTH, textAlign: "center" }}>№</th>
                {t.columns.map((colName: string, colIdx: number) => (
                  <th key={colIdx} style={{ ...headerCellStyle, width: columnWidths[t.id][colIdx] }}>
                    {colName}
                    <div
                      style={{ position: "absolute", right: 0, top: 0, width: 5, height: "100%", cursor: "col-resize", background: "transparent" }}
                      onMouseDown={e => {
                        e.stopPropagation();
                        resizeDrag.current = { tableKey: t.id, colIndex: colIdx, startX: e.clientX, startWidth: columnWidths[t.id][colIdx] };
                      }}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.rows.map((row: string[], rowIdx: number) => (
                <tr key={rowIdx} style={{ height: ROW_HEIGHT }}>
                  <td style={{ ...cellStyle, width: ACTION_COLUMN_WIDTH, padding: "4px", textAlign: "center" }}>
                    <button
                      className="delete-row"
                      onClick={(e) => {
                        e.stopPropagation();
                        requestDeleteRow(t.id, rowIdx);
                      }}
                      style={actionButtonStyle}
                      onMouseOver={e => e.currentTarget.style.background = "#2a2a2a"}
                      onMouseOut={e => e.currentTarget.style.background = "#1e1e1e"}
                    >
                      −
                    </button>
                  </td>
                  <td style={{ ...cellStyle, width: NUMBER_COLUMN_WIDTH, textAlign: "center", fontWeight: "bold" }}>
                    {rowIdx + 1}
                  </td>
                  {row.map((cell: string, colIdx: number) => {
                    const cellKey: EditingCell = { table: "right", tableId: t.id, row: rowIdx, col: colIdx };
                    const isEditing = editing?.table === "right" && editing.tableId === t.id && editing.row === rowIdx && editing.col === colIdx;
                    return (
                      <td
                        key={colIdx}
                        className={isSelected(cellKey) ? "selected" : ""}
                        style={{ ...cellStyle, width: columnWidths[t.id][colIdx] }}
                        onClick={() => setSelectedCell(cellKey)}
                        onDoubleClick={e => startEdit(cellKey, e)}
                      >
                        {isEditing ? (
                          <input ref={inputRef} type="text" defaultValue={cell}
                            style={{ background: "#333", color: "#fff", border: "1px solid #555", padding: "2px 4px", width: "100%", height: "100%" }}
                            onBlur={e => saveEdit(e.target.value)}
                            onKeyDown={e => { if (e.key === "Escape") setEditing(null); }}
                          />
                        ) : cell}
                      </td>
                    );
                  })}
                </tr>
              ))}

              <tr style={{ height: ROW_HEIGHT }}>
                <td style={{ ...cellStyle, width: ACTION_COLUMN_WIDTH, padding: "4px", textAlign: "center" }}>
                  <button
                    className="add-row"
                    onClick={() => addRow(t.id)}
                    style={actionButtonStyle}
                    onMouseOver={e => e.currentTarget.style.background = "#2a2a2a"}
                    onMouseOut={e => e.currentTarget.style.background = "#1e1e1e"}
                  >
                    +
                  </button>
                </td>
                <td style={{ ...cellStyle, width: NUMBER_COLUMN_WIDTH }}></td>
                {t.columns.map((_, i) => <td key={i} style={{ border: "none" }} />)}
              </tr>
            </tbody>
          </table>
        ))}
      </div>
    </>
  );
}