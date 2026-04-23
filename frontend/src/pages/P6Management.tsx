import { useState, useMemo, useEffect, useRef } from 'react'
import { Button, Space, Input, Select, Tag, Alert, Spin, Modal, Tree, InputNumber } from 'antd'
import { UnorderedListOutlined, FolderOutlined, FileOutlined, ExpandOutlined, CompressOutlined } from '@ant-design/icons'
import type { DataNode } from 'antd/es/tree'
import { useQuery } from '@tanstack/react-query'
import { p6Service } from '../services/p6Service'
import LegacyModuleBanner from '../components/common/LegacyModuleBanner'

const { Option } = Select

interface Project {
  id: string
  name: string
  object_id: number | null
  parent_eps_object_id: number | null
  eps_path?: string
  status: string
}

interface EPSNode {
  object_id: number
  name: string
  id: string
  parent_eps_object_id: number | null
  parent_eps_id?: string
  parent_eps_name?: string
  obs_name?: string
  obs_object_id?: number | null
  children?: EPSNode[]
}

interface TreeNodeData {
  type: 'eps' | 'project'
  eps?: EPSNode
  project?: Project
  epsPath?: string
  projectCount?: number
}

// 扩展 DataNode 类型以支持自定义 data 属性
interface ExtendedDataNode extends DataNode {
  data?: TreeNodeData
}

