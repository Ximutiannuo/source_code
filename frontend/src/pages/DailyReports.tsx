import { useState, useEffect } from 'react'
import { Tabs, Button, Space } from 'antd'
import { PlusOutlined, UploadOutlined } from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import MPDBTable from '../components/reports/MPDBTable'
import VFACTDBTable from '../components/reports/VFACTDBTable'
import ManpowerSummaryTable from '../components/reports/ManpowerSummaryTable'
import MPDBModal from '../components/reports/MPDBModal'
import VFACTDBModal from '../components/reports/VFACTDBModal'
import ImportModal from '../components/reports/ImportModal'

const DailyReports = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get('tab')
    return tab === 'vfactdb' ? 'vfactdb' : 'mpdb'
  })
  
  // 当 URL 参数变化时，更新 activeTab
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'vfactdb') {
      setActiveTab('vfactdb')
    } else if (tab === 'manpower-summary') {
      setActiveTab('manpower-summary')
    } else {
      setActiveTab('mpdb')
    }
  }, [searchParams])
  
  // 当 activeTab 变化时，更新 URL 参数
  const handleTabChange = (key: string) => {
    setActiveTab(key)
    const newParams = new URLSearchParams(searchParams)
    if (key === 'vfactdb') {
      newParams.set('tab', 'vfactdb')
    } else if (key === 'manpower-summary') {
      newParams.set('tab', 'manpower-summary')
    } else {
      newParams.delete('tab')
    }
    setSearchParams(newParams, { replace: true })
  }
  const [mpdbModalVisible, setMpdbModalVisible] = useState(false)
  const [vfactdbModalVisible, setVfactdbModalVisible] = useState(false)
  const [importModalVisible, setImportModalVisible] = useState(false)
  const [editingRecord, setEditingRecord] = useState<any>(null)
  const queryClient = useQueryClient()

  const handleAddMPDB = () => {
    setEditingRecord(null)
    setMpdbModalVisible(true)
  }

  const handleAddVFACTDB = () => {
    setEditingRecord(null)
    setVfactdbModalVisible(true)
  }

  const handleEdit = (record: any) => {
    setEditingRecord(record)
    if (activeTab === 'mpdb') {
      setMpdbModalVisible(true)
    } else {
      setVfactdbModalVisible(true)
    }
  }

  const handleModalClose = () => {
    setMpdbModalVisible(false)
    setVfactdbModalVisible(false)
    setEditingRecord(null)
    queryClient.invalidateQueries({ queryKey: ['mpdb'] })
    queryClient.invalidateQueries({ queryKey: ['vfactdb'] })
  }

  return (
    <div style={{ 
      height: 'calc(100vh - 64px - 48px)', // 减去 Header(64px) 和 Content padding(24px * 2)
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden',
      background: '#f0f2f5',
      margin: '-24px', // 抵消 MainLayout Content 的 padding
      padding: 0,
      boxSizing: 'border-box'
    }}>
      {/* 顶部工具栏 */}
      <div style={{ 
        background: '#ffffff', 
        borderBottom: '1px solid #d9d9d9',
        padding: '6px 12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0
      }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#333' }}>日报系统</h2>
        <Space size="small">
          <Button
            icon={<UploadOutlined />}
            onClick={() => setImportModalVisible(true)}
            size="small"
          >
            批量导入
          </Button>
          {activeTab === 'mpdb' ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddMPDB} size="small">
              新增人力日报
            </Button>
          ) : (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddVFACTDB} size="small">
              新增工程量日报
            </Button>
          )}
        </Space>
      </div>

      <Tabs 
        activeKey={activeTab} 
        onChange={handleTabChange}
        style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        items={[
          {
            key: 'mpdb',
            label: '人力日报 (MPDB)',
            children: (
              <div style={{ height: '100%', overflow: 'hidden' }}>
                <MPDBTable onEdit={handleEdit} />
              </div>
            ),
          },
          {
            key: 'vfactdb',
            label: '工程量日报 (VFACTDB)',
            children: (
              <div style={{ height: '100%', overflow: 'hidden' }}>
                <VFACTDBTable onEdit={handleEdit} />
              </div>
            ),
          },
          {
            key: 'manpower-summary',
            label: '人力汇总',
            children: <ManpowerSummaryTable />,
          },
        ]} 
      />

      <MPDBModal
        visible={mpdbModalVisible}
        record={editingRecord}
        onCancel={handleModalClose}
        onSuccess={handleModalClose}
      />

      <VFACTDBModal
        visible={vfactdbModalVisible}
        record={editingRecord}
        onCancel={handleModalClose}
        onSuccess={handleModalClose}
      />

      <ImportModal
        visible={importModalVisible}
        type={activeTab === 'mpdb' ? 'mpdb' : 'vfactdb'}
        onCancel={() => setImportModalVisible(false)}
        onSuccess={handleModalClose}
      />
    </div>
  )
}

export default DailyReports
