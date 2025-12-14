import { useCallback } from 'react'
import {
  ReactFlow,
  addEdge,
  Background,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  Handle,
  Position,
} from '@xyflow/react'

type TableNodeData = {
  label: string
  columns: string[]
}

const TableNode = ({ data }: { data: TableNodeData }) => {
  return (
    <div
      style={{
        padding: 10,
        borderRadius: 6,
        background: '#fff',
        minWidth: 180,
        boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
      }}
    >
      <strong>{data.label}</strong>

      {data.columns.map((col) => (
        <div
          key={col}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Handle
            type="target"
            position={Position.Left}
            id={col}
            style={{ background: '#555' }}
          />
          {col}
          <Handle
            type="source"
            position={Position.Right}
            id={col}
            style={{ background: '#555' }}
          />
        </div>
      ))}
    </div>
  )
}

const nodeTypes = {
  table: TableNode,
}

const initialNodes = [
  {
    id: 't1',
    type: 'table',
    position: { x: 100, y: 100 },
    data: {
      label: 'Ведомость',
      columns: ['Код', 'Наименование'],
    },
  },
  {
    id: 't2',
    type: 'table',
    position: { x: 450, y: 200 },
    data: {
      label: 'Смета',
      columns: ['Код', 'Цена'],
    },
  },
]

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const onConnect = useCallback(
    (params: any) => setEdges((eds) => addEdge(params, eds)),
    []
  )

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background />
        <MiniMap />
        <Controls />
      </ReactFlow>
    </div>
  )
}
