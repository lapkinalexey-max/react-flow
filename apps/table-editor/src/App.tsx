import { useRef, useState } from "react";

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

/* ===== CONFIG ===== */

const GRID_SIZE = 20;

/* ===== HELPERS ===== */

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

export default function App() {
  /* ================== POSITIONS ================== */

  const [positions, setPositions] = useState<Record<string, Pos>>({
    left: { x: 40, y: 80 },

    r0: { x: 520, y: 40 },
    r1: { x: 520, y: 190 },
    r2: { x: 520, y: 340 },
    r3: { x: 520, y: 490 },
    r4: { x: 520, y: 640 },
    r5: { x: 520, y: 790 },
  });

  /* ================== CONNECTIONS ================== */

  const [connections, setConnections] = useState<Connection[]>([]);
  const [linking, setLinking] = useState<LinkingState>(null);

  /* ================== REFS ================== */

  const leftRowRefs = Array.from({ length: 6 }, () =>
    useRef<HTMLTableRowElement>(null)
  );

  // ВАЖНО: ref именно на КРУЖОК входного порта
  const rightPortRefs: Record<string, React.RefObject<HTMLSpanElement>> = {
    r0: useRef(null),
    r1: useRef(null),
    r2: useRef(null),
    r3: useRef(null),
    r4: useRef(null),
    r5: useRef(null),
  };

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

      const rawX = e.clientX - offsetX;
      const rawY = e.clientY - offsetY;

      setPositions(p => ({
        ...p,
        [id]: {
          x: snap(rawX),
          y: snap(rawY),
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
    setLinking(null);
  }

  /* ================== CONNECT ================== */

  function startLink(rowIndex: number, e: React.MouseEvent) {
    e.stopPropagation();
    const p = rowRight(leftRowRefs[rowIndex].current);
    if (!p) return;
    setLinking({ fromRow: rowIndex, x: p.x, y: p.y });
  }

  function finishLink(tableId: string) {
    if (!linking) return;

    setConnections(c => [
      ...c,
      { fromRow: linking.fromRow, toTable: tableId },
    ]);

    setLinking(null);
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

  /* ================== RENDER ================== */

  return (
    <div
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      style={{
        position: "relative",
        minWidth: "100vw",
        minHeight: "100vh",
        backgroundColor: "#111",
        backgroundImage: `
          linear-gradient(to right, #222 1px, transparent 1px),
          linear-gradient(to bottom, #222 1px, transparent 1px)
        `,
        backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
        color: "#fff",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* ================== SVG ================== */}
      <svg
        width={svgWidth}
        height={svgHeight}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          pointerEvents: "none",
        }}
      >
        {/* сохранённые связи */}
        {connections.map((c, i) => {
          const a = rowRight(leftRowRefs[c.fromRow].current);
          const b = centerOf(rightPortRefs[c.toTable].current);
          if (!a || !b) return null;

          const dx = (b.x - a.x) * 0.4;

          return (
            <path
              key={i}
              d={`
                M ${a.x} ${a.y}
                C ${a.x + dx} ${a.y},
                  ${b.x - dx} ${b.y},
                  ${b.x} ${b.y}
              `}
              fill="none"
              stroke="red"
              strokeWidth={2}
            />
          );
        })}

        {/* линия в процессе соединения */}
        {linking && (() => {
          const a = rowRight(leftRowRefs[linking.fromRow].current);
          if (!a) return null;

          const dx = (linking.x - a.x) * 0.4;

          return (
            <path
              d={`
                M ${a.x} ${a.y}
                C ${a.x + dx} ${a.y},
                  ${linking.x - dx} ${linking.y},
                  ${linking.x} ${linking.y}
              `}
              fill="none"
              stroke="#ff5555"
              strokeWidth={2}
              strokeDasharray="6 4"
            />
          );
        })()}
      </svg>

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
        }}
      >
        <thead>
          <tr>
            <th colSpan={3}>Ведомость стоек</th>
          </tr>
          <tr>
            <th>№</th>
            <th>Название</th>
            <th>Кол-во</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["1", "Ст-2.0кл", "1"],
            ["2", "Ст-3.0", "54"],
            ["3", "Ст-3.0к", "1"],
            ["4", "Ст-3.2", "27"],
            ["5", "Ст-3.25", "38"],
            ["6", "Ст-3.3", "1"],
          ].map((r, i) => (
            <tr key={i} ref={leftRowRefs[i]}>
              {r.map((c, j) => (
                <td
                  key={j}
                  style={{ padding: "4px 8px", position: "relative" }}
                >
                  {c}
                  {j === 2 && (
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
      {[
        "Стойка Ст-2.0кл",
        "Стойка Ст-3.0",
        "Стойка Ст-3.0к",
        "Стойка Ст-3.2",
        "Стойка Ст-3.25",
        "Стойка Ст-3.3",
      ].map((title, i) => {
        const id = `r${i}`;
        return (
          <table
            key={id}
            border={1}
            onMouseDown={e =>
              onMouseDownDrag(e, id, positions[id])
            }
            style={{
              position: "absolute",
              left: positions[id].x,
              top: positions[id].y,
              minWidth: 520,
              borderCollapse: "collapse",
              background: "#111",
              cursor: "move",
              userSelect: "none",
            }}
          >
            <thead>
              <tr>
                <th colSpan={6} style={{ position: "relative" }}>
                  {title}
                  <span
                    ref={rightPortRefs[id]}
                    data-port="in"
                    onMouseUp={() => finishLink(id)}
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
                <th>Поз.</th>
                <th>Обозначение</th>
                <th>Название</th>
                <th>Кол-во</th>
                <th>Масса ед., кг</th>
                <th>Прим.</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1</td>
                <td>ГОСТ 35087-2024</td>
                <td>Двутавр 15ДК1</td>
                <td>1</td>
                <td>45.34</td>
                <td />
              </tr>
              <tr>
                <td>2</td>
                <td>ГОСТ 19903-2015</td>
                <td>Лист 30×240×590</td>
                <td>1</td>
                <td>33.35</td>
                <td />
              </tr>
              <tr>
                <td>3</td>
                <td>ГОСТ 19903-2015</td>
                <td>Пластина 8×80×200</td>
                <td>2</td>
                <td>0.67</td>
                <td />
              </tr>
            </tbody>
          </table>
        );
      })}
    </div>
  );
}
