import { useState, useMemo, useRef, useEffect } from 'react'
import { Table, Input, Select, Button, Space, App, Tag, Spin, InputNumber } from 'antd'
import { ReloadOutlined, ExpandOutlined, CompressOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { p6WbsService, type P6WBSNode } from '../services/p6WbsService'
import type { ColumnsType } from 'antd/es/table'

const { Option } = Select

interface WBSNodeWithKey extends P6WBSNode {
  key: string
}

const WBSManagement = () => {
  const { message: _message } = App.useApp()
  const [searchText, setSearchText] = useState('')
  const [projectFilter, setProjectFilter] = useState<string | undefined>(undefined)
  const [expandedRowKeys, setExpandedRowKeys] = useState<readonly React.Key[]>([])
  const [expandToLevel, setExpandToLevel] = useState<number | null>(null)
  const tableAreaRef = useRef<HTMLDivElement | null>(null)
  const [bodyHeight, setBodyHeight] = useState<number>(600)

  // 获取WBS树数据
  const { data: wbsTree, isLoading, refetch } = useQuery({
    queryKey: ['p6-wbs-tree', projectFilter],
    queryFn: async () => {
      const params: { project_object_id?: number; project_id?: string } = {}
      if (projectFilter) {
        // 尝试解析为数字（project_object_id）或字符串（project_id）
        const numValue = parseInt(projectFilter, 10)
        if (!isNaN(numValue)) {
          params.project_object_id = numValue
        } else {
          params.project_id = projectFilter
        }
      }
      return await p6WbsService.getWbsTree(params)
    },
    retry: false,
  })

  // 将树数据转换为表格需要的格式（保持树结构）
  const treeTableData = useMemo(() => {
    if (!wbsTree || wbsTree.length === 0) {
      return []
    }

    const convertToTableData = (nodes: P6WBSNode[], parentKey: string = ''): WBSNodeWithKey[] => {
      const result: WBSNodeWithKey[] = []
      nodes.forEach((node, index) => {
        const key = parentKey ? `${parentKey}-${index}` : `${node.object_id || node.project_id || `project-${node.project_object_id}`}`
        const children = node.children && node.children.length > 0 
          ? convertToTableData(node.children, key)
          : []
        const nodeWithKey: WBSNodeWithKey = {
          ...node,
          key,
          children: children as P6WBSNode[],
        }
        result.push(nodeWithKey)
      })
      return result
    }

    return convertToTableData(wbsTree)
  }, [wbsTree])

  // 扁平化数据用于搜索
  const flatWbsData = useMemo(() => {
    const flatten = (nodes: WBSNodeWithKey[]): WBSNodeWithKey[] => {
      const result: WBSNodeWithKey[] = []
      nodes.forEach((node) => {
        result.push(node)
        if (node.children && node.children.length > 0) {
          result.push(...flatten(node.children as WBSNodeWithKey[]))
        }
      })
      return result
    }
    return flatten(treeTableData)
  }, [treeTableData])

  // 筛选数据（保持树结构）
  const filteredData = useMemo(() => {
    if (!searchText && !projectFilter) {
      return treeTableData
    }

    const filterTree = (nodes: WBSNodeWithKey[]): WBSNodeWithKey[] => {
      return nodes
        .map((node) => {
          const matchesSearch = !searchText || 
            node.name?.toLowerCase().includes(searchText.toLowerCase()) ||
            node.code?.toLowerCase().includes(searchText.toLowerCase())
          
          const matchesProject = !projectFilter ||
            node.project_id === projectFilter ||
            node.project_object_id?.toString() === projectFilter

          const matches = matchesSearch && matchesProject

          // 递归处理子节点
          const filteredChildren = node.children ? filterTree(node.children as WBSNodeWithKey[]) : undefined
          const hasMatchingChildren = filteredChildren && filteredChildren.length > 0

          // 如果节点匹配或有匹配的子节点，则包含该节点
          if (matches || hasMatchingChildren) {
            return {
              ...node,
              children: filteredChildren,
            } as WBSNodeWithKey
          }
          return null
        })
        .filter((node): node is WBSNodeWithKey => node !== null)
    }

    return filterTree(treeTableData)
  }, [treeTableData, searchText, projectFilter])

  // 获取唯一的项目ID列表（用于筛选）
  const uniqueProjectIds = useMemo(() => {
    const projectIds = new Set<string>()
    flatWbsData.forEach((node) => {
      if (node.project_id) {
        projectIds.add(node.project_id)
      }
      if (node.project_object_id) {
        projectIds.add(node.project_object_id.toString())
      }
    })
    return Array.from(projectIds).sort()
  }, [flatWbsData])

  // 表格列定义
  const columns: ColumnsType<WBSNodeWithKey> = [
    {
      title: 'WBS Code',
      dataIndex: 'code',
      key: 'code',
      width: 150,
      fixed: 'left',
      render: (text: string | null, record: WBSNodeWithKey) => {
        // 如果是项目节点，显示 project_id
        if (record.is_project_node) {
          return <strong style={{ color: '#1890ff' }}>{text || record.project_id || '-'}</strong>
        }
        return text || '-'
      },
    },
    {
      title: 'WBS Name',
      dataIndex: 'name',
      key: 'name',
      width: 300,
      fixed: 'left',
      render: (text: string | null, record: WBSNodeWithKey) => {
        // 如果是项目节点，显示项目名称
        if (record.is_project_node) {
          return <strong style={{ color: '#1890ff' }}>{text || `Project ${record.project_id || record.project_object_id}`}</strong>
        }
        return text || '-'
      },
    },
    {
      title: 'Level',
      dataIndex: 'level',
      key: 'level',
      width: 80,
      align: 'center',
      render: (level: number | null) => level ?? '-',
    },
    {
      title: 'Project Object ID',
      dataIndex: 'project_object_id',
      key: 'project_object_id',
      width: 150,
      render: (id: number) => id ?? '-',
    },
    {
      title: 'Project ID',
      dataIndex: 'project_id',
      key: 'project_id',
      width: 150,
      render: (text: string | null) => text || '-',
    },
    {
      title: 'Object ID',
      dataIndex: 'object_id',
      key: 'object_id',
      width: 120,
      render: (id: number) => id ?? '-',
    },
    {
      title: 'Parent Object ID',
      dataIndex: 'parent_object_id',
      key: 'parent_object_id',
      width: 150,
      render: (id: number | null) => id ?? '-',
    },
    {
      title: 'Sequence Number',
      dataIndex: 'sequence_number',
      key: 'sequence_number',
      width: 130,
      align: 'center',
      render: (num: number | null) => num ?? '-',
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      align: 'center',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>{isActive ? 'Active' : 'Inactive'}</Tag>
      ),
    },
    {
      title: 'Last Sync',
      dataIndex: 'last_sync_at',
      key: 'last_sync_at',
      width: 180,
      render: (date: string | null) => {
        if (!date) return '-'
        return new Date(date).toLocaleString('zh-CN')
      },
    },
  ]

  // 根据树结构设置默认展开的节点
  const hasInitializedExpandedKeys = useRef<boolean>(false)
  useEffect(() => {
    if (filteredData.length > 0 && !hasInitializedExpandedKeys.current) {
      // 默认展开前2层
      const keysToExpand: React.Key[] = []
      const collectKeys = (nodes: WBSNodeWithKey[], level: number = 0) => {
        nodes.forEach((node) => {
          if (level < 2 && node.children && node.children.length > 0) {
            keysToExpand.push(node.key)
            collectKeys(node.children as WBSNodeWithKey[], level + 1)
          }
        })
      }
      collectKeys(filteredData)
      setExpandedRowKeys(keysToExpand)
      hasInitializedExpandedKeys.current = true
    }
  }, [filteredData])

  // 根据 expandToLevel 更新展开状态
  useEffect(() => {
    if (expandToLevel !== null && filteredData.length > 0) {
      const keysToExpand: React.Key[] = []
      const collectKeys = (nodes: WBSNodeWithKey[], level: number = 0) => {
        nodes.forEach((node) => {
          if (level < expandToLevel && node.children && node.children.length > 0) {
            keysToExpand.push(node.key)
            collectKeys(node.children as WBSNodeWithKey[], level + 1)
          }
        })
      }
      collectKeys(filteredData)
      setExpandedRowKeys(keysToExpand)
    }
  }, [expandToLevel, filteredData])

  // 全部展开
  const handleExpandAll = () => {
    const keysToExpand: React.Key[] = []
    const collectKeys = (nodes: WBSNodeWithKey[]) => {
      nodes.forEach((node) => {
        if (node.children && node.children.length > 0) {
          keysToExpand.push(node.key)
          collectKeys(node.children as WBSNodeWithKey[])
        }
      })
    }
    collectKeys(filteredData)
    setExpandedRowKeys(keysToExpand)
    setExpandToLevel(null)
  }

  // 全部折叠
  const handleCollapseAll = () => {
    setExpandedRowKeys([])
    setExpandToLevel(null)
  }

  // 展开到第N层
  const handleExpandToLevel = (level: number | null) => {
    if (level === null || level < 0) {
      setExpandToLevel(null)
      return
    }
    setExpandToLevel(level)
  }

  // 计算表格高度
  useEffect(() => {
    const el = tableAreaRef.current
    if (!el) return

    const ro = new ResizeObserver(() => {
      const h = el.getBoundingClientRect().height
      const headerH =
        (el.querySelector('.wbs-table .ant-table-header') as HTMLElement | null)?.getBoundingClientRect().height ?? 0
      const next = Math.max(200, Math.floor(h - headerH - 16))
      setBodyHeight(next)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 12,
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#1e293b' }}>P6 WBS 树状表</h2>
          <Tag color="blue" style={{ margin: 0 }}>总计: {filteredData.length} 个节点</Tag>
          {wbsTree && wbsTree.length > 0 && (
            <Tag color="green" style={{ margin: 0 }}>根节点: {wbsTree.length} 个</Tag>
          )}
        </div>
        <Space size="small">
          <Input.Search
            placeholder="搜索WBS Code或Name"
            size="small"
            style={{ width: 220 }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
          />
          <Select
            placeholder="按项目筛选"
            size="small"
            style={{ width: 150 }}
            allowClear
            value={projectFilter}
            onChange={(value) => setProjectFilter(value)}
          >
            {uniqueProjectIds.map((projectId) => (
              <Option key={projectId} value={projectId}>
                {projectId}
              </Option>
            ))}
          </Select>
          <Button
            size="small"
            onClick={() => {
              setSearchText('')
              setProjectFilter(undefined)
            }}
          >
            清除筛选
          </Button>
          <Button 
            size="small"
            icon={<ReloadOutlined />} 
            onClick={() => refetch()} 
            loading={isLoading}
          >
            刷新
          </Button>
          <Button
            size="small"
            icon={<ExpandOutlined />}
            onClick={handleExpandAll}
            title="全部展开"
          >
            全部展开
          </Button>
          <Button
            size="small"
            icon={<CompressOutlined />}
            onClick={handleCollapseAll}
            title="全部折叠"
          >
            全部折叠
          </Button>
          <InputNumber
            size="small"
            min={0}
            max={10}
            placeholder="展开到第N层"
            value={expandToLevel}
            onChange={(value) => handleExpandToLevel(value ?? null)}
            style={{ width: 120 }}
            addonBefore="展开到"
            addonAfter="层"
          />
        </Space>
      </div>

      <div
        ref={tableAreaRef}
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: '#ffffff',
          borderRadius: '4px',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <Spin spinning={isLoading}>
            <Table
              className="wbs-table"
              columns={columns}
              dataSource={filteredData}
              rowKey="key"
              size="small"
              scroll={{
                x: 'max-content',
                y: bodyHeight,
              }}
              pagination={false}
              expandable={{
                expandedRowKeys,
                onExpandedRowsChange: (keys) => setExpandedRowKeys(keys),
                indentSize: 20,
                childrenColumnName: 'children',
              }}
            />
          </Spin>
        </div>
      </div>
    </div>
  )
}

export default WBSManagement
