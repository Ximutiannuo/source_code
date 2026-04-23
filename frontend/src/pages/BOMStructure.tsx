import React, { useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  Divider,
  Empty,
  Layout,
  List,
  Space,
  Spin,
  Tree,
  Typography,
} from 'antd'
import {
  ApartmentOutlined,
  BlockOutlined,
  DeploymentUnitOutlined,
  FolderOpenOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'

import { plmService, type BOMHeader, type BOMNode } from '../services/plmService'

const { Title, Text } = Typography
const { Sider, Content } = Layout

const transformToTreeData = (node: BOMNode, path = '0'): any => ({
  title: (
    <Space>
      <Text strong>{node.material_name}</Text>
      <Text type="secondary" style={{ fontSize: 12 }}>
        ({node.material_code})
      </Text>
      <Badge
        count={`${node.quantity} ${node.unit}`}
        style={{
          backgroundColor: node.level === 0 ? '#1677ff' : '#52c41a',
          fontSize: 10,
        }}
      />
    </Space>
  ),
  key: `${path}-${node.material_code}-${node.level}`,
  icon: node.children.length > 0 ? <ApartmentOutlined /> : <BlockOutlined />,
  children: node.children.map((child, index) => transformToTreeData(child, `${path}-${index}`)),
})

const BOMStructure: React.FC = () => {
  const [selectedBOM, setSelectedBOM] = useState<BOMHeader | null>(null)

  const { data: bomHeaders = [], isLoading: isLoadingHeaders, refetch: refetchHeaders } = useQuery({
    queryKey: ['boms'],
    queryFn: () => plmService.getBOMs(),
  })

  const { data: bomTree, isLoading: isLoadingTree } = useQuery({
    queryKey: ['bomTree', selectedBOM?.id],
    queryFn: () => plmService.expandBOM(selectedBOM!.id),
    enabled: !!selectedBOM?.id,
  })

  const treeData = useMemo(() => (bomTree ? [transformToTreeData(bomTree)] : []), [bomTree])

  return (
    <div style={{ padding: 24, minHeight: 'calc(100vh - 64px)', background: '#f5f7fa' }}>
      <Layout style={{ background: 'transparent' }}>
        <Sider
          width={350}
          theme="light"
          style={{
            borderRadius: 12,
            marginRight: 24,
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: 16, borderBottom: '1px solid #f0f0f0', background: '#fff' }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Title level={5} style={{ margin: 0 }}>
                <FolderOpenOutlined style={{ marginRight: 8, color: '#1677ff' }} />
                BOM 版本列表
              </Title>
              <Button block icon={<ReloadOutlined />} onClick={() => refetchHeaders()} size="small">
                刷新列表
              </Button>
            </Space>
          </div>
          <div style={{ height: 'calc(100vh - 200px)', overflowY: 'auto' }}>
            <List
              loading={isLoadingHeaders}
              dataSource={bomHeaders}
              renderItem={item => (
                <List.Item
                  onClick={() => setSelectedBOM(item)}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    background: selectedBOM?.id === item.id ? '#e6f4ff' : 'transparent',
                    borderLeft: selectedBOM?.id === item.id ? '4px solid #1677ff' : '4px solid transparent',
                    transition: 'all 0.3s',
                  }}
                >
                  <List.Item.Meta
                    title={<Text strong>{item.material?.name || item.product_code || '未知物料'}</Text>}
                    description={
                      <Space direction="vertical" size={0}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          编码: {item.material?.code || item.product_code}
                        </Text>
                        <TagLike color="#1677ff">版本: {item.version}</TagLike>
                      </Space>
                    }
                  />
                </List.Item>
              )}
              locale={{
                emptyText: <Empty description="暂无 BOM 预定义数据" />,
              }}
            />
          </div>
        </Sider>

        <Content>
          <Card
            bordered={false}
            style={{
              borderRadius: 12,
              minHeight: 'calc(100vh - 110px)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            }}
            title={
              <Space>
                <DeploymentUnitOutlined style={{ fontSize: 20, color: '#722ed1' }} />
                <Title level={4} style={{ margin: 0 }}>
                  BOM 层级结构解析
                </Title>
              </Space>
            }
          >
            {!selectedBOM ? (
              <div
                style={{
                  height: 400,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  background: '#fafafa',
                  borderRadius: 8,
                  border: '1px dashed #d9d9d9',
                }}
              >
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={<Text type="secondary">请从左侧列表选择一个 BOM 进行结构解析</Text>}
                />
              </div>
            ) : isLoadingTree ? (
              <div style={{ textAlign: 'center', padding: 50 }}>
                <Spin size="large" tip="正在递归解析多级 BOM 结构..." />
              </div>
            ) : (
              <div style={{ padding: 8 }}>
                <div style={{ marginBottom: 24, padding: 16, background: '#f9f9f9', borderRadius: 8 }}>
                  <Space split={<Divider type="vertical" />}>
                    <Text type="secondary">
                      根节点物料 <Text strong>{selectedBOM.material?.name || selectedBOM.product_code}</Text>
                    </Text>
                    <Text type="secondary">
                      当前版本: <TagLike color="#722ed1">{selectedBOM.version}</TagLike>
                    </Text>
                    <Text type="secondary">
                      状态 <Badge status={selectedBOM.is_active ? 'success' : 'default'} text={selectedBOM.status || 'RELEASED'} />
                    </Text>
                  </Space>
                </div>

                <Tree
                  showIcon
                  defaultExpandAll
                  treeData={treeData}
                  switcherIcon={<ApartmentOutlined style={{ fontSize: 16 }} />}
                  style={{
                    fontSize: 16,
                    padding: 12,
                    background: '#fff',
                  }}
                />
              </div>
            )}
          </Card>
        </Content>
      </Layout>
    </div>
  )
}

const TagLike: React.FC<{ color: string; children: React.ReactNode }> = ({ color, children }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '0 8px',
      height: 22,
      borderRadius: 999,
      background: `${color}14`,
      color,
      fontSize: 12,
    }}
  >
    {children}
  </span>
)

export default BOMStructure
