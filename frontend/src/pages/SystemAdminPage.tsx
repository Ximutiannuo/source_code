import React, { useState } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Checkbox,
  Space,
  App,
  Card,
  Typography,
  Tag,
  Alert,
  Progress,
  Tooltip,
} from 'antd';
import {
  ReloadOutlined,
  DatabaseOutlined,
  CloudDownloadOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  CloseCircleOutlined,
  HistoryOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import { systemService, BackupInfo, RestoreTask } from '../services/systemService';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;
const { TextArea } = Input;

const SystemAdminPage: React.FC = () => {
  const { message, modal } = App.useApp();
  const { user: currentUser } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<BackupInfo | null>(null);
  const [form] = Form.useForm();

  // 1. 获取备份列表
  const { data: backups, isLoading: isBackupsLoading, refetch: refetchBackups } = useQuery({
    queryKey: ['system-backups'],
    queryFn: systemService.getBackups,
  });

  // 2. 获取实时任务状态 (每3秒轮询)
  const { data: tasks, refetch: refetchTasks } = useQuery({
    queryKey: ['system-tasks'],
    queryFn: systemService.getTasks,
    refetchInterval: (query) => {
        const hasRunning = query.state.data?.some(t => !['completed', 'failed'].includes(t.status));
        return hasRunning ? 3000 : 10000; // 有任务时3秒，无任务时10秒
    }
  });

  // 3. 系统诊断（DB连接池、MySQL连接数）
  const { data: diagnostics, refetch: refetchDiagnostics } = useQuery({
    queryKey: ['system-diagnostics'],
    queryFn: systemService.getDiagnostics,
  });

  // 4. 重操作占用（导入/导出/大查询）
  const { data: heavyOpStatus, refetch: refetchHeavyOp } = useQuery({
    queryKey: ['system-heavy-op'],
    queryFn: systemService.getHeavyOpStatus,
  });

  const restoreMutation = useMutation({
    mutationFn: systemService.restoreData,
    onSuccess: () => {
      message.success('还原指令已成功下达至后台');
      setIsModalOpen(false);
      refetchTasks();
    },
  });

  const getStatusDisplay = (task: RestoreTask) => {
    const s = task.status;
    if (s === 'completed') return <Tag color="success" icon={<CheckCircleOutlined />}>已完成</Tag>;
    if (s === 'failed') {
        return (
            <Tooltip title={task.error}>
                <Tag color="error" icon={<CloseCircleOutlined />} style={{ cursor: 'help' }}>失败 (悬停看原因)</Tag>
            </Tooltip>
        );
    }
    if (s === 'pending') return <Tag color="default">排队中</Tag>;
    
    // 处理过程中的状态展示
    let label = s;
    if (s.startsWith('importing_')) label = `正在导入 ${s.replace('importing_', '')}`;
    if (s.startsWith('merging_')) label = `正在合并 ${s.replace('merging_', '')}`;
    if (s === 'extracting') label = '解压档案中';
    
    return <Tag color="processing" icon={<SyncOutlined spin />}>{label}</Tag>;
  };

  const showRestoreModal = (backup: BackupInfo) => {
    setSelectedBackup(backup);
    setIsModalOpen(true);
    form.setFieldsValue({
      filename: backup.filename,
      target_tables: ['vfactdb'],
      all_data: false,
    });
  };

  const handleRestore = (values: any) => {
    const activityIds = values.activity_ids_str?.split(/[,，\n]/).map((s: string) => s.trim()).filter(Boolean);
    const workPackages = values.work_packages_str?.split(/[,，\n]/).map((s: string) => s.trim()).filter(Boolean);
    
    modal.confirm({
      title: '⚠️ 运维安全最终确认',
      content: (
        <div>
          <p>您即将从备份 <b>{values.filename}</b> 还原数据。</p>
          <p>采用模式：<Text type="warning" strong>{values.all_data ? '全量覆盖' : '局部对冲还原'}</Text></p>
          <ul style={{ color: '#666', fontSize: '12px' }}>
            <li>系统将自动创建 z_restore_ 前缀的临时表进行操作。</li>
            <li>还原过程中，受影响的作业行将被备份数据<b>覆盖</b>。</li>
            <li>此操作将记录在系统审计日志中。</li>
          </ul>
        </div>
      ),
      okText: '开始还原',
      okType: 'danger',
      onOk: () => {
        restoreMutation.mutate({
          filename: values.filename,
          target_tables: values.target_tables,
          activity_ids: activityIds,
          work_packages: workPackages,
          all_data: values.all_data,
        });
      }
    });
  };

  if (currentUser?.username !== 'role_system_admin' && !currentUser?.is_superuser) {
    return <Alert message="权限不足" description="该控制台仅限系统管理员访问。" type="error" />;
  }

  return (
    <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100%' }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}><DatabaseOutlined /> 生产环境数据恢复控制台</Title>
        <Space>
            <Text type="secondary">当前管理员: {currentUser?.full_name || currentUser?.username}</Text>
            <Button icon={<ReloadOutlined />} onClick={() => { refetchBackups(); refetchTasks(); refetchDiagnostics(); refetchHeavyOp(); }}>全局刷新</Button>
        </Space>
      </div>

      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* 0. 系统诊断 - DB 连接池、MySQL 连接数 */}
        <Card title={<span><InfoCircleOutlined /> 系统诊断（假死排查用）</span>} size="small">
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            {diagnostics?.db_pool_error && <Alert type="error" message={diagnostics.db_pool_error} />}
            {diagnostics?.db_pool && <Text><Text strong>连接池: </Text><Text code>{diagnostics.db_pool}</Text></Text>}
            {diagnostics?.mysql_connections != null && (
              <Text>MySQL 连接数: {diagnostics.mysql_connections} / {diagnostics.mysql_max_connections ?? '?'}</Text>
            )}
            {heavyOpStatus && (
              <Text>重操作占用: 导入={heavyOpStatus.import?.current ?? 0}/{heavyOpStatus.import?.max ?? 0}, 导出={heavyOpStatus.export?.current ?? 0}/{heavyOpStatus.export?.max ?? 0}, 大查询={heavyOpStatus.heavy_query?.current ?? 0}/{heavyOpStatus.heavy_query?.max ?? 0}</Text>
            )}
          </Space>
        </Card>

        {/* 1. 实时任务状态 */}
        <Card title={<span><SyncOutlined /> 后台任务追踪</span>} size="small">
          <Table
            dataSource={tasks}
            size="small"
            pagination={false}
            rowKey="id"
            columns={[
              { title: '时间', dataIndex: 'start_time', width: 160 },
              { title: '备份档案', dataIndex: 'filename', ellipsis: true },
              { title: '当前环节', dataIndex: 'status', render: (_, r) => getStatusDisplay(r) },
              { title: '总进度', dataIndex: 'progress', render: (p) => <Progress percent={p} size="small" /> },
              { title: '变更结果', dataIndex: 'summary', render: (s) => <Text type="success" strong>{s}</Text> },
              { title: '结果', render: (_, r) => r.status === 'completed' ? <Text type="success">成功</Text> : (r.status === 'failed' ? <Text type="danger">异常</Text> : <Text type="secondary">进行中</Text>) },
            ]}
            locale={{ emptyText: '暂无最近还原记录' }}
          />
        </Card>

        {/* 2. 备份列表 */}
        <Card title={<span><HistoryOutlined /> 可用备份档案 (D:\DatabaseBackups)</span>}>
          <Table
            dataSource={backups}
            loading={isBackupsLoading}
            rowKey="filename"
            columns={[
              { title: '档案名称', dataIndex: 'filename', render: (t) => <Text code>{t}</Text> },
              { title: '物理大小', dataIndex: 'size_mb', render: (s) => `${s} MB`, sorter: (a, b) => a.size_mb - b.size_mb },
              { title: '归档时间', dataIndex: 'created_at', defaultSortOrder: 'descend', sorter: (a, b) => a.created_at.localeCompare(b.created_at) },
              { title: '操作', width: 120, render: (_, r) => (
                <Button type="primary" size="small" ghost icon={<CloudDownloadOutlined />} onClick={() => showRestoreModal(r)}>配置还原</Button>
              )},
            ]}
          />
        </Card>
      </Space>

      <Modal
        title={<span><InfoCircleOutlined style={{ color: '#faad14' }} /> 配置数据还原任务: {selectedBackup?.filename}</span>}
        open={isModalOpen}
        onOk={() => form.submit()}
        onCancel={() => setIsModalOpen(false)}
        width={700}
        okText="下达还原指令"
        confirmLoading={restoreMutation.isPending}
      >
        <Form form={form} layout="vertical" onFinish={handleRestore}>
          <Form.Item name="filename" hidden><Input /></Form.Item>
          
          <Form.Item label="1. 选择目标业务表" name="target_tables" rules={[{required: true, message: '请选择至少一个目标表'}]}>
            <Checkbox.Group style={{ width: '100%' }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Checkbox value="vfactdb"><Badge color="blue" /> VFACTDB - 施工进度/已完成量数据</Checkbox>
                <Checkbox value="mpdb"><Badge color="orange" /> MPDB - 施工人员/机具投入数据</Checkbox>
                <Checkbox value="volume_control"><Badge color="cyan" /> Volume Control - 工程量控制/基准数据</Checkbox>
              </Space>
            </Checkbox.Group>
          </Form.Item>

          <div style={{ background: '#fff7ed', padding: '16px', borderRadius: '8px', border: '1px solid #ffedd5' }}>
            <Title level={5} style={{ marginTop: 0, color: '#c2410c' }}>2. 设定还原粒度</Title>
            
            <Form.Item name="all_data" valuePropName="checked">
              <Checkbox><Text strong type="danger">全量替换模式</Text> (警告：这将删除现有表中所有数据，并完全同步为备份时的状态)</Checkbox>
            </Form.Item>

            <Form.Item noStyle shouldUpdate={(prev, curr) => prev.all_data !== curr.all_data}>
              {({ getFieldValue }) => !getFieldValue('all_data') && (
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Form.Item 
                    label="按 Activity ID 过滤" 
                    name="activity_ids_str" 
                    help="支持逗号、空格或换行分隔。仅恢复匹配的作业记录。"
                  >
                    <TextArea placeholder="输入作业ID列表..." rows={2} />
                  </Form.Item>
                  <Form.Item 
                    label="按 Work Package 过滤" 
                    name="work_packages_str"
                    help="仅恢复匹配的作业包记录。"
                  >
                    <TextArea placeholder="输入工作包编号列表..." rows={2} />
                  </Form.Item>
                  <Alert type="info" showIcon message="提示：如果以上过滤条件都为空，局部还原将不会执行任何操作。" />
                </Space>
              )}
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

// 辅助组件：小圆点，模拟 antd 缺失的简单 Badge
const Badge = ({ color }: { color: string }) => (
    <span style={{ 
        display: 'inline-block', 
        width: '8px', 
        height: '8px', 
        borderRadius: '50%', 
        background: color, 
        marginRight: '8px' 
    }} />
);

export default SystemAdminPage;
