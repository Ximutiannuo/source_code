import React, { useState, useEffect } from 'react';
import { 
    Card, Button, Row, Col, Statistic, Table, Tag, Space, 
    message, Typography, Progress, Select, Divider, Spin 
} from 'antd';
import { 
    SyncOutlined, 
    CheckCircleOutlined, FilterOutlined,
    ArrowUpOutlined, DatabaseOutlined,
    SwapOutlined, RiseOutlined, FallOutlined
} from '@ant-design/icons';
import { 
    ResponsiveContainer, XAxis, YAxis, 
    CartesianGrid, Tooltip as RechartsTooltip, Legend, AreaChart, Area
} from 'recharts';
import api from '../services/api';
import dayjs from 'dayjs';
import { logger } from '../utils/logger';

const { Title, Text } = Typography;
const { Option } = Select;

const MDRDesignManagement: React.FC = () => {
    // --- 状态管理 ---
    const [syncStatus, setSyncStatus] = useState<any>(null);
    const [stats, setStats] = useState<any>(null);
    const [curveData, setCurveData] = useState<any[]>([]);
    const [deltaData, setDeltaData] = useState<any>(null);
    const [analysisData, setAnalysisData] = useState<any[]>([]);
    const [filters, setFilters] = useState<any>({
        originators: [],
        disciplines: [],
        doc_types: []
    });
    
    const [selectedFilters, setSelectedFilters] = useState<any>({
        originator: undefined,
        discipline: undefined,
        doc_type: undefined
    });

    const [loading, setLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState(0);
    const [syncMessage, setSyncMessage] = useState('');

    const fetchData = async () => {
        // ... (保持原有逻辑)
        setLoading(true);
        try {
            const [filterRes, statsRes, curveRes, deltaRes, analysisRes, syncRes] = await Promise.all([
                api.get('/external-data/mdr/filters'),
                api.post('/external-data/mdr/dashboard-stats', selectedFilters),
                api.post('/external-data/mdr/s-curve', selectedFilters),
                api.post('/external-data/mdr/delta-analysis', selectedFilters),
                api.get('/external-data/mdr/analysis', { params: selectedFilters }),
                api.get('/external-data/mdr/sync-status')
            ]);

            setFilters(filterRes.data);
            setStats(statsRes.data);
            setCurveData(curveRes.data);
            setDeltaData(deltaRes.data);
            setAnalysisData(analysisRes.data);
            setSyncStatus(syncRes.data);

            if (syncRes.data?.status === 'running') {
                setIsSyncing(true);
                setSyncMessage(syncRes.data.message);
                const total = syncRes.data.total_count || 1;
                const processed = syncRes.data.processed_count || 0;
                let progress = Math.round((processed / total) * 100);
                // 如果数据拉取完成（processed >= total），根据message判断预计算阶段
                if (processed >= total && total > 0) {
                    const msg = syncRes.data.message || '';
                    if (msg.includes('正在生成聚合分析汇总')) {
                        progress = 95;
                    } else if (msg.includes('Delta Cache')) {
                        progress = 97;
                    } else if (msg.includes('SCurve Cache')) {
                        progress = 99;
                    } else {
                        progress = Math.min(progress, 99); // 其他情况最多99%
                    }
                }
                setSyncProgress(progress);
            }
        } catch (error: any) {
            logger.error('Failed to load MDR dashboard data', error);
            if (error.response?.status === 504) {
                message.error('数据加载超时 (504)');
            } else {
                message.error('加载数据失败');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedFilters]);

    // 定时轮询同步状态
    useEffect(() => {
        let interval: any;
        if (isSyncing) {
            interval = setInterval(async () => {
                try {
                    const res = await api.get('/external-data/mdr/sync-status');
                    setSyncStatus(res.data);
                    setSyncMessage(res.data?.message || '');
                    
                    if (res.data?.status !== 'running') {
                        setIsSyncing(false);
                        if (res.data?.status === 'success') {
                            message.success('MDR 同步成功，数据已更新');
                        } else {
                            message.error('MDR 同步失败: ' + res.data?.message);
                        }
                        fetchData();
                    } else {
                        const total = res.data.total_count || 1;
                        const processed = res.data.processed_count || 0;
                        let progress = Math.round((processed / total) * 100);
                        // 如果数据拉取完成（processed >= total），根据message判断预计算阶段
                        if (processed >= total && total > 0) {
                            const msg = res.data.message || '';
                            if (msg.includes('正在生成聚合分析汇总')) {
                                progress = 95;
                            } else if (msg.includes('Delta Cache')) {
                                progress = 97;
                            } else if (msg.includes('SCurve Cache')) {
                                progress = 99;
                            } else {
                                progress = Math.min(progress, 99); // 其他情况最多99%
                            }
                        }
                        setSyncProgress(progress);
                    }
                } catch (e) { logger.error('Sync progress error:', e); }
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [isSyncing]);

    const handleSync = async () => {
        if (isSyncing) return;
        setSyncProgress(0);
        setSyncMessage('准备启动中...');
        try {
            await api.post('/external-data/mdr/sync-trigger', {});
            setIsSyncing(true);
            message.info('同步任务已加入后台队列');
        } catch (error: any) {
            message.error('启动失败: ' + error.message);
        }
    };

    const columns = [
        { title: 'Originator', dataIndex: 'originator_code', key: 'originator_code' },
        { title: 'Discipline', dataIndex: 'discipline', key: 'discipline' },
        { title: 'Total DWG', dataIndex: 'total_dwg', key: 'total_dwg', render: (v: any) => v?.toLocaleString() },
        { 
            title: 'Finished', 
            dataIndex: 'finished_dwg', 
            key: 'finished_dwg', 
            render: (v: any, record: any) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Text>{v?.toLocaleString()}</Text>
                    <Progress 
                        percent={record.total_dwg > 0 ? Math.round((v / record.total_dwg) * 100) : 0} 
                        size="small" 
                        strokeColor="#52c41a"
                        style={{ width: 60 }} 
                    />
                </div>
            )
        }
    ];

    if (loading && !stats) return <div style={{ padding: '100px', textAlign: 'center' }}><Spin size="large" tip="正在构建 MDR 仪表盘..." /></div>;

    return (
        <div style={{ background: '#f8f9fa', minHeight: '100vh', padding: '20px' }}>
            <style>{`
                .mdr-kpi-card { border-radius: 4px; border: none; box-shadow: 0 1px 2px rgba(0,0,0,0.03); background: #fff; }
                .mdr-filter-bar { background: #fff; padding: 12px 24px; border-radius: 4px; margin-bottom: 20px; display: flex; align-items: center; gap: 16px; border: 1px solid #f0f0f0; }
                .minimal-select .ant-select-selector { border: none !important; border-bottom: 1px solid #d9d9d9 !important; border-radius: 0 !important; box-shadow: none !important; }
                .delta-stat-item { padding: 8px 16px; border-radius: 4px; display: flex; flex-direction: column; }
                .delta-stat-item.positive { background: #f6ffed; border: 1px solid #b7eb8f; }
                .delta-stat-item.negative { background: #fff1f0; border: 1px solid #ffa39e; }
                .delta-stat-item.neutral { background: #e6f7ff; border: 1px solid #91d5ff; }
            `}</style>

            {/* 同步状态浮层面板 */}
            {isSyncing && (
                <div style={{ 
                    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000, 
                    background: 'rgba(255,255,255,0.95)', padding: '12px 24px', 
                    boxShadow: '0 2px 10px rgba(0,0,0,0.1)', borderBottom: '2px solid #1890ff' 
                }}>
                    <Row align="middle" gutter={24}>
                        <Col flex="auto">
                            <Space direction="vertical" style={{ width: '100%' }} size={4}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Text strong><SyncOutlined spin style={{ color: '#1890ff' }} /> MDR 数据同步执行中...</Text>
                                    <Text type="secondary" style={{ fontSize: '12px' }}>{syncMessage}</Text>
                                </div>
                                <Progress 
                                    percent={syncProgress} 
                                    status="active" 
                                    strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }}
                                    showInfo={true}
                                />
                            </Space>
                        </Col>
                        <Col>
                            <Button size="small" type="link" onClick={() => setIsSyncing(false)}>隐藏</Button>
                        </Col>
                    </Row>
                </div>
            )}

            {/* 顶部标题 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px' }}>
                <div>
                    <Title level={3} style={{ margin: 0, color: '#262626' }}>MDR Design Progress Control</Title>
                    <Text type="secondary">GCC Dashboard v2.0 - Week-over-Week Dynamic Analytics</Text>
                </div>
                <Space align="end">
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ marginBottom: '4px' }}>
                            <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>
                                Snapshot: {syncStatus?.sync_time ? dayjs(syncStatus.sync_time).format('YYYY-MM-DD HH:mm') : '-'}
                            </Text>
                            {syncStatus?.status === 'failed' && (
                                <Text type="danger" style={{ fontSize: '10px' }}>
                                    Last Sync Failed: {syncStatus.message?.substring(0, 30)}...
                                </Text>
                            )}
                        </div>
                        <Tag 
                            color={syncStatus?.status === 'success' ? 'success' : syncStatus?.status === 'failed' ? 'error' : 'processing'} 
                            icon={syncStatus?.status === 'running' ? <SyncOutlined spin /> : <CheckCircleOutlined />}
                            title={syncStatus?.message}
                        >
                            {syncStatus?.status === 'running' ? `Syncing ${syncProgress}%` : 
                             syncStatus?.status === 'failed' ? 'Sync Failed' : 'Synced'}
                        </Tag>
                    </div>
                    <Button type="primary" size="small" ghost icon={<SyncOutlined />} onClick={handleSync} disabled={isSyncing}>
                        Refresh Data
                    </Button>
                </Space>
            </div>

            {/* 筛选器 */}
            <div className="mdr-filter-bar">
                <Space size={24}>
                    <Space><FilterOutlined style={{ color: '#8c8c8c' }} /><Text strong style={{ fontSize: '12px' }}>GLOBAL FILTERS</Text></Space>
                    <Select placeholder="Originator" style={{ width: 180 }} className="minimal-select" allowClear onChange={(v) => setSelectedFilters({...selectedFilters, originator: v})}>
                        {filters.originators.map((o: string) => <Option key={o} value={o}>{o}</Option>)}
                    </Select>
                    <Select placeholder="Discipline" style={{ width: 180 }} className="minimal-select" allowClear onChange={(v) => setSelectedFilters({...selectedFilters, discipline: v})}>
                        {filters.disciplines.map((d: string) => <Option key={d} value={d}>{d}</Option>)}
                    </Select>
                    <Select placeholder="Doc Type" style={{ width: 180 }} className="minimal-select" allowClear onChange={(v) => setSelectedFilters({...selectedFilters, doc_type: v})}>
                        {filters.doc_types.map((t: string) => <Option key={t} value={t}>{t}</Option>)}
                    </Select>
                </Space>
            </div>

            {/* KPI 磁贴 */}
            <Row gutter={16} style={{ marginBottom: '20px' }}>
                <Col span={6}>
                    <Card className="mdr-kpi-card" size="small">
                        <Statistic title={<Text type="secondary" style={{fontSize:'12px'}}>Total Registered DWGs</Text>} value={stats?.current?.total || 0} prefix={<DatabaseOutlined style={{ color: '#bfbfbf' }} />} />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card className="mdr-kpi-card" size="small">
                        <Statistic 
                            title={<Text type="secondary" style={{fontSize:'12px'}}>Actual IFC Delivery</Text>} 
                            value={stats?.current?.actual || 0} 
                            valueStyle={{ color: '#1890ff' }}
                            suffix={
                                <span style={{ fontSize: '12px', color: deltaData?.new_completed >= 0 ? '#52c41a' : '#ff4d4f' }}>
                                    <ArrowUpOutlined /> {deltaData?.new_completed || 0} <Text type="secondary" style={{fontSize:'10px'}}>this week</Text>
                                </span>
                            }
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card className="mdr-kpi-card" size="small">
                        <Statistic 
                            title={<Text type="secondary" style={{fontSize:'12px'}}>Plan Progress</Text>} 
                            value={stats?.current?.total ? (stats.current.plan / stats.current.total * 100).toFixed(1) : 0} 
                            suffix="%" 
                        />
                        <Progress percent={stats?.current?.total ? (stats.current.plan / stats.current.total * 100) : 0} size="small" showInfo={false} strokeColor="#d9d9d9" />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card className="mdr-kpi-card" size="small" style={{ background: '#1890ff' }}>
                        <Statistic 
                            title={<Text style={{fontSize:'12px', color: 'rgba(255,255,255,0.8)'}}>Actual Progress (Cumulative)</Text>} 
                            value={stats?.current?.total ? (stats.current.actual / stats.current.total * 100).toFixed(1) : 0} 
                            suffix={<span style={{color:'#fff'}}>%</span>}
                            valueStyle={{ color: '#fff' }}
                        />
                        <Progress percent={stats?.current?.total ? (stats.current.actual / stats.current.total * 100) : 0} size="small" showInfo={false} strokeColor="#fff" />
                    </Card>
                </Col>
            </Row>

            {/* S-Curve & WoW Changes */}
            <Row gutter={16} style={{ marginBottom: '20px' }}>
                <Col span={16}>
                    <Card className="mdr-kpi-card" title={<Text strong>Engineering Accumulative Progress (S-Curve)</Text>} size="small">
                        <div style={{ height: '360px', padding: '16px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={curveData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#1890ff" stopOpacity={0.1}/>
                                            <stop offset="95%" stopColor="#1890ff" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#8c8c8c'}} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#8c8c8c'}} />
                                    <RechartsTooltip contentStyle={{ borderRadius: '4px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }} />
                                    <Legend verticalAlign="top" align="right" height={36} iconType="circle" />
                                    <Area type="monotone" dataKey="plan" stroke="#d9d9d9" strokeWidth={2} fill="transparent" name="Plan" dot={false} strokeDasharray="5 5" />
                                    <Area type="monotone" dataKey="actual" stroke="#1890ff" strokeWidth={3} fillOpacity={1} fill="url(#colorActual)" name="Actual" dot={false} />
                                    <Area type="monotone" dataKey="forecast" stroke="#fa8c16" strokeWidth={2} fill="transparent" name="Forecast" dot={false} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </Col>
                <Col span={8}>
                    <Card className="mdr-kpi-card" title={<Text strong>WoW Changes & Adjustments</Text>} size="small" style={{ height: '100%' }}>
                        <div style={{ padding: '12px' }}>
                            <Space direction="vertical" style={{ width: '100%' }} size={16}>
                                <div className="delta-stat-item positive">
                                    <Text type="secondary" style={{fontSize:'11px'}}>NEWLY COMPLETED (ACTUAL IFC)</Text>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                        <Title level={3} style={{ margin: 0, color: '#52c41a' }}>+{deltaData?.new_completed || 0}</Title>
                                        <RiseOutlined style={{ fontSize: '24px', color: '#52c41a', opacity: 0.3 }} />
                                    </div>
                                </div>

                                <div className="delta-stat-item neutral">
                                    <Text type="secondary" style={{fontSize:'11px'}}>PLAN ACCELERATED (DATES MOVED UP)</Text>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                        <Title level={3} style={{ margin: 0, color: '#1890ff' }}>{deltaData?.accelerated || 0}</Title>
                                        <SwapOutlined style={{ fontSize: '24px', color: '#1890ff', opacity: 0.3 }} />
                                    </div>
                                    <Text type="secondary" style={{fontSize:'10px'}}>Drawings with earlier plan dates vs last week</Text>
                                </div>

                                <div className="delta-stat-item negative">
                                    <Text type="secondary" style={{fontSize:'11px'}}>PLAN DELAYED (DATES POSTPONED)</Text>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                        <Title level={3} style={{ margin: 0, color: '#ff4d4f' }}>{deltaData?.delayed || 0}</Title>
                                        <FallOutlined style={{ fontSize: '24px', color: '#ff4d4f', opacity: 0.3 }} />
                                    </div>
                                    <Text type="secondary" style={{fontSize:'10px'}}>Drawings with later plan dates vs last week</Text>
                                </div>
                            </Space>

                            <Divider style={{ margin: '20px 0' }} />
                            <div style={{ textAlign: 'center' }}>
                                <Text type="secondary" style={{ fontSize: '11px' }}>
                                    Adjustments reflect revisions in the GCC design schedule since last synchronization.
                                </Text>
                            </div>
                        </div>
                    </Card>
                </Col>
            </Row>

            {/* Bottom Analysis Table */}
            <Card className="mdr-kpi-card" title={<Text strong>Discipline & Originator Data Matrix</Text>} size="small">
                <Table 
                    dataSource={analysisData} 
                    columns={columns} 
                    rowKey={(record) => `${record.originator_code}-${record.discipline}`}
                    pagination={{ pageSize: 10 }}
                    size="small"
                    loading={loading}
                />
            </Card>
        </div>
    );
};

export default MDRDesignManagement;
