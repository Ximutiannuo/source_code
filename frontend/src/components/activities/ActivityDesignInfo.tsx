import React, { useState, useEffect, useMemo } from 'react';
import { Table, Row, Col, Progress, Empty, Typography, Spin, Statistic, Tooltip, Select, Space, Divider } from 'antd';
import { 
    GlobalOutlined,
    DownloadOutlined
} from '@ant-design/icons';
import { 
    ResponsiveContainer, 
    LineChart, 
    Line, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip as RechartsTooltip, 
    Legend 
} from 'recharts';
import api from '../../services/api';
import dayjs from 'dayjs';
import { logger } from '../../utils/logger';

const { Text } = Typography;
const { Option } = Select;

interface ActivityDesignInfoProps {
    activityId: string;
}

const ActivityDesignInfo: React.FC<ActivityDesignInfoProps> = ({ activityId }) => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [typeFilter, setTypeFilter] = useState<string | null>(null);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setHasError(false);
            try {
                const res = await api.get(`/activities/${activityId}/design-info`);
                if (res.data) {
                    setData(res.data);
                } else {
                    logger.error('Empty data received from API');
                    setData({ drawings: [], doc_types: [] });
                }
            } catch (err) {
                logger.error('Failed to load design data', err);
                setHasError(true);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [activityId]);

    const filteredDrawings = useMemo(() => {
        if (!data || !Array.isArray(data.drawings)) return [];
        if (!typeFilter) return data.drawings;
        return data.drawings.filter((d: any) => d && d.doc_type === typeFilter);
    }, [data, typeFilter]);

    const dynamicCurves = useMemo(() => {
        try {
            if (!filteredDrawings || filteredDrawings.length === 0) return [];
            const activeDrawings = filteredDrawings.filter((d: any) => 
                d && d.status !== 'CANCELLED' && d.status !== 'SUPERSEDED'
            );
            if (activeDrawings.length === 0) return [];
            
            const getCumulativeData = (dateField: string) => {
                const dateCounts: Record<string, number> = {};
                activeDrawings.forEach((d: any) => {
                    const date = d[dateField];
                    if (date && date !== '0000-00-00') {
                        const dStr = String(date);
                        dateCounts[dStr] = (dateCounts[dStr] || 0) + 1;
                    }
                });
                const sortedDates = Object.keys(dateCounts).sort();
                let cum = 0;
                return sortedDates.map(date => {
                    cum += dateCounts[date];
                    return { date, count: cum };
                });
            };
            
            const planPoints = getCumulativeData('ifc_plan');
            const forecastPoints = getCumulativeData('ifc_forecast');
            const actualPoints = getCumulativeData('ifc_actual');
            
            const allDatesSet = new Set<string>();
            planPoints.forEach(p => allDatesSet.add(p.date));
            forecastPoints.forEach(p => allDatesSet.add(p.date));
            actualPoints.forEach(p => allDatesSet.add(p.date));
            
            const allDates = Array.from(allDatesSet).sort();
            let lastP = 0, lastF = 0, lastA = 0;
            return allDates.map(date => {
                const p = planPoints.find(pt => pt.date === date);
                const f = forecastPoints.find(pt => pt.date === date);
                const a = actualPoints.find(pt => pt.date === date);
                if (p) lastP = p.count;
                if (f) lastF = f.count;
                if (a) lastA = a.count;
                return { date, plan: lastP, forecast: lastF, actual: lastA };
            });
        } catch (e) {
            logger.error('Error calculating curves:', e);
            return [];
        }
    }, [filteredDrawings]);

    const stats = useMemo(() => {
        if (!filteredDrawings) return { total: 0, plan: 0, forecast: 0, actual: 0, review: 0 };
        const activeDrawings = filteredDrawings.filter((d: any) => 
            d && d.status !== 'CANCELLED' && d.status !== 'SUPERSEDED'
        );
        return {
            total: activeDrawings.length,
            plan: activeDrawings.filter((d: any) => d && d.ifc_plan).length,
            forecast: activeDrawings.filter((d: any) => d && d.ifc_forecast).length,
            actual: activeDrawings.filter((d: any) => d && d.ifc_actual).length,
            review: activeDrawings.filter((d: any) => d && d.ifc_review).length,
        };
    }, [filteredDrawings]);

    const getPct = (val: number) => {
        if (!stats.total || stats.total === 0) return '0%';
        return `${Math.round((val / stats.total) * 100)}%`;
    };

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}><Spin tip="Loading design info..." /></div>;
    if (hasError) return <div style={{ padding: '20px' }}><Empty description="Error loading design data." /></div>;
    if (!data || !Array.isArray(data.drawings) || data.drawings.length === 0) {
        return <div style={{ padding: '20px' }}><Empty description="No matched drawings." /></div>;
    }

    const formatD = (d: any) => {
        if (!d || d === '0000-00-00') return '';
        try {
            return dayjs(d).format('YYYY/MM/DD');
        } catch (e) {
            return String(d);
        }
    };

    const columns: any = [
        { 
            title: 'Drawing #', 
            dataIndex: 'doc_num', 
            key: 'doc_num', 
            width: 280,
            render: (text: string, record: any) => (
                <div style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>
                    <Tooltip title={record?.title || ''} mouseEnterDelay={0.5}>
                        <Text strong style={{ fontSize: '10px' }}>{text || '-'}</Text>
                    </Tooltip>
                    <Space size={6} style={{ marginLeft: '8px' }}>
                        {text && (
                            <>
                                <a href={`https://eu.assaicloud.com/AWeu551/get/details/GCC/DOCS/${text}`} target="_blank" rel="noreferrer" style={{fontSize:'9px', color: '#1890ff'}} title="Info"><GlobalOutlined /></a>
                                <a href={`https://eu.assaicloud.com/AWeu551/get/download/GCC/DOCS/${text}`} target="_blank" rel="noreferrer" style={{fontSize:'9px', color: '#1890ff'}} title="Download"><DownloadOutlined /></a>
                            </>
                        )}
                        {record?.status && record.status !== 'None' && (
                            <span style={{ fontSize: '9px', opacity: 0.5, marginLeft: '4px' }}>{record.status}</span>
                        )}
                    </Space>
                </div>
            )
        },
        { 
            title: 'IFR Stage',
            align: 'center',
            children: [
                { title: 'Plan', width: 80, align: 'center', render: (r: any) => <span style={{fontSize:'10px'}}>{formatD(r?.ifr_plan)}</span> },
                { title: 'Forecast', width: 80, align: 'center', render: (r: any) => <span style={{fontSize:'10px', color:'#fa8c16'}}>{formatD(r?.ifr_forecast)}</span> },
                { title: 'Actual', width: 80, align: 'center', render: (r: any) => <span style={{fontSize:'10px', color:'#52c41a'}}>{formatD(r?.ifr_actual)}</span> },
            ]
        },
        { 
            title: 'IFC Stage',
            align: 'center',
            children: [
                { title: 'Plan', width: 80, align: 'center', render: (r: any) => <span style={{fontSize:'10px'}}>{formatD(r?.ifc_plan)}</span> },
                { title: 'Forecast', width: 80, align: 'center', render: (r: any) => <span style={{fontSize:'10px', color:'#fa8c16'}}>{formatD(r?.ifc_forecast)}</span> },
                { title: 'Actual', width: 80, align: 'center', render: (r: any) => <span style={{fontSize:'10px', color:'#52c41a'}}>{formatD(r?.ifc_actual)}</span> },
            ]
        },
        { 
            title: 'REV-A', 
            width: 80, 
            align: 'center', 
            render: (r: any) => <span style={{ fontSize: '10px', color: '#389e0d', fontWeight: 'bold' }}>{formatD(r?.ifc_review)}</span> 
        }
    ];

    return (
        <div style={{ padding: '0', background: 'transparent' }}>
            <style>{`
                .minimal-design-table .ant-table { background: transparent !important; }
                .minimal-design-table .ant-table-thead > tr > th { 
                    background: #ffffff !important;
                    padding: 4px 2px !important; 
                    height: 24px !important;
                    font-size: 9px !important;
                    border-bottom: 1px solid #e2e8f0 !important;
                    border-radius: 0 !important;
                    color: #64748b !important;
                    font-weight: 600 !important;
                }
                .minimal-design-table .ant-table-tbody > tr > td { 
                    padding: 4px !important; 
                    border-bottom: 1px solid #f1f5f9 !important;
                    font-size: 9px !important;
                    vertical-align: top !important;
                }
                .minimal-design-table .ant-table-placeholder { border: none !important; background: transparent !important; }
                .minimal-design-table .ant-table-container { border-radius: 0 !important; }
                
                .minimal-select .ant-select-selector {
                    border: none !important;
                    border-radius: 0 !important;
                    box-shadow: none !important;
                    background: transparent !important;
                    padding: 0 !important;
                }
                
                .design-info-stat-card {
                    border: 1px solid #e2e8f0 !important;
                    border-radius: 0 !important;
                    padding: 8px !important;
                    background: transparent !important;
                }
            `}</style>
            
            <Row gutter={0} style={{ margin: 0 }}>
                <Col span={15} style={{ borderRight: '1px solid #e2e8f0', padding: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <Text strong style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Drawing Register ({filteredDrawings.length})</Text>
                        <Select 
                            size="small" 
                            className="minimal-select"
                            style={{ width: 120, fontSize: '8px', height: '12px' }} 
                            placeholder="Doc Type" 
                            allowClear 
                            onChange={setTypeFilter}
                            value={typeFilter}
                        >
                            {Array.isArray(data?.doc_types) && data.doc_types.map((t: any) => (
                                <Option key={String(t)} value={t}>{String(t)}</Option>
                            ))}
                        </Select>
                    </div>
                    <Table 
                        dataSource={filteredDrawings} 
                        columns={columns} 
                        pagination={{ pageSize: 10, size: 'small', showTotal: (t) => `Total ${t}`, showSizeChanger: false }} 
                        size="small"
                        rowKey="doc_num"
                        className="minimal-design-table"
                        scroll={{ x: 'max-content' }}
                    />
                </Col>

                <Col span={9} style={{ padding: '12px', background: 'transparent' }}>
                    <div style={{ marginBottom: '16px' }}>
                        <Text strong style={{ fontSize: '11px', display: 'block', marginBottom: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>IFC Delivery Statistics</Text>
                        <div className="design-info-stat-card">
                            <Row align="middle" justify="space-between" gutter={2}>
                                <Col><Statistic title={<span style={{fontSize:'9px', color: '#94a3b8'}}>Total</span>} value={stats.total} valueStyle={{fontSize:'12px', fontWeight: 600}} /></Col>
                                <Col><Statistic title={<span style={{fontSize:'9px', color: '#94a3b8'}}>Plan</span>} value={stats.plan} suffix={<small style={{fontSize:'9px', color:'#cbd5e1'}}>{getPct(stats.plan)}</small>} valueStyle={{fontSize:'12px'}} /></Col>
                                <Col><Statistic title={<span style={{fontSize:'9px', color: '#94a3b8'}}>Forecast</span>} value={stats.forecast} suffix={<small style={{fontSize:'9px', color:'#cbd5e1'}}>{getPct(stats.forecast)}</small>} valueStyle={{fontSize:'12px'}} /></Col>
                                <Col><Statistic title={<span style={{fontSize:'9px', color: '#94a3b8'}}>Actual</span>} value={stats.actual} suffix={<small style={{fontSize:'9px', color:'#cbd5e1'}}>{getPct(stats.actual)}</small>} valueStyle={{fontSize:'12px', color:'#3b82f6'}} /></Col>
                                <Col><Statistic title={<span style={{fontSize:'9px', color: '#94a3b8'}}>Review-A</span>} value={stats.review} suffix={<small style={{fontSize:'9px', color:'#cbd5e1'}}>{getPct(stats.review)}</small>} valueStyle={{fontSize:'12px', color:'#10b981'}} /></Col>
                                <Col>
                                    <Progress 
                                        type="circle" 
                                        percent={stats.total > 0 ? Math.round((stats.actual/stats.total)*100) : 0} 
                                        width={24}
                                        strokeWidth={15} 
                                        strokeColor="#3b82f6"
                                        trailColor="#f1f5f9"
                                    />
                                </Col>
                            </Row>
                        </div>
                    </div>

                    <Divider style={{ margin: '12px 0', borderTop: '1px solid #e2e8f0' }} />

                    <div style={{ height: '240px' }}>
                        <Text strong style={{ fontSize: '9px', marginBottom: '8px', display: 'block', color: '#94a3b8' }}>ACCUMULATED PROGRESS</Text>
                        {dynamicCurves && dynamicCurves.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={dynamicCurves} margin={{ top: 5, right: 5, left: -35, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="date" tickFormatter={v => v ? dayjs(v).format('MM/DD') : ''} tick={{fontSize: 8, fill: '#94a3b8'}} axisLine={{stroke: '#e2e8f0'}} />
                                    <YAxis tick={{fontSize: 8, fill: '#94a3b8'}} axisLine={{stroke: '#e2e8f0'}} />
                                    <RechartsTooltip 
                                        contentStyle={{fontSize: '10px', border: '1px solid #e2e8f0', borderRadius: 0, boxShadow: 'none', background: '#fff'}} 
                                        labelFormatter={v => v ? dayjs(v).format('YYYY/MM/DD') : ''} 
                                    />
                                    <Legend verticalAlign="top" align="right" iconType="rect" wrapperStyle={{fontSize: '9px', top: -10}} />
                                    <Line type="monotone" dataKey="plan" stroke="#cbd5e1" name="Plan" strokeWidth={1} strokeDasharray="3 3" dot={false} isAnimationActive={false} />
                                    <Line type="monotone" dataKey="forecast" stroke="#f59e0b" name="Forecast" strokeWidth={1} dot={false} isAnimationActive={false} />
                                    <Line type="monotone" dataKey="actual" stroke="#3b82f6" name="Actual" strokeWidth={2} dot={false} isAnimationActive={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #f1f5f9' }}>
                                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{fontSize:'10px', color: '#94a3b8'}}>No data for curve</span>} />
                            </div>
                        )}
                    </div>
                </Col>
            </Row>
        </div>
    );
};

export default ActivityDesignInfo;