const P6Management = () => {
  const [selectedProjects, setSelectedProjects] = useState<string[]>([])
  const [searchText, setSearchText] = useState('')
  const [epsFilter, setEpsFilter] = useState<number | null>(null)
  const [epsActivitiesModalVisible, setEpsActivitiesModalVisible] = useState(false)
  const [epsActivitiesData, setEpsActivitiesData] = useState<any>(null)
  // 注意：setEpsActivitiesLoading 目前未使用，但保留以备将来使用
  const [epsActivitiesLoading, _setEpsActivitiesLoading] = useState(false)
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])
  const [checkedKeys, setCheckedKeys] = useState<React.Key[]>([])
  const [expandToLevel, setExpandToLevel] = useState<number | null>(null)
  const treeAreaRef = useRef<HTMLDivElement | null>(null)
  const [bodyHeight, setBodyHeight] = useState<number>(600)
  const hasInitializedExpandedKeys = useRef<boolean>(false)

  // 获取P6连接状态
  const { data: p6Status, isLoading: statusLoading } = useQuery({
    queryKey: ['p6-status'],
    queryFn: () => p6Service.getP6Status(),
  })

  // 获取项目列表
  const { data: projects } = useQuery({
    queryKey: ['p6-projects'],
    queryFn: () => p6Service.getProjects(),
    enabled: p6Status?.connected,
    retry: false,
  })

  // 获取EPS树结构
  const { data: epsTree, isLoading: epsTreeLoading } = useQuery({
    queryKey: ['p6-eps-tree'],
    queryFn: () => p6Service.getEPSTree(),
    enabled: p6Status?.connected,
    retry: false,
  })

  // 获取唯一的 EPS ObjectId 列表（用于筛选）
  const uniqueEpsIds = useMemo<number[]>(() => {
    const ids: number[] = []
    const seen = new Set<number>()
    ;(projects || []).forEach((p: Project) => {
      const epsId = p.parent_eps_object_id
      if (epsId !== null && epsId !== undefined && !seen.has(epsId)) {
        ids.push(epsId)
        seen.add(epsId)
      }
    })
    return ids.sort((a: number, b: number) => a - b)
  }, [projects])

  // 筛选项目
  const filteredProjects = (projects || []).filter((project: Project) => {
    const matchesSearch =
      !searchText ||
      project.id.toLowerCase().includes(searchText.toLowerCase()) ||
      project.name.toLowerCase().includes(searchText.toLowerCase())
    
    const matchesEps = !epsFilter || project.parent_eps_object_id === epsFilter
    
    return matchesSearch && matchesEps
  })

  // 构建树数据（EPS和项目）
  const treeData = useMemo(() => {
    if (!epsTree || epsTree.length === 0) {
      return []
    }

    // 按 EPS ObjectId 分组项目
    const projectsByEps = new Map<number, Project[]>()
    filteredProjects.forEach((project: Project) => {
      const epsId = project.parent_eps_object_id
      if (epsId !== null && epsId !== undefined) {
        if (!projectsByEps.has(epsId)) {
          projectsByEps.set(epsId, [])
        }
        projectsByEps.get(epsId)!.push(project)
      }
    })

    // 递归构建树数据
    const buildTreeData = (epsNodes: EPSNode[], level: number = 0, parentPath: string = ''): ExtendedDataNode[] => {
      const nodes: ExtendedDataNode[] = []
      
      epsNodes.forEach(eps => {
        const epsPath = parentPath ? `${parentPath} / ${eps.name}` : eps.name
        const epsObjectId = typeof eps.object_id === 'number' ? eps.object_id : parseInt(String(eps.object_id), 10)
        const directProjects = projectsByEps.get(epsObjectId) || []
        
        const children: ExtendedDataNode[] = []
        
        // 先添加子EPS
        if (eps.children && eps.children.length > 0) {
          const childEpsNodes = buildTreeData(eps.children, level + 1, epsPath)
          children.push(...childEpsNodes)
        }
        
        // 然后添加项目（作为EPS的子节点）
        directProjects.forEach((project: Project) => {
          children.push({
            key: `project-${project.id}`,
            title: project.name,
            isLeaf: true,
            data: {
              type: 'project',
              project: project,
            } as TreeNodeData,
          } as ExtendedDataNode)
        })
        
        // EPS节点
        nodes.push({
          key: `eps-${eps.object_id}`,
          title: eps.name,
          data: {
            type: 'eps',
            eps: eps,
            epsPath: epsPath,
            projectCount: directProjects.length,
          } as TreeNodeData,
          children: children.length > 0 ? children : undefined,
        } as ExtendedDataNode)
      })
      
      return nodes
    }
    
    return buildTreeData(epsTree)
  }, [epsTree, filteredProjects])

  // 根据树结构设置默认展开的节点（仅在首次加载时展开前2层）
  useEffect(() => {
    if (treeData.length > 0 && !hasInitializedExpandedKeys.current) {
      const keysToExpand: React.Key[] = []
      const collectKeys = (nodes: ExtendedDataNode[], level: number = 0) => {
        nodes.forEach((node) => {
          if (level < 2 && node.children && node.children.length > 0) {
            keysToExpand.push(node.key)
            collectKeys(node.children, level + 1)
          }
        })
      }
      collectKeys(treeData)
      setExpandedKeys(keysToExpand)
      hasInitializedExpandedKeys.current = true
    }
  }, [treeData])

  // 根据 expandToLevel 更新展开状态
  useEffect(() => {
    if (expandToLevel !== null && treeData.length > 0) {
      const keysToExpand: React.Key[] = []
      const collectKeys = (nodes: ExtendedDataNode[], level: number = 0) => {
        nodes.forEach((node) => {
          if (level < expandToLevel && node.children && node.children.length > 0) {
            keysToExpand.push(node.key)
            collectKeys(node.children, level + 1)
          }
        })
      }
      collectKeys(treeData)
      setExpandedKeys(keysToExpand)
    }
  }, [expandToLevel, treeData])

  // 全部展开
  const handleExpandAll = () => {
    const keysToExpand: React.Key[] = []
    const collectKeys = (nodes: ExtendedDataNode[]) => {
      nodes.forEach((node) => {
        if (node.children && node.children.length > 0) {
          keysToExpand.push(node.key)
          collectKeys(node.children)
        }
      })
    }
    collectKeys(treeData)
    setExpandedKeys(keysToExpand)
    setExpandToLevel(null)
  }

  // 全部折叠
  const handleCollapseAll = () => {
    setExpandedKeys([])
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

  // 扁平化数据用于统计
  const flatData = useMemo(() => {
    const flatten = (nodes: ExtendedDataNode[]): any[] => {
      const result: any[] = []
      nodes.forEach((node) => {
        result.push(node)
        if (node.children && node.children.length > 0) {
          result.push(...flatten(node.children))
        }
      })
      return result
    }
    return flatten(treeData)
  }, [treeData])

  // 计算树高度
  useEffect(() => {
    const el = treeAreaRef.current
    if (!el) return

    const ro = new ResizeObserver(() => {
      const h = el.getBoundingClientRect().height
      const next = Math.max(200, Math.floor(h - 16))
      setBodyHeight(next)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 处理复选框选择
  const onCheck = (checked: React.Key[] | { checked: React.Key[]; halfChecked: React.Key[] }) => {
    // Ant Design Tree 的 onCheck 可能返回数组或对象
    const checkedKeysValue = Array.isArray(checked) ? checked : checked.checked
    setCheckedKeys(checkedKeysValue)
    // 只提取项目ID
    const projectIds = checkedKeysValue
      .filter(key => typeof key === 'string' && key.startsWith('project-'))
      .map(key => (key as string).replace('project-', ''))
    setSelectedProjects(projectIds)
  }

  // 自定义树节点标题渲染
  const titleRender = (nodeData: ExtendedDataNode) => {
    const data = nodeData.data as TreeNodeData | undefined
    if (!data) return nodeData.title as React.ReactNode

    if (data.type === 'eps') {
      const eps = data.eps!
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 8px',
            borderRadius: '4px',
            background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
            border: '1px solid #7dd3fc',
          }}
        >
          <FolderOutlined style={{ color: '#0369a1', fontSize: 16 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <strong style={{ color: '#0369a1', fontSize: 14 }}>{eps.name}</strong>
              <Tag color="blue">EPS</Tag>
              {data.projectCount !== undefined && data.projectCount > 0 && (
                <Tag color="green">{data.projectCount} 个项目</Tag>
              )}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              ID: {eps.id || eps.object_id} | Object ID: {eps.object_id}
            </div>
          </div>
        </div>
      )
    } else if (data.type === 'project') {
      const project = data.project!
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 8px',
            borderRadius: '4px',
            background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
            border: '1px solid #86efac',
          }}
        >
          <FileOutlined style={{ color: '#16a34a', fontSize: 14 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ color: '#166534', fontSize: 13, fontWeight: 500 }}>
                {project.name?.replace(/&#x2F;/g, '/').replace(/&#x3A;/g, ':') || '-'}
              </span>
              <Tag color="green">项目</Tag>
              {project.status && (
                <Tag color="orange">{project.status}</Tag>
              )}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              ID: {project.id} | Object ID: {project.object_id || '-'}
            </div>
          </div>
        </div>
      )
    }

    return nodeData.title as React.ReactNode
  }

  if (statusLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!p6Status?.connected) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          message="P6未连接"
          description="请先配置P6连接信息"
          type="warning"
          showIcon
        />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: 16, gap: 12 }}>
      <LegacyModuleBanner
        compact
        title="遗留 P6 / EPS 管理"
        description="该页面保留 Primavera P6 的 EPS、项目树和历史同步视图，用于兼容存量工程项目结构，不是机械制造平台的主计划模型。"
        note="机械制造建议以制造订单、工艺模板、工单路线和设备产能为核心组织计划，不再以 EPS/WBS 树作为默认业务骨架。"
        actions={[
          { label: '进入制造驾驶舱', path: '/manufacturing', type: 'primary' },
          { label: '查看工艺模板', path: '/process-template-config' },
        ]}
      />

      {/* P6连接状态 */}
      <Alert
        message={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>P6连接成功</span>
            {p6Status.total_projects !== undefined && (
              <Tag color="blue">已找到 {p6Status.total_projects} 个项目</Tag>
            )}
            {p6Status.synced_projects_count !== undefined && p6Status.synced_projects_count > 0 && (
              <Tag color="green">
                本系统已同步 {p6Status.synced_projects_count} 个项目的数据
                {p6Status.synced_projects && p6Status.synced_projects.length > 0 && (
                  <span>: {p6Status.synced_projects.join(', ')}</span>
                )}
              </Tag>
            )}
          </div>
        }
        type="success"
        showIcon
        style={{ marginBottom: 0 }}
      />

      {/* EPS分组（包含项目） */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          background: '#f8fafc',
          borderRadius: '8px',
          padding: 12,
          border: '1px solid #e2e8f0',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#1e293b' }}>EPS 分组（包含项目）</h2>
            {selectedProjects.length > 0 && (
              <Tag color="blue" style={{ margin: 0 }}>已选择 {selectedProjects.length} 个项目</Tag>
            )}
            {flatData.length > 0 && (
              <Tag color="default" style={{ margin: 0 }}>总计: {flatData.length} 个节点</Tag>
            )}
          </div>
          <Space size="small">
            <Input.Search
              placeholder="搜索项目ID或名称"
              size="small"
              style={{ width: 220 }}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
            <Select
              placeholder="按 EPS 筛选"
              size="small"
              style={{ width: 180 }}
              allowClear
              value={epsFilter}
              onChange={(value) => setEpsFilter(value)}
            >
              {uniqueEpsIds.map((epsId: number) => {
                const projectsInEps = (projects || []).filter(
                  (p: Project) => p.parent_eps_object_id === epsId
                )
                return (
                  <Option key={epsId.toString()} value={epsId}>
                    EPS {epsId} ({projectsInEps.length} 个项目)
                  </Option>
                )
              })}
            </Select>
            <Button 
              size="small"
              onClick={() => {
                setSearchText('')
                setEpsFilter(null)
                setSelectedProjects([])
                setCheckedKeys([])
              }}
            >
              清除筛选
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

        {/* 树形显示 EPS 和项目 */}
        <div
          ref={treeAreaRef}
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            background: '#ffffff',
            borderRadius: '4px',
            border: '1px solid #e2e8f0',
            padding: 12,
          }}
        >
          <div style={{ height: bodyHeight, overflowY: 'auto', overflowX: 'hidden' }}>
            <Spin spinning={epsTreeLoading}>
              <Tree
                checkable
                checkedKeys={checkedKeys}
                onCheck={onCheck}
                expandedKeys={expandedKeys}
                onExpand={setExpandedKeys}
                treeData={treeData}
                titleRender={titleRender}
                blockNode
                showLine={{ showLeafIcon: false }}
                style={{
                  background: 'transparent',
                }}
                checkStrictly={false}
              />
            </Spin>
          </div>
        </div>
      </div>

      {/* EPS作业清单模态框 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UnorderedListOutlined />
            <span>作业清单</span>
            {epsActivitiesData && (
              <>
                {epsActivitiesData.eps_name && (
                  <Tag color="blue">
                    EPS: {epsActivitiesData.eps_name}
                  </Tag>
                )}
                <Tag color="green">
                  {epsActivitiesData.activity_count} 个作业
                </Tag>
                <Tag color="orange">
                  {epsActivitiesData.project_count} 个项目
                </Tag>
              </>
            )}
          </div>
        }
        open={epsActivitiesModalVisible}
        onCancel={() => {
          setEpsActivitiesModalVisible(false)
          setEpsActivitiesData(null)
        }}
        footer={[
          <Button key="close" onClick={() => {
            setEpsActivitiesModalVisible(false)
            setEpsActivitiesData(null)
          }}>
            关闭
          </Button>
        ]}
        width={1200}
        style={{ top: 20 }}
      >
        <Spin spinning={epsActivitiesLoading}>
          {epsActivitiesData ? (
            <div>
              <div style={{ marginBottom: 16 }}>
                <Space>
                  {epsActivitiesData.eps_name && (
                    <Tag>EPS名称: {epsActivitiesData.eps_name}</Tag>
                  )}
                  {epsActivitiesData.project_ids && (
                    <Tag>已选择 {epsActivitiesData.project_ids.length} 个项目</Tag>
                  )}
                  <Tag color="blue">项目数: {epsActivitiesData.project_count}</Tag>
                  <Tag color="green">作业数: {epsActivitiesData.activity_count}</Tag>
                </Space>
              </div>
              
              {epsActivitiesData.projects && epsActivitiesData.projects.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <h4>包含的项目:</h4>
                  <Space wrap>
                    {epsActivitiesData.projects.map((proj: any) => (
                      <Tag key={proj.id} color="green">{proj.name} ({proj.id})</Tag>
                    ))}
                  </Space>
                </div>
              )}
              
              {epsActivitiesData.activities && epsActivitiesData.activities.length > 0 ? (
                <div>作业列表（待实现）</div>
              ) : (
                <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                  暂无作业数据
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
              加载中...
            </div>
          )}
        </Spin>
      </Modal>
    </div>
  )
}

export default P6Management
