import { useRef, useState, useEffect } from "react";
import schema from "./schema.json";

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

const GRID_SIZE = 20;
const START_X = 520;
const START_Y = 40;
const STEP_Y = 200;

function snap(v: number) {
  return Math.round(v / GRID_SIZE) * GRID_SIZE;
}

function rowRight(el: HTMLTableRowElement | null) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.right + window.scrollX, y: r.top + r.height / 2 + window.scrollY };
}

function tableLeftPort(el: HTMLSpanElement | null) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + window.scrollX, y: r.top + r.height / 2 + window.scrollY };
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

  const leftRowRefs = useRef<HTMLTableRowElement[]>([]);
  const rightPortRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const dragRef = useRef<DragState>(null);

  // Обновляем размеры SVG при ресайзе и после монтирования
  useEffect(() => {
    const updateSize = () => {
      setSvgSize({
        width: Math.max(document.documentElement.scrollWidth, window.innerWidth),
        height: Math.max(document.documentElement.scrollHeight, window.innerHeight),
      });
    };

    updateSize(); // сразу после монтирования
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

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
  };

  const onMouseUp = (e: React.MouseEvent) => {
    dragRef.current = null;

    if (linking) {
      const target = e.target as HTMLElement;
      if (!target.dataset.port && !target.closest('[data-port]')) {
        setLinking(null);
      }
    }
  };

  const startLinking = (source: "leftRow" | "rightTable", id: number | string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (linking) return;

    const point = source === "leftRow"
      ? rowRight(leftRowRefs.current[id as number])
      : tableLeftPort(rightPortRefs.current[id as string]);

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

  const cellStyle: React.CSSProperties = { padding: "4px 8px", whiteSpace: "nowrap" };

  return (
    <div
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onClick={() => setContextMenu(null)}
      onContextMenu={e => linking && (e.preventDefault(), e.stopPropagation(), setLinking(null))}
      style={{ position: "relative", minWidth: "100vw", minHeight: "100vh", background: "#111", color: "#fff", fontFamily: "Arial, sans-serif" }}
    >
      {/* SVG */}
      <svg width={svgSize.width} height={svgSize.height} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
        {/* Постоянные связи */}
        {connections.map((conn, i) => {
          let start = null, end = null;

          if (conn.fromRow !== undefined && conn.toTable !== undefined) {
            start = rowRight(leftRowRefs.current[conn.fromRow]);
            end = tableLeftPort(rightPortRefs.current[conn.toTable]);
          } else if (conn.fromTable !== undefined && conn.toRow !== undefined) {
            start = tableLeftPort(rightPortRefs.current[conn.fromTable]);
            end = rowRight(leftRowRefs.current[conn.toRow]);
          }

          if (!start || !end) return null;

          const dx = Math.abs(end.x - start.x) * 0.4;
          const dirX = end.x > start.x ? 1 : -1;
          const d = `M ${start.x} ${start.y} C ${start.x + dirX * dx} ${start.y}, ${end.x - dirX * dx} ${end.y}, ${end.x} ${end.y}`;

          return (
            <g key={i} style={{ pointerEvents: "stroke" }}>
              <path d={d} fill="none" stroke="transparent" strokeWidth={14}
                onContextMenu={e => (e.preventDefault(), e.stopPropagation(), setContextMenu({ x: e.clientX, y: e.clientY, connectionIndex: i }))} />
              <path d={d} fill="none" stroke="red" strokeWidth={2} pointerEvents="none" />
            </g>
          );
        })}

        {/* Временная линия */}
        {linking && (() => {
          const { startX, startY, currentX, currentY } = linking;
          const dx = Math.abs(currentX - startX) * 0.4;
          const dirX = currentX > startX ? 1 : -1;
          const d = `M ${startX} ${startY} C ${startX + dirX * dx} ${startY}, ${currentX - dirX * dx} ${currentY}, ${currentX} ${currentY}`;
          return <path d={d} fill="none" stroke="#ff5555" strokeWidth={2} strokeDasharray="6 4" pointerEvents="none" />;
        })()}
      </svg>

      {/* Контекстное меню */}
      {contextMenu && (
        <div style={{ position: "fixed", left: contextMenu.x, top: contextMenu.y, background: "#222", border: "1px solid #444", padding: "4px 0", zIndex: 1000, fontSize: 13 }}
          onClick={e => e.stopPropagation()}>
          <div style={{ padding: "6px 16px", cursor: "pointer" }} onClick={() => deleteConnection(contextMenu.connectionIndex)}>
            🗑 Удалить связь
          </div>
        </div>
      )}

      {/* Левая таблица */}
      <table border={1} onMouseDown={e => onMouseDownDrag(e, "left", positions.left)}
        style={{ position: "absolute", left: positions.left.x, top: positions.left.y, borderCollapse: "collapse", background: "#111", cursor: "move", userSelect: "none" }}>
        <thead>
          <tr><th colSpan={schema.leftTable.columns.length} style={cellStyle}>{schema.leftTable.title}</th></tr>
          <tr>{schema.leftTable.columns.map((c: string) => <th key={c} style={cellStyle}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {schema.leftTable.rows.map((row: any[], i: number) => (
            <tr key={i} ref={el => el && (leftRowRefs.current[i] = el)}>
              {row.map((cell, j) => (
                <td key={j} style={{ ...cellStyle, position: "relative" }}>
                  {cell}
                  {j === row.length - 1 && (
                    <span data-port="out"
                      onMouseDown={e => startLinking("leftRow", i, e)}
                      onMouseUp={e => finishLinking("leftRow", i, e)}
                      style={{ position: "absolute", right: -6, top: "50%", width: 10, height: 10, borderRadius: "50%", background: "red", transform: "translateY(-50%)", cursor: "crosshair" }}
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Правые таблицы */}
      {schema.rightTables.map((t: any) => (
        <table key={t.id} border={1} onMouseDown={e => onMouseDownDrag(e, t.id, positions[t.id])}
          style={{ position: "absolute", left: positions[t.id].x, top: positions[t.id].y, borderCollapse: "collapse", background: "#111", cursor: "move", userSelect: "none" }}>
          <thead>
            <tr>
              <th colSpan={t.columns.length} style={{ ...cellStyle, position: "relative" }}>
                {t.title}
                <span data-port="in" ref={el => (rightPortRefs.current[t.id] = el)}
                  onMouseDown={e => startLinking("rightTable", t.id, e)}
                  onMouseUp={e => finishLinking("rightTable", t.id, e)}
                  style={{ position: "absolute", left: -6, top: "50%", width: 10, height: 10, borderRadius: "50%", background: "red", transform: "translateY(-50%)", cursor: "crosshair" }}
                />
              </th>
            </tr>
            <tr>{t.columns.map((c: string) => <th key={c} style={cellStyle}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {t.rows.map((row: any[], i: number) => (
              <tr key={i}>{row.map((cell, j) => <td key={j} style={cellStyle}>{cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      ))}
    </div>
  );
}