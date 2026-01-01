import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import '../TableStyles.css';

export type TableNodeData = {
  title: string;
  columns: string[];
  rows: string[][];
  isLeft: boolean;
  onRowAdd?: () => void;
  onRowDelete?: (index: number) => void;
  onCellEdit?: (rowIndex: number, colIndex: number, value: string) => void;
};

export type TableNode = Node<TableNodeData, 'table'>;

// Треугольник (стрелка вправо ▶)
const TrianglePort = () => (
  <svg 
    width="16" 
    height="16" 
    viewBox="0 0 12 12" 
    style={{ overflow: 'visible', display: 'block' }}
  >
    <path 
      d="M 0 0 L 12 6 L 0 12 Z" 
      fill="#ff4444" 
      stroke="#fff" 
      strokeWidth="2" 
      strokeLinejoin="round" 
    />
  </svg>
);

const TableNode = ({ data }: NodeProps<TableNode>) => {
  return (
    <div className="table-node" style={{ background: '#1a1a1a', borderRadius: 8, overflow: 'visible', border: '1px solid #444', minWidth: 300 }}>
      
      {/* ❌ Старый порт удален отсюда */}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {/* 👇 Вставляем порт внутрь заголовка */}
            <th 
              colSpan={data.columns.length + 2} 
              style={{ 
                textAlign: 'center', 
                background: '#222', 
                padding: 8, 
                position: 'relative' // Важно: делаем заголовок опорной точкой
              }}
            >
              
              {/* 🟢 ПОРТ ВХОДА (ТЕПЕРЬ ТУТ) */}
              {!data.isLeft && (
                <Handle 
                  type="target" 
                  position={Position.Left} 
                  style={{ 
                    background: 'transparent', 
                    border: 'none', 
                    width: 16, 
                    height: 16, 
                    // Позиционирование относительно <th>
                    position: 'absolute',
                    left: -10,            // Выносим влево за пределы таблицы
                    top: '50%',           // Центр по вертикали
                    transform: 'translateY(-50%)', // Точное центрирование
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10
                  }} 
                >
                  <TrianglePort />
                </Handle>
              )}

              {data.title}
            </th>
          </tr>

          <tr style={{ background: '#333' }}>
            <th style={{ width: 40 }}></th>
            <th style={{ width: 40, textAlign: 'center' }}>№</th>
            {data.columns.map((col, i) => (
              <th key={i} style={{ padding: '4px 8px', textAlign: 'left', border: '1px solid #444' }}>{col}</th>
            ))}
          </tr>
        </thead>
        
        <tbody className="nodrag">
          {data.rows.map((row, rowIndex) => (
            <tr key={rowIndex} style={{ borderBottom: '1px solid #333' }}>
              <td style={{ textAlign: 'center', padding: 4 }}>
                <button 
                  className="delete-row" 
                  onClick={() => data.onRowDelete?.(rowIndex)}
                  style={{ width: 24, height: 24, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >−</button>
              </td>
              <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#888' }}>{rowIndex + 1}</td>
              
              {row.map((cell, colIndex) => (
                <td key={colIndex} style={{ padding: 0, border: '1px solid #444', position: 'relative' }}>
                  <input 
                    defaultValue={cell} 
                    onBlur={(e) => data.onCellEdit?.(rowIndex, colIndex, e.target.value)}
                    style={{ 
                      background: 'transparent', 
                      border: 'none', 
                      color: '#ddd', 
                      width: '100%', 
                      padding: '6px 8px',
                      outline: 'none'
                    }}
                  />
                  
                  {/* 🔴 ПОРТ ВЫХОДА (на строках) - без изменений */}
                  {data.isLeft && colIndex === row.length - 1 && (
                    <Handle
                      type="source"
                      position={Position.Right}
                      id={`row-${rowIndex}`} 
                      style={{ 
                        background: 'transparent',
                        border: 'none',
                        width: 16, 
                        height: 16,
                        right: -10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        zIndex: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <TrianglePort />
                    </Handle>
                  )}
                </td>
              ))}
            </tr>
          ))}

          {/* Строка добавления */}
          <tr style={{ background: '#1e1e1e' }}>
            <td style={{ textAlign: 'center', padding: 4, borderRight: '1px solid #333' }}>
               <button 
                  className="add-row" 
                  onClick={data.onRowAdd}
                  style={{ 
                    width: 24, height: 24, cursor: 'pointer', background: '#333', 
                    color: '#4f4', border: '1px solid #555', borderRadius: 4,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, padding: 0
                  }}
               >+</button>
            </td>
            <td colSpan={data.columns.length + 1} style={{ borderTop: '1px solid #333' }}></td>
          </tr>

        </tbody>
      </table>
    </div>
  );
};

export default memo(TableNode);