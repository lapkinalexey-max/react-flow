import { useCallback, useMemo, useEffect, useState } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  MiniMap,
  useNodesState, 
  useEdgesState, 
  addEdge,
  BackgroundVariant,
  type Connection,
} from '@xyflow/react';

import '@xyflow/react/dist/style.css';

// Импортируем компонент и типы
import TableNodeComponent, { type TableNode } from './components/TableNode';
import LeftSidebar from './components/LeftSidebar';
import schema from './schema.json';

export default function App() {
  // 1. Стейт узлов (Nodes) и связей (Edges)
  // Явно указываем тип <TableNode>, чтобы TS не ругался на пустой массив
  const [nodes, setNodes, onNodesChange] = useNodesState<TableNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // 2. Стейт для модального окна удаления
  const [deleteConfirm, setDeleteConfirm] = useState<{ nodeId: string; rowIndex: number } | null>(null);

  // --- ЛОГИКА ИЗМЕНЕНИЯ ДАННЫХ ---

  // Функция 1: Добавление пустой строки
  const onAddRow = useCallback((nodeId: string) => {
    setNodes((nds) => 
      nds.map((node) => {
        if (node.id !== nodeId) return node;
        
        const newRow = new Array(node.data.columns.length).fill("");
        
        return {
          ...node,
          data: {
            ...node.data,
            rows: [...node.data.rows, newRow],
          },
        };
      })
    );
  }, [setNodes]);

  // Функция 2: Фактическое удаление строки (вызывается сразу или после "Да")
  const performDeleteRow = useCallback((nodeId: string, rowIndex: number) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id !== nodeId) return node;

        const newRows = [...node.data.rows];
        newRows.splice(rowIndex, 1);

        return {
          ...node,
          data: { ...node.data, rows: newRows },
        };
      })
    );
    setDeleteConfirm(null); // Закрываем модальное окно
  }, [setNodes]);

  // Функция 3: Запрос на удаление (проверка на пустоту)
  const onRequestDeleteRow = useCallback((nodeId: string, rowIndex: number) => {
    setNodes((currentNodes) => {
      const node = currentNodes.find((n) => n.id === nodeId);
      
      // Если узел найден, проверяем строку
      if (node) {
        const row = node.data.rows[rowIndex];
        // Проверяем, пустая ли строка (все ячейки пустые или пробелы)
        const isEmpty = row.every((cell) => !cell || cell.trim() === "");

        if (isEmpty) {
          // Если пустая — удаляем сразу (через setTimeout, чтобы выйти из цикла рендера)
          setTimeout(() => performDeleteRow(nodeId, rowIndex), 0);
        } else {
          // Если есть данные — показываем окно подтверждения
          setDeleteConfirm({ nodeId, rowIndex });
        }
      }
      return currentNodes; // Возвращаем стейт без изменений
    });
  }, [performDeleteRow, setNodes]);

  // Функция 4: Редактирование ячейки
  const onCellEdit = useCallback((nodeId: string, rowIndex: number, colIndex: number, value: string) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id !== nodeId) return node;

        const newRows = [...node.data.rows];
        const newRow = [...newRows[rowIndex]];
        newRow[colIndex] = value;
        newRows[rowIndex] = newRow;

        return {
          ...node,
          data: {
            ...node.data,
            rows: newRows,
          },
        };
      })
    );
  }, [setNodes]);

  // --- ИНИЦИАЛИЗАЦИЯ ---

  useEffect(() => {
    // Создаем левый узел
    const leftNode: TableNode = {
      id: 'left',
      type: 'table',
      position: { x: 50, y: 100 },
      data: { 
        ...schema.leftTable, 
        isLeft: true,
        // Привязываем функции к данным узла
        onRowAdd: () => onAddRow('left'),
        onRowDelete: (idx: number) => onRequestDeleteRow('left', idx),
        onCellEdit: (r: number, c: number, val: string) => onCellEdit('left', r, c, val),
      },
    };

    // Создаем правые узлы из массива
    const rightNodes: TableNode[] = schema.rightTables.map((t: any, i: number) => ({
      id: t.id,
      type: 'table',
      position: { x: 600, y: 50 + i * 250 },
      data: { 
        ...t, 
        isLeft: false,
        // Привязываем функции
        onRowAdd: () => onAddRow(t.id),
        onRowDelete: (idx: number) => onRequestDeleteRow(t.id, idx),
        onCellEdit: (r: number, c: number, val: string) => onCellEdit(t.id, r, c, val),
      },
    }));

    setNodes([leftNode, ...rightNodes]);
  }, [onAddRow, onRequestDeleteRow, onCellEdit, setNodes]);

  // --- НАСТРОЙКИ REACT FLOW ---

  // useMemo предотвращает лишние ререндеры типов узлов
  const nodeTypes = useMemo(() => ({ table: TableNodeComponent }), []);
  
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', background: '#111' }}>
      
      <LeftSidebar />

      {/* position: relative нужен для абсолютного позиционирования модального окна внутри этого блока */}
      <div style={{ flex: 1, height: '100%', position: 'relative' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          colorMode="dark"
          fitView
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#333" />
          <Controls style={{ fill: '#fff' }} />
          <MiniMap style={{ background: '#222' }} nodeColor="#444" maskColor="rgba(0,0,0, 0.6)" />
        </ReactFlow>

        {/* --- МОДАЛЬНОЕ ОКНО ПОДТВЕРЖДЕНИЯ --- */}
        {deleteConfirm && (
          <div 
            style={{
              position: "absolute", 
              inset: 0, 
              zIndex: 1000,
              background: "rgba(0,0,0,0.7)", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center"
            }} 
            onClick={() => setDeleteConfirm(null)}
          >
            <div 
              style={{
                background: "#222", 
                padding: "24px", 
                borderRadius: "12px", 
                border: "1px solid #555",
                minWidth: 300, 
                textAlign: "center", 
                boxShadow: "0 10px 40px rgba(0,0,0,0.5)"
              }} 
              onClick={e => e.stopPropagation()}
            >
              <h3 style={{ margin: "0 0 16px 0", color: "#fff", fontFamily: 'Arial, sans-serif' }}>Удалить строку?</h3>
              <p style={{ margin: "0 0 24px 0", color: "#ccc", fontFamily: 'Arial, sans-serif' }}>
                В строке есть данные. Удалить безвозвратно?
              </p>
              
              <div style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
                <button
                  onClick={() => performDeleteRow(deleteConfirm.nodeId, deleteConfirm.rowIndex)}
                  style={{
                    padding: "10px 24px", 
                    background: "#c33", 
                    color: "#fff", 
                    border: "none",
                    borderRadius: "6px", 
                    cursor: "pointer", 
                    fontSize: "14px", 
                    fontWeight: "bold"
                  }}
                >
                  Удалить
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
                    fontSize: "14px"
                  }}
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}