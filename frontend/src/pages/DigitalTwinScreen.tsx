import { useState, useEffect } from 'react'
import {
  Card,
  Row,
  Col,
  Progress,
  Spin,
  Space,
  Typography,
  Badge,
  Button
} from 'antd'
import {
  TeamOutlined,
  ToolOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
  GlobalOutlined,
  DatabaseOutlined,
  ReloadOutlined
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { dashboardService } from '../services/dashboardService'
import dayjs from 'dayjs'
import WeightProgressChart from '../components/dashboard/WeightProgressChart'
import VolumeCompletionChart from '../components/dashboard/VolumeCompletionChart'
import ManpowerChart from '../components/dashboard/ManpowerChart'

const { Text, Title } = Typography

const DigitalTwinScreen = () => {
  const [currentTime, setCurrentTime] = useState(dayjs())

  // 实时更新时间
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(dayjs())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // 获取首页汇总数据
  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => dashboardService.getSummary(),
    refetchInterval: 30000, // 每30秒刷新一次
  })

  const formatTime = (date: dayjs.Dayjs) => {
    return date.format('YYYY-MM-DD HH:mm:ss')
  }

  // 获取关键指标
  const getKeyMetrics = () => {
    if (!summary) return null

    const weightProgress = summary.weight_summary?.progress_rate || 0
    const totalManpower = summary.manpower_summary?.total_manpower || 0
    const totalMachinery = summary.manpower_summary?.total_machinery || 0

    return [
      {
        title: '项目进度',
        value: weightProgress.toFixed(1),
        suffix: '%',
        color: weightProgress > 80 ? '#52c41a' : weightProgress > 60 ? '#faad14' : '#ff4d4f',
        icon: <BarChartOutlined />,
        gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      },
      {
        title: '累计人力',
        value: totalManpower.toLocaleString(),
        suffix: '人',
        color: '#1890ff',
        icon: <TeamOutlined />,
        gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
      },
      {
        title: '累计机械',
        value: totalMachinery.toLocaleString(),
        suffix: '台',
        color: '#722ed1',
        icon: <ThunderboltOutlined />,
        gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
      },
      {
        title: '系统状态',
        value: '正常',
        color: '#52c41a',
        icon: <DatabaseOutlined />,
        gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'
      }
    ]
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
      padding: '20px',
      position: 'relative',
      overflowY: 'auto',
      overflowX: 'hidden',
      height: '100vh'
    }}>
      {/* 背景动画效果 */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `
          radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.1) 0%, transparent 50%),
          radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.1) 0%, transparent 50%),
          radial-gradient(circle at 40% 40%, rgba(120, 219, 226, 0.1) 0%, transparent 50%)
        `,
        animation: 'float 6s ease-in-out infinite'
      }} />

      {/* 顶部标题栏 */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        marginBottom: '30px',
        textAlign: 'center'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 30px rgba(102, 126, 234, 0.3)'
            }}>
              <GlobalOutlined style={{ fontSize: '28px', color: 'white' }} />
            </div>
            <div>
              <Title level={2} style={{
                color: 'white',
                margin: 0,
                fontSize: '32px',
                fontWeight: 700,
                textShadow: '0 0 20px rgba(255,255,255,0.5)'
              }}>
                项目控制数字孪生平台
              </Title>
              <Text style={{
                color: 'rgba(255,255,255,0.7)',
                fontSize: '16px'
              }}>
                实时监控 · 智能分析 · 精准控制
              </Text>
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '30px',
            color: 'white'
          }}>
            <div style={{
              padding: '10px 20px',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '20px',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.2)'
            }}>
              <div style={{ fontSize: '12px', opacity: 0.7 }}>系统时间</div>
              <div style={{ fontSize: '16px', fontWeight: 600 }}>{formatTime(currentTime)}</div>
            </div>

            <Button
              icon={<ReloadOutlined />}
              onClick={() => refetchSummary()}
              loading={summaryLoading}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: 'white',
                borderRadius: '20px',
                backdropFilter: 'blur(10px)'
              }}
            >
              刷新数据
            </Button>
          </div>
        </div>

        {/* 关键指标卡片 */}
        <Row gutter={[24, 24]}>
          {getKeyMetrics()?.map((metric, index) => (
            <Col xs={24} sm={12} lg={6} key={index}>
              <Card
                style={{
                  background: metric.gradient,
                  border: 'none',
                  borderRadius: '16px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                  backdropFilter: 'blur(10px)',
                  height: '120px',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                bodyStyle={{
                  padding: '20px',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ color: 'white', flex: 1 }}>
                  <div style={{
                    fontSize: '14px',
                    opacity: 0.8,
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    {metric.icon}
                    {metric.title}
                  </div>
                  <div style={{
                    fontSize: '28px',
                    fontWeight: 700,
                    marginBottom: '4px'
                  }}>
                    {metric.value}{metric.suffix}
                  </div>
                </div>

                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px'
                }}>
                  {metric.icon}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </div>

      {/* 主要内容区域 */}
      <Row gutter={[24, 24]} style={{ position: 'relative', zIndex: 10 }}>
        {/* 左侧：实时监控面板 */}
        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#52c41a',
                  animation: 'pulse 2s infinite'
                }} />
                <span style={{ color: 'white', fontSize: '18px', fontWeight: 600 }}>
                  实时监控
                </span>
              </Space>
            }
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '16px',
              height: '600px',
              backdropFilter: 'blur(10px)'
            }}
            headStyle={{
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              color: 'white'
            }}
            bodyStyle={{
              padding: '20px',
              height: 'calc(100% - 60px)',
              overflowY: 'auto'
            }}
          >
            <Spin spinning={summaryLoading}>
              {/* 日报填报状态 */}
              {summary?.daily_report_status && (
                <div style={{ marginBottom: '24px' }}>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: 'white',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <CheckCircleOutlined />
                    日报填报状态
                  </div>

                  {summary.daily_report_status
                    .filter(s => s.date === dayjs().format('YYYY-MM-DD'))
                    .map((status: any) => (
                    <div key={status.report_type} style={{ marginBottom: '16px' }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '8px'
                      }}>
                        <Text style={{ color: 'rgba(255,255,255,0.8)' }}>
                          {status.report_type === 'MP' ? '人力日报' : '工程量日报'}
                        </Text>
                        <Badge
                          status={status.pending_count === 0 ? 'success' : 'warning'}
                          text={`${status.submitted_count}/${status.total_scopes}`}
                        />
                      </div>
                      <Progress
                        percent={Math.round((status.submitted_count / status.total_scopes) * 100)}
                        status={status.pending_count === 0 ? 'success' : 'active'}
                        strokeColor="#52c41a"
                        trailColor="rgba(255,255,255,0.2)"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* 工程量完成情况 */}
              {summary?.volume_summary?.by_work_content && (
                <div>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: 'white',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <ToolOutlined />
                    工程量统计
                  </div>

                  {Object.entries(summary.volume_summary.by_work_content).slice(0, 3).map(([workContent, types]: [string, any]) => (
                    <div key={workContent} style={{ marginBottom: '16px' }}>
                      <Text style={{
                        color: 'rgba(255,255,255,0.8)',
                        fontSize: '12px',
                        display: 'block',
                        marginBottom: '8px'
                      }}>
                        {workContent}
                      </Text>

                      {Object.entries(types).slice(0, 2).map(([typeKey, typeItem]: [string, any]) => (
                        <div key={typeKey} style={{
                          padding: '8px 12px',
                          background: 'rgba(255,255,255,0.05)',
                          borderRadius: '8px',
                          marginBottom: '8px',
                          border: '1px solid rgba(255,255,255,0.1)'
                        }}>
                          <div style={{
                            color: 'rgba(255,255,255,0.6)',
                            fontSize: '11px',
                            marginBottom: '4px'
                          }}>
                            {typeItem.name}
                          </div>
                          <div style={{
                            color: 'white',
                            fontSize: '16px',
                            fontWeight: 600
                          }}>
                            {typeItem.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </Spin>
          </Card>
        </Col>

        {/* 中间：图表展示区 */}
        <Col xs={24} lg={16}>
          <Row gutter={[24, 24]}>
            {/* 权重进度图表 */}
            <Col xs={24}>
              <Card
                title={
                  <span style={{
                    color: 'white',
                    fontSize: '18px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <BarChartOutlined />
                    权重进度执行情况
                  </span>
                }
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '16px',
                  height: '400px',
                  backdropFilter: 'blur(10px)'
                }}
                headStyle={{
                  borderBottom: '1px solid rgba(255,255,255,0.1)',
                  color: 'white'
                }}
                bodyStyle={{
                  padding: '20px',
                  height: 'calc(100% - 60px)'
                }}
              >
                <WeightProgressChart />
              </Card>
            </Col>

            {/* 工程量和人力图表 */}
            <Col xs={24} lg={12}>
              <Card
                title={
                  <span style={{
                    color: 'white',
                    fontSize: '16px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <ToolOutlined />
                    主要工程量完成情况
                  </span>
                }
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '16px',
                  height: '350px',
                  backdropFilter: 'blur(10px)'
                }}
                headStyle={{
                  borderBottom: '1px solid rgba(255,255,255,0.1)',
                  color: 'white'
                }}
                bodyStyle={{
                  padding: '20px',
                  height: 'calc(100% - 60px)'
                }}
              >
                <VolumeCompletionChart />
              </Card>
            </Col>

            <Col xs={24} lg={12}>
              <Card
                title={
                  <span style={{
                    color: 'white',
                    fontSize: '16px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <TeamOutlined />
                    人力计划与实际投入
                  </span>
                }
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '16px',
                  height: '350px',
                  backdropFilter: 'blur(10px)'
                }}
                headStyle={{
                  borderBottom: '1px solid rgba(255,255,255,0.1)',
                  color: 'white'
                }}
                bodyStyle={{
                  padding: '20px',
                  height: 'calc(100% - 60px)'
                }}
              >
                <ManpowerChart />
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>

      {/* 底部状态栏 */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(10px)',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        padding: '10px 20px',
        zIndex: 1000
      }}>
        <Row gutter={[24, 24]} align="middle">
          <Col xs={24} sm={8}>
            <div style={{ color: 'white', fontSize: '12px' }}>
              <div>系统状态: <Badge status="success" text="正常运行" /></div>
              <div>最后更新: {currentTime.format('HH:mm:ss')}</div>
            </div>
          </Col>
          <Col xs={24} sm={8} style={{ textAlign: 'center' }}>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>
              © 2026 项目控制数字孪生平台 | 实时监控系统
            </div>
          </Col>
          <Col xs={24} sm={8} style={{ textAlign: 'right' }}>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>
              <div>数据来源: 计划管理系统</div>
              <div>更新频率: 30秒</div>
            </div>
          </Col>
        </Row>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33% { transform: translateY(-10px) rotate(120deg); }
          66% { transform: translateY(5px) rotate(240deg); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        /* 自定义滚动条样式 */
        * {
          scrollbar-width: thin;
          scrollbar-color: rgba(102, 126, 234, 0.5) rgba(255, 255, 255, 0.1);
        }

        *::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }

        *::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 5px;
        }

        *::-webkit-scrollbar-thumb {
          background: rgba(102, 126, 234, 0.5);
          border-radius: 5px;
          border: 2px solid rgba(255, 255, 255, 0.05);
        }

        *::-webkit-scrollbar-thumb:hover {
          background: rgba(102, 126, 234, 0.7);
        }

        *::-webkit-scrollbar-corner {
          background: rgba(255, 255, 255, 0.05);
        }
      `}</style>
    </div>
  )
}

export default DigitalTwinScreen
