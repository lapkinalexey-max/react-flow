import { useRef, useState } from "react";
import schema from "./schema.json";

type Pos = { x: number; y: number };
type DragState = { id: string; offsetX: number; offsetY: number } | null;

type Connection = {
  fromRow: number;
  toTable: string;
};

type LinkingState = {
  fromRow: number;
  x: number;
  y: number;
} | null;

type ContextMenuState = {
  x: number;
  y: number;
  connectionIndex: number;
} | null;

const GRID_SIZE = 20;
const START_X = 520;
const START_Y = 40;
const STEP_Y = 200;

/* ================== HELPERS ================== */

function snap(v: number) {
  return Math.round(v / GRID_SIZE) * GRID_SIZE;
}

function centerOf(el: HTMLElement | null) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    x: r.left + r.width / 2 + window.scrollX,
    y: r.top + r.height / 2 + window.scrollY,
  };
}

function rowRight(el: HTMLTableRowElement | null) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    x: r.right + window.scrollX,
    y: r.top + r.height / 2 + window.scrollY,
  };
}

/* ================== AUTO LAYOUT ================== */

function buildInitialPositions(): Record<string, Pos> {
  const pos: Record<string, Pos> = {
    left: { x: 40, y: 80 },
  };

  schema.rightTables.forEach((t, i) => {
    pos[t.id] = {
      x: START_X,
      y: START_Y + i * STEP_Y,
    };
  });

  return pos;
}

export default function App() {
  /* ================== STATE ================== */

  const [positions, setPositions] = useState<Record<string, Pos>>(
    buildInitialPositions
  );
  const [connections, setConnections] = useState<Connection[]>([]);
  const [linking, setLinking] = useState<LinkingState>(null);
  const [contextMenu, setContextMenu] =
    useState<ContextMenuState>(null);

  /* ================== REFS ================== */

  const leftRowRefs = useRef<HTMLTableRowElement[]>([]);
  const rightPortRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const dragRef = useRef<DragState>(null);

  /* ================== DRAG ================== */

  function onMouseDownDrag(
    e: React.MouseEvent,
    id: string,
    pos: Pos
  ) {
    if ((e.target as HTMLElement).dataset.port) return;

    dragRef.current = {
      id,
      offsetX: e.clientX - pos.x,
      offsetY: e.clientY - pos.y,
    };
  }

  function onMouseMove(e: React.MouseEvent) {
    if (dragRef.current) {
      const { id, offsetX, offsetY } = dragRef.current;
      setPositions(p => ({
        ...p,
        [id]: {
          x: snap(e.clientX - offsetX),
          y: snap(e.clientY - offsetY),
        },
      }));
    }

    if (linking) {
      setLinking(l =>
        l && {
          ...l,
          x: e.clientX + window.scrollX,
          y: e.clientY + window.scrollY,
        }
      );
    }
  }

  function onMouseUp() {
    dragRef.current = null;
  }

  /* ================== CONNECT ================== */

  function startLink(rowIndex: number, e: React.MouseEvent) {
    e.stopPropagation();
    const p = rowRight(leftRowRefs.current[rowIndex]);
    if (!p) return;

    setLinking({
      fromRow: rowIndex,
      x: p.x,
      y: p.y,
    });
  }

  function finishLink(tableId: string) {
    if (!linking) return;

    setConnections(c => [
      ...c,
      { fromRow: linking.fromRow, toTable: tableId },
    ]);

    setLinking(null);
  }

  function deleteConnection(index: number) {
    setConnections(c => c.filter((_, i) => i !== index));
    setContextMenu(null);
  }

  /* ================== SVG SIZE ================== */

  const svgWidth = Math.max(
    document.documentElement.scrollWidth,
    window.innerWidth
  );
  const svgHeight = Math.max(
    document.documentElement.scrollHeight,
    window.innerHeight
  );

  const cellStyle: React.CSSProperties = {
    padding: "4px 8px",
    whiteSpace: "nowrap",
  };

  /* ================== RENDER ================== */

  return (
    <div
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onClick={() => setContextMenu(null)}
      onContextMenu={e => {
        // ❗ ОТМЕНА ВРЕМЕННОЙ СВЯЗИ
        if (linking) {
          e.preventDefault();
          e.stopPropagation();
          setLinking(null);
          return;
        }
      }}
      style={{
        position: "relative",
        minWidth: "100vw",
        minHeight: "100vh",
        background: "#111",
        color: "#fff",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* ================== SVG ================== */}
      <svg
        width={svgWidth}
        height={svgHeight}
        style={{ position: "absolute", left: 0, top: 0 }}
      >
        {connections.map((c, i) => {
          const a = rowRight(leftRowRefs.current[c.fromRow]);
          const b = centerOf(rightPortRefs.current[c.toTable]);
          if (!a || !b) return null;

          const dx = (b.x - a.x) * 0.4;
          const d = `M ${a.x} ${a.y}
                     C ${a.x + dx} ${a.y},
                       ${b.x - dx} ${b.y},
                       ${b.x} ${b.y}`;

          return (
            <g key={i}>
              {/* invisible hit area */}
              <path
                d={d}
                fill="none"
                stroke="transparent"
                strokeWidth={14}
                pointerEvents="stroke"
                onContextMenu={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    connectionIndex: i,
                  });
                }}
              />
              {/* visible line */}
              <path
                d={d}
                fill="none"
                stroke="red"
                strokeWidth={2}
                pointerEvents="none"
              />
            </g>
          );
        })}

        {/* ===== ВРЕМЕННАЯ ЛИНИЯ ===== */}
        {linking && (() => {
          const a = rowRight(leftRowRefs.current[linking.fromRow]);
          if (!a) return null;

          const dx = (linking.x - a.x) * 0.4;

          return (
            <path
              d={`M ${a.x} ${a.y}
                 C ${a.x + dx} ${a.y},
                   ${linking.x - dx} ${linking.y},
                   ${linking.x} ${linking.y}`}
              fill="none"
              stroke="#ff5555"
              strokeWidth={2}
              strokeDasharray="6 4"
              pointerEvents="none"
            />
          );
        })()}
      </svg>

      {/* ================== CONTEXT MENU ================== */}
      {contextMenu && (
        <div
          style={{
            position: "fixed",
            left: contextMenu.x,
            top: contextMenu.y,
            background: "#222",
            border: "1px solid #444",
            padding: "4px 0",
            zIndex: 1000,
            fontSize: 13,
          }}
          onClick={e => e.stopPropagation()}
        >
          <div
            style={{ padding: "6px 16px", cursor: "pointer" }}
            onClick={() =>
              deleteConnection(contextMenu.connectionIndex)
            }
          >
            🗑 Удалить связь
          </div>
        </div>
      )}

      {/* ================== LEFT TABLE ================== */}
      <table
        border={1}
        onMouseDown={e =>
          onMouseDownDrag(e, "left", positions.left)
        }
        style={{
          position: "absolute",
          left: positions.left.x,
          top: positions.left.y,
          borderCollapse: "collapse",
          background: "#111",
          cursor: "move",
          userSelect: "none",
          tableLayout: "auto",
        }}
      >
        <thead>
          <tr>
            <th colSpan={schema.leftTable.columns.length} style={cellStyle}>
              {schema.leftTable.title}
            </th>
          </tr>
          <tr>
            {schema.leftTable.columns.map(c => (
              <th key={c} style={cellStyle}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {schema.leftTable.rows.map((row, i) => (
            <tr
              key={i}
              ref={el => {
                if (el) leftRowRefs.current[i] = el;
              }}
            >
              {row.map((cell, j) => (
                <td key={j} style={{ ...cellStyle, position: "relative" }}>
                  {cell}
                  {j === row.length - 1 && (
                    <span
                      data-port="out"
                      onMouseDown={e => startLink(i, e)}
                      style={{
                        position: "absolute",
                        right: -6,
                        top: "50%",
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: "red",
                        transform: "translateY(-50%)",
                        cursor: "crosshair",
                      }}
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* ================== RIGHT TABLES ================== */}
      {schema.rightTables.map(t => (
        <table
          key={t.id}
          border={1}
          onMouseDown={e =>
            onMouseDownDrag(e, t.id, positions[t.id])
          }
          style={{
            position: "absolute",
            left: positions[t.id].x,
            top: positions[t.id].y,
            borderCollapse: "collapse",
            background: "#111",
            cursor: "move",
            userSelect: "none",
            tableLayout: "auto",
          }}
        >
          <thead>
            <tr>
              <th
                colSpan={t.columns.length}
                style={{ ...cellStyle, position: "relative" }}
              >
                {t.title}
                <span
                  data-port="in"
                  ref={el => {
                    rightPortRefs.current[t.id] = el;
                  }}
                  onMouseUp={() => finishLink(t.id)}
                  style={{
                    position: "absolute",
                    left: -6,
                    top: "50%",
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: "red",
                    transform: "translateY(-50%)",
                    cursor: "crosshair",
                  }}
                />
              </th>
            </tr>
            <tr>
              {t.columns.map(c => (
                <th key={c} style={cellStyle}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {t.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} style={cellStyle}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </div>
  );
}
