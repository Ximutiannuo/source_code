import { useEffect, useMemo, useRef, useState } from 'react';
import { 
  Row, 
  Col, 
  Card, 
  Typography, 
  Progress, 
  Spin,
  Modal,
  Pagination,
} from 'antd';
import { 
  PictureOutlined,
  LinkOutlined,
  SendOutlined,
  LikeOutlined,
  DislikeOutlined,
  PlusOutlined,
  ThunderboltOutlined,
  BarChartOutlined,
  WarningOutlined,
  NodeIndexOutlined,
  CameraOutlined,
  HistoryOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { Input, message } from 'antd';
import { aiAssistantService, ChatMessage, QueryLogItem } from '../services/aiAssistantService';
import { dashboardService, ProgressCurveItem, ProgressCurveSummaryItem, ProgressCurvePhaseItem, HomeStatsResponse, DddStatsResponse } from '../services/dashboardService';
import { aheadPlanService, FeedbackRankings } from '../services/aheadPlanService';
import { volumeControlServiceV2, VolumeControlSummaryItem } from '../services/volumeControlServiceV2';
import { VolumeControlCardItem } from '../components/dashboard/CardCarousel';
import { SubprojectVolumeCardLayout } from '../components/dashboard/SubprojectVolumeCardLayout';
import ProductivityAnalysisDrawer from '../components/dashboard/ProductivityAnalysisDrawer';
import HMDSummaryDrawer from '../components/dashboard/HMDSummaryDrawer';
import PlanDeltaAnalysisModal from '../components/dashboard/PlanDeltaAnalysisModal.tsx';
import KeyQuantitiesDrawer from '../components/dashboard/KeyQuantitiesDrawer';
import LegacyModuleBanner from '../components/common/LegacyModuleBanner';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart, 
  Pie, 
  Cell
} from 'recharts';

const { Title, Text } = Typography;

// 中心 hub 六项，顺时针顺序；完成一圈后下一项进中心、当前中心变为环绕
const HUB_ITEMS = ['Critical Path', 'Site Photo', 'Key Quantities', 'Productivity Analysis', 'Plan Delta Analysis', "How's my driving (HMD)"];
const HUB_ORBIT_DURATION_MS = 20000; // 一圈 20 秒
const HUB_ORBIT_RADIUS = 200;
const HUB_TRANSITION_DURATION_MS = 1000; // 轮换总时长：先中心→轨道，再轨道→中心
const HUB_TRANSITION_PHASE1_RATIO = 0.5; // 前半段：中心移出到轨道；后半段：轨道移入中心
const HUB_3D_TILT_DEG = 22; // 俯视倾斜角（度），轨道平面呈 3D 椭圆
const HUB_3D_DEPTH_PX = 50; // 中心⇄轨道 过渡时 Z 轴位移（近大远小）
const HUB_CENTER_SIZE = 180;
const HUB_SATELLITE_SIZE = 100;
const HUB_SATELLITE_SCALE = HUB_SATELLITE_SIZE / HUB_CENTER_SIZE; // ≈0.556

const HUB_ITEM_METADATA: Record<string, { icon: React.ReactNode; color: string; bgColor: string }> = {
  'Critical Path': { icon: <NodeIndexOutlined />, color: '#f87171', bgColor: 'radial-gradient(circle at 35% 35%, #f87171 0%, #ef4444 40%, #991b1b 100%)' },
  'Site Photo': { icon: <CameraOutlined />, color: '#60a5fa', bgColor: 'radial-gradient(circle at 35% 35%, #60a5fa 0%, #3b82f6 40%, #1e3a8a 100%)' },
  'Key Quantities': { icon: <BarChartOutlined />, color: '#34d399', bgColor: 'radial-gradient(circle at 35% 35%, #34d399 0%, #10b981 40%, #064e3b 100%)' },
  'Productivity Analysis': { icon: <ThunderboltOutlined />, color: '#fbbf24', bgColor: 'radial-gradient(circle at 35% 35%, #fbbf24 0%, #f59e0b 40%, #78350f 100%)' },
  'Plan Delta Analysis': { icon: <WarningOutlined />, color: '#fca5a5', bgColor: 'radial-gradient(circle at 35% 35%, #fca5a5 0%, #ef4444 40%, #7f1d1d 100%)' },
  "How's my driving (HMD)": { icon: <LikeOutlined />, color: '#10b981', bgColor: 'radial-gradient(circle at 35% 35%, #34d399 0%, #10b981 40%, #064e3b 100%)' },
};

const Dashboard = () => {
  // S曲线数据
  const [curveData, setCurveData] = useState<ProgressCurveItem[]>([]);
  const [curveLoading, setCurveLoading] = useState(true);
  // 截止日 plan/forecast/actual/variance（全局 + EN/PR/CT）
  const [curveSummary, setCurveSummary] = useState<ProgressCurveSummaryItem[]>([]);
  // GCC 表（contract_phase：Add1/Add2/Add2.1）
  const [curvePhases, setCurvePhases] = useState<ProgressCurvePhaseItem[]>([]);
  // 首页概览：已开工天数、累计进度
  const [homeStats, setHomeStats] = useState<HomeStatsResponse | null>(null);
  // DDD 数量（ext_eng_db_current）
  const [dddStats, setDddStats] = useState<DddStatsResponse | null>(null);
  // 协作好评弹幕（替换原关键里程碑模块，位置、窗体大小不变）
  const [feedbackMarquee, setFeedbackMarquee] = useState<Array<{ id: number; user_name: string; label: string; message: string; confirmed_at: string }>>([]);
  // 协作好评排名：提问专家、高手如云、特别好评
  const [feedbackRankings, setFeedbackRankings] = useState<FeedbackRankings | null>(null);
  // P 板块：material_arrived 按 subproject 分解（汇总 + ECU/PEL/UIO）
  const [pCardsSummary, setPCardsSummary] = useState<VolumeControlCardItem[]>([]);
  const [pCardsECU, setPCardsECU] = useState<VolumeControlCardItem[]>([]);
  const [pCardsPEL, setPCardsPEL] = useState<VolumeControlCardItem[]>([]);
  const [pCardsUIO, setPCardsUIO] = useState<VolumeControlCardItem[]>([]);
  const [pCardsLoading, setPCardsLoading] = useState(false);
  // C 板块：construction_completed 按 subproject 分解
  const [cCardsSummary, setCCardsSummary] = useState<VolumeControlCardItem[]>([]);
  const [cCardsECU, setCCardsECU] = useState<VolumeControlCardItem[]>([]);
  const [cCardsPEL, setCCardsPEL] = useState<VolumeControlCardItem[]>([]);
  const [cCardsUIO, setCCardsUIO] = useState<VolumeControlCardItem[]>([]);
  const [cCardsLoading, setCCardsLoading] = useState(false);
  // 中心 hub：当前中心项索引、轨道旋转角度（度），顺时针绕圈后轮换中心
  const [hubCenterIndex, setHubCenterIndex] = useState(0);
  const [hubOrbitRotation, setHubOrbitRotation] = useState(0);
  const [hubTransitioning, setHubTransitioning] = useState(false);
  const [hubTransitionProgress, setHubTransitionProgress] = useState(0);
  const [hubNextCenterIndex, setHubNextCenterIndex] = useState(0);
  const hubCenterIndexRef = useRef(0);
  const hubTransitioningRef = useRef(false);
  hubCenterIndexRef.current = hubCenterIndex;
  hubTransitioningRef.current = hubTransitioning;
  // AI 助手（对话模式：保留历史用于上下文）
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReplyLogId, setAiReplyLogId] = useState<number | null>(null);
  const [aiFeedback, setAiFeedback] = useState<'like' | 'dislike' | null>(null);
  const [aiRemaining, setAiRemaining] = useState<number | null>(null);
  const [aiHistory, setAiHistory] = useState<ChatMessage[]>([]);
  const [aiSendingMessage, setAiSendingMessage] = useState<string | null>(null); // 发送中显示的用户消息
  const aiChatScrollRef = useRef<HTMLDivElement>(null);
  // AI 历史记录抽屉
  const [aiHistoryOpen, setAiHistoryOpen] = useState(false);
  const [aiHistoryList, setAiHistoryList] = useState<QueryLogItem[]>([]);
  const [aiHistoryLoading, setAiHistoryLoading] = useState(false);
  const [aiHistoryTotal, setAiHistoryTotal] = useState(0);
  const [aiHistoryPage, setAiHistoryPage] = useState(1);
  const aiHistoryPageSize = 20;
  const [aiHistorySearchKeyword, setAiHistorySearchKeyword] = useState('');
  // 工效分析：点中 Productivity Analysis 时展开详情
  const [productivityDrawerOpen, setProductivityDrawerOpen] = useState(false);
  // 我的反馈汇总（HMD）：点中 How's my driving (HMD) 时展开
  const [hmdSummaryDrawerOpen, setHmdSummaryDrawerOpen] = useState(false);
  // 协作好评左侧排名墙：鼠标悬停时暂停自动滚动
  const [hmdRankingsHovered, setHmdRankingsHovered] = useState(false);
  // P/C 板块同步：选中的维度索引、备选卡片页码
  const [volumeCardActiveIndex, setVolumeCardActiveIndex] = useState(0);
  const [volumeCardPage, setVolumeCardPage] = useState(0);
  const handleVolumeCardActiveIndexChange = (idx: number) => {
    setVolumeCardActiveIndex(idx);
    setVolumeCardPage(Math.floor(idx / 7)); // 切换到包含该维度的页
  };
  // Plan Delta Analysis：点中 Plan Delta Analysis 时展开
  const [planDeltaAnalysisModalOpen, setPlanDeltaAnalysisModalOpen] = useState(false);
  // Key Quantities：点中 Key Quantities 时展开堆叠柱状图
  const [keyQuantitiesDrawerOpen, setKeyQuantitiesDrawerOpen] = useState(false);

  const AI_HISTORY_CONVERSATION_GAP_MS = 30 * 60 * 1000; // 30 分钟内视为同一对话
  const formatConversationTime = (dateStr: string | null) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffD = Math.floor(diffMs / 86400000);
    if (diffD === 0) return `今天 ${d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
    if (diffD === 1) return `昨天 ${d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
    return d.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };
  const groupAiHistoryByConversation = (items: QueryLogItem[]): QueryLogItem[][] => {
    if (items.length === 0) return [];
    const sorted = [...items].sort((a, b) => (new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()));
    const groups: QueryLogItem[][] = [];
    let current: QueryLogItem[] = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1].created_at || 0).getTime();
      const curr = new Date(sorted[i].created_at || 0).getTime();
      if (prev - curr <= AI_HISTORY_CONVERSATION_GAP_MS) current.push(sorted[i]);
      else { groups.push(current); current = [sorted[i]]; }
    }
    groups.push(current);
    return groups;
  };
  const aiHistoryFilteredList = (() => {
    const k = aiHistorySearchKeyword.trim().toLowerCase();
    if (!k) return aiHistoryList;
    return aiHistoryList.filter(
      (item) =>
        (item.question && item.question.toLowerCase().includes(k)) ||
        (item.reply && item.reply.toLowerCase().includes(k))
    );
  })();
  const aiHistoryGrouped = groupAiHistoryByConversation(aiHistoryFilteredList);
  useEffect(() => {
    dashboardService.getProgressCurve()
      .then(setCurveData)
      .catch(() => setCurveData([]))
      .finally(() => setCurveLoading(false));
  }, []);

  useEffect(() => {
    dashboardService.getProgressCurveSummary()
      .then(setCurveSummary)
      .catch(() => setCurveSummary([]));
  }, []);

  useEffect(() => {
    dashboardService.getProgressCurvePhases()
      .then(setCurvePhases)
      .catch(() => setCurvePhases([]));
  }, []);

  useEffect(() => {
    dashboardService.getHomeStats()
      .then(setHomeStats)
      .catch(() => setHomeStats(null));
  }, []);

  useEffect(() => {
    dashboardService.getDddStats()
      .then(setDddStats)
      .catch(() => setDddStats(null));
  }, []);

  useEffect(() => {
    aheadPlanService.getFeedbackMarquee(20)
      .then(setFeedbackMarquee)
      .catch(() => setFeedbackMarquee([]));
  }, []);

  useEffect(() => {
    aheadPlanService.getFeedbackRankings(10, 3)
      .then(setFeedbackRankings)
      .catch(() => setFeedbackRankings(null));
  }, []);

  // P 板块：material_arrived 按 subproject 分解（汇总 + ECU/PEL/UIO）
  useEffect(() => {
    const mapToCards = (list: VolumeControlSummaryItem[]): VolumeControlCardItem[] =>
      (list || [])
        .filter((item) => item.group_name && (item.estimated_total ?? 0) > 0)
        .map((item) => ({
          groupName: item.group_name,
          arrived: item.material_arrived ?? 0,
          estimatedTotal: item.estimated_total ?? 0,
          ratio: (item.material_arrived ?? 0) / (item.estimated_total ?? 1),
        }));
    setPCardsLoading(true);
    Promise.all([
      volumeControlServiceV2.getVolumeControlSummary({ group_by: 'key_qty' }),
      volumeControlServiceV2.getVolumeControlSummary({ group_by: 'key_qty', filters: { subproject: ['ECU'] } }),
      volumeControlServiceV2.getVolumeControlSummary({ group_by: 'key_qty', filters: { subproject: ['PEL'] } }),
      volumeControlServiceV2.getVolumeControlSummary({ group_by: 'key_qty', filters: { subproject: ['UIO'] } }),
    ])
      .then(([sum, ecu, pel, uio]) => {
        setPCardsSummary(mapToCards(sum));
        setPCardsECU(mapToCards(ecu));
        setPCardsPEL(mapToCards(pel));
        setPCardsUIO(mapToCards(uio));
      })
      .catch(() => {
        setPCardsSummary([]);
        setPCardsECU([]);
        setPCardsPEL([]);
        setPCardsUIO([]);
      })
      .finally(() => setPCardsLoading(false));
  }, []);

  // 对话区有新消息时滚动到底部
  useEffect(() => {
    aiChatScrollRef.current?.scrollTo?.({ top: aiChatScrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [aiHistory.length, aiSendingMessage, aiLoading]);

  // AI 助手：获取今日剩余次数
  useEffect(() => {
    aiAssistantService.getUsage()
      .then((r) => setAiRemaining(r.remaining))
      .catch(() => setAiRemaining(null));
  }, []);

  // AI 历史记录：打开抽屉时加载
  const loadAiHistory = (page: number = 1) => {
    setAiHistoryLoading(true);
    aiAssistantService.getQueryLog({ page, page_size: aiHistoryPageSize, days: 30 })
      .then((r) => {
        setAiHistoryList(r.items);
        setAiHistoryTotal(r.total);
        setAiHistoryPage(r.page);
      })
      .catch(() => {
        setAiHistoryList([]);
        setAiHistoryTotal(0);
      })
      .finally(() => setAiHistoryLoading(false));
  };
  useEffect(() => {
    if (aiHistoryOpen) loadAiHistory(1);
  }, [aiHistoryOpen]);

  const handleNewSession = () => {
    setAiHistory([]);
    setAiReplyLogId(null);
    setAiFeedback(null);
    setAiSendingMessage(null);
  };

  const handleAiSubmit = () => {
    const text = aiInput.trim();
    if (!text) return;
    setAiLoading(true);
    setAiReplyLogId(null);
    setAiFeedback(null);
    setAiSendingMessage(text);
    setAiInput('');
    aiAssistantService.chat(text, aiHistory.length > 0 ? aiHistory : undefined)
      .then((r) => {
        setAiReplyLogId(r.log_id ?? null);
        setAiRemaining(r.remaining);
        setAiSendingMessage(null);
        if (r.history) setAiHistory(r.history);
      })
      .catch((err: any) => {
        const detail = err?.response?.data?.detail;
        const msg = typeof detail === 'string' ? detail : (detail?.message ?? '请求失败，请重试');
        message.error(msg);
        if (err?.response?.status === 429) {
          setAiRemaining(0);
        }
        setAiSendingMessage(null);
      })
      .finally(() => setAiLoading(false));
  };

  const handleAiFeedback = (fb: 'like' | 'dislike') => {
    if (!aiReplyLogId || aiFeedback) return;
    aiAssistantService.submitFeedback(aiReplyLogId, fb).then(() => setAiFeedback(fb)).catch(() => {});
  };

  const handleHubItemClick = (label: string) => {
    if (label === 'Productivity Analysis') {
      setProductivityDrawerOpen(true);
    } else if (label === "How's my driving (HMD)") {
      setHmdSummaryDrawerOpen(true);
    } else if (label === 'Plan Delta Analysis') {
      setPlanDeltaAnalysisModalOpen(true);
    } else if (label === 'Key Quantities') {
      setKeyQuantitiesDrawerOpen(true);
    }
  };

  // C 板块：construction_completed 按 subproject 分解（汇总 + ECU/PEL/UIO）
  useEffect(() => {
    const mapToCards = (list: VolumeControlSummaryItem[]): VolumeControlCardItem[] =>
      (list || [])
        .filter((item) => item.group_name && (item.estimated_total ?? 0) > 0)
        .map((item) => ({
          groupName: item.group_name,
          arrived: item.construction_completed ?? 0,
          estimatedTotal: item.estimated_total ?? 0,
          ratio: (item.construction_completed ?? 0) / (item.estimated_total ?? 1),
        }));
    setCCardsLoading(true);
    Promise.all([
      volumeControlServiceV2.getVolumeControlSummary({ group_by: 'key_qty' }),
      volumeControlServiceV2.getVolumeControlSummary({ group_by: 'key_qty', filters: { subproject: ['ECU'] } }),
      volumeControlServiceV2.getVolumeControlSummary({ group_by: 'key_qty', filters: { subproject: ['PEL'] } }),
      volumeControlServiceV2.getVolumeControlSummary({ group_by: 'key_qty', filters: { subproject: ['UIO'] } }),
    ])
      .then(([sum, ecu, pel, uio]) => {
        setCCardsSummary(mapToCards(sum));
        setCCardsECU(mapToCards(ecu));
        setCCardsPEL(mapToCards(pel));
        setCCardsUIO(mapToCards(uio));
      })
      .catch(() => {
        setCCardsSummary([]);
        setCCardsECU([]);
        setCCardsPEL([]);
        setCCardsUIO([]);
      })
      .finally(() => setCCardsLoading(false));
  }, []);

  // P/C  unified 维度列表：P 和 C 共用，用于同步选中维度
  const volumeCardMasterDimensionList = useMemo(() => {
    const seen = new Set<string>();
    const result: VolumeControlCardItem[] = [];
    for (const item of pCardsSummary) {
      if (item.groupName && (item.estimatedTotal ?? 0) > 0 && !seen.has(item.groupName)) {
        seen.add(item.groupName);
        result.push(item);
      }
    }
    for (const item of cCardsSummary) {
      if (item.groupName && (item.estimatedTotal ?? 0) > 0 && !seen.has(item.groupName)) {
        seen.add(item.groupName);
        result.push(item);
      }
    }
    return result;
  }, [pCardsSummary, cCardsSummary]);

  useEffect(() => {
    const n = volumeCardMasterDimensionList.length
    if (n > 0 && volumeCardActiveIndex >= n) {
      setVolumeCardActiveIndex(0)
      setVolumeCardPage(0)
    }
  }, [volumeCardMasterDimensionList.length, volumeCardActiveIndex])

  // 中心 hub：环绕顺时针旋转，一圈结束后进入轮换动画（不立即切中心）
  useEffect(() => {
    let rafId: number;
    let lastTs = performance.now();
    const step = (ts: number) => {
      const elapsed = ts - lastTs;
      lastTs = ts;
      if (hubTransitioningRef.current) {
        rafId = requestAnimationFrame(step);
        return;
      }
      setHubOrbitRotation((prev) => {
        const degPerMs = 360 / HUB_ORBIT_DURATION_MS;
        let next = prev + degPerMs * elapsed;
        if (next >= 360) {
          setHubNextCenterIndex((hubCenterIndexRef.current + 1) % HUB_ITEMS.length);
          setHubTransitioning(true);
          setHubTransitionProgress(0);
          return 0; // 过渡期间轨道停在 0°
        }
        return next;
      });
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [hubCenterIndex]);

  // 轮换动画：progress 0→1，结束后更新中心索引并清除 transition
  useEffect(() => {
    if (!hubTransitioning) return;
    const startTs = performance.now();
    let rafId: number;
    const step = (ts: number) => {
      const elapsed = ts - startTs;
      const progress = Math.min(1, elapsed / HUB_TRANSITION_DURATION_MS);
      setHubTransitionProgress(progress);
      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        setHubCenterIndex(hubNextCenterIndex);
        setHubTransitioning(false);
        setHubTransitionProgress(0);
        setHubOrbitRotation(0);
      }
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [hubTransitioning]); // eslint-disable-line react-hooks/exhaustive-deps -- hubNextCenterIndex 在触发时已设

  // 图表用的数据：无数据时显示空，避免报错
  const chartData = curveData.length > 0 ? curveData : [];
  const globalRow = curveSummary.find((r) => r.filter_key === '');
  const overallPlan = globalRow?.plan ?? 0;
  const overallForecast = globalRow?.forecast ?? 0;
  const overallActual = globalRow?.actual ?? 0;
  const overallVariance = globalRow?.variance ?? 0;

  const epcRows = {
    EN: curveSummary.find((r) => r.implement_phase === 'EN'),
    PR: curveSummary.find((r) => r.implement_phase === 'PR'),
    CT: curveSummary.find((r) => r.implement_phase === 'CT'),
  };

  // 一期机械竣工倒计时：2026-12-31 与当前日期的天数差（滞后时红色加粗）
  const mechanicalCompletionCountdown = (() => {
    const target = new Date(2026, 11, 31);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const text = diffDays > 0 ? `还剩 ${diffDays} 天` : diffDays === 0 ? '今天' : `已滞后 ${-diffDays} 天`;
    const color = diffDays > 0 ? '#22c55e' : diffDays === 0 ? '#f59e0b' : '#ef4444';
    const isOverdue = diffDays < 0;
    return { text, color, isOverdue };
  })();

  // 深色无边框：强制覆盖 Ant Design Card 默认白底白边
  const cardStyle = { border: 'none', background: 'rgba(30, 41, 59, 0.6)', boxShadow: 'none' } as const;
  const cardStyles = { body: { background: 'transparent' as const } };

  // Custom CSS for pixel-perfect overrides（与中间部分一致：深色、无白边、无白底）
  const dashboardStyles = `
    .dashboard-container {
      background: #0f172a;
      background: radial-gradient(ellipse at top, #1e293b 0%, #0f172a 100%);
      min-height: 100vh;
      padding: 16px;
      padding-bottom: 24px;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      overflow-x: hidden;
      overflow-y: visible;
    }
    /* 强制覆盖 Ant Design Card 默认样式，消除白边白底 */
    .dashboard-container .ant-card {
      border: none !important;
      background: rgba(30, 41, 59, 0.6) !important;
      box-shadow: none !important;
      border-radius: 4px;
      overflow: hidden;
    }
    .dashboard-container .ant-card .ant-card-body {
      background: transparent !important;
    }
    /* 同一行的板块等高：Row 拉伸，Col 内卡片填满 */
    .dashboard-container .row-equal-height .ant-col {
      display: flex;
    }
    .dashboard-container .row-equal-height .ant-col > .ant-card,
    .dashboard-container .row-equal-height .ant-col > .tech-card {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }
    .dashboard-container .row-equal-height .ant-col > .ant-card .ant-card-body {
      flex: 1;
      min-height: 0;
      overflow: auto;
    }
    .dashboard-container .ant-card .ant-card-head {
      background: linear-gradient(90deg, rgba(30, 58, 138, 0.8) 0%, rgba(30, 58, 138, 0.2) 60%, transparent 100%) !important;
      border-bottom-color: rgba(59, 130, 246, 0.2) !important;
      color: #e2e8f0 !important;
    }
    .dashboard-container .ant-card .ant-card-head-title {
      color: #e2e8f0 !important;
    }
    .dashboard-container .tech-card {
      border: none !important;
      background: rgba(30, 41, 59, 0.6) !important;
      box-shadow: none !important;
      border-radius: 4px;
      overflow: hidden;
    }
    
    .tech-card .ant-card-head {
      background: linear-gradient(90deg, rgba(30, 58, 138, 0.8) 0%, rgba(30, 58, 138, 0.2) 60%, transparent 100%);
      border-bottom: 1px solid rgba(59, 130, 246, 0.2);
      min-height: 36px;
      padding: 0 12px;
      color: #e2e8f0;
    }
    
    .tech-card .ant-card-head-title {
      padding: 8px 0;
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #e2e8f0;
    }
    
    .tech-card .ant-card-body {
      padding: 12px;
      background: transparent !important;
      color: #e2e8f0;
    }
    
    /* Progress Curves 内图表图例与坐标轴文字（深色背景可见） */
    .tech-card .recharts-default-legend .recharts-legend-item-text {
      fill: #e2e8f0 !important;
    }
    .tech-card .recharts-cartesian-axis-tick text {
      fill: #94a3b8 !important;
    }
    .tech-card .ant-spin-text {
      color: #94a3b8 !important;
    }

    /* 中间板块球体漂浮动画 */
    @keyframes hub-orb-float {
      0%, 100% { transform: translate(-50%, -50%) translateY(0); }
      50% { transform: translate(-50%, -50%) translateY(-8px); }
    }
    @keyframes hub-satellite-float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-5px); }
    }
    @keyframes hub-satellite-float-center {
      0%, 100% { transform: translateX(-50%) translateY(0); }
      50% { transform: translateX(-50%) translateY(-5px); }
    }
    .hub-orb-float {
      animation: hub-orb-float 4s ease-in-out infinite;
    }
    .hub-satellite-float {
      animation: hub-satellite-float 3.5s ease-in-out infinite;
    }
    .hub-satellite-float-center {
      animation: hub-satellite-float-center 3.5s ease-in-out infinite;
      animation-delay: 2s;
    }
    .hub-satellite-float:nth-child(1) { animation-delay: 0s; }

    /* AI 输入框 RGB 环绕发光（Gemini 风格） */
    .ai-input-rgb-wrap {
      position: relative;
      padding: 2px;
      border-radius: 8px;
      background: linear-gradient(90deg, #ff0080, #ff8c00, #40e0d0, #9d4edd, #ff0080);
      background-size: 300% 100%;
      animation: ai-rgb-border 4s linear infinite;
    }
    .ai-input-rgb-wrap .ant-input-affix-wrapper {
      border-radius: 6px;
      overflow: hidden;
      border: none !important;
      box-shadow: none !important;
    }
    .ai-input-rgb-wrap .ant-input {
      border-radius: 6px;
    }
    /* 占位符与边框同款 RGB 渐变（协调） */
    .ai-input-rgb-wrap .ant-input::placeholder {
      background: linear-gradient(90deg, #ff0080, #ff8c00, #40e0d0, #9d4edd, #ff0080);
      background-size: 300% 100%;
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      animation: ai-rgb-border 4s linear infinite;
    }
    @keyframes ai-rgb-border {
      0% { background-position: 0% 50%; }
      100% { background-position: 300% 50%; }
    }

    /* AI 历史记录弹窗：深色主题，无白色背景 */
    .ai-history-modal.ant-modal .ant-modal-wrap { background: rgba(0, 0, 0, 0.45); }
    .ai-history-modal.ant-modal .ant-modal-content { background: #0f172a !important; border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 8px; box-shadow: 0 24px 48px rgba(0, 0, 0, 0.4); }
    .ai-history-modal.ant-modal .ant-modal-content .ant-modal-body { background: #0f172a !important; }
    .ai-history-modal.ant-modal .ant-modal-header { background: #0f172a !important; border-bottom: 1px solid #334155; padding: 16px 24px; }
    .ai-history-modal.ant-modal .ant-modal-title { color: #f1f5f9; font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
    .ai-history-modal.ant-modal .ant-modal-close { color: #94a3b8; }
    .ai-history-modal.ant-modal .ant-modal-close:hover { color: #f1f5f9; }
    .ai-history-modal.ant-modal .ant-modal-body { background: #0f172a !important; padding: 16px 24px; border-radius: 0 0 8px 8px; max-height: 70vh; overflow-y: auto; }
    .ai-history-conversations { display: flex; flex-direction: column; gap: 24px; }
    .ai-history-conv-block { border: 1px solid #334155; border-radius: 2px; overflow: hidden; background: #1e293b; }
    .ai-history-conv-time { font-size: 11px; color: #94a3b8; padding: 8px 12px; border-bottom: 1px solid #334155; font-variant-numeric: tabular-nums; }
    .ai-history-conv-messages { display: flex; flex-direction: column; gap: 8px; padding: 12px; }
    .ai-history-msg { max-width: 85%; font-size: 13px; line-height: 1.55; word-break: break-word; white-space: pre-wrap; padding: 10px 12px; border-radius: 2px; }
    .ai-history-msg.user { align-self: flex-end; background: rgba(59, 130, 246, 0.25); color: #f8fafc; border: 1px solid rgba(59, 130, 246, 0.3); }
    .ai-history-msg.assistant { align-self: flex-start; background: #334155; color: #e2e8f0; border: 1px solid #475569; }
    .ai-history-msg-assistant-footer { display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-top: 6px; font-size: 11px; }
    .ai-history-msg-expand { color: #60a5fa; cursor: pointer; }
    .ai-history-empty { text-align: center; padding: 48px 24px; color: #94a3b8; }
    .ai-history-empty-icon { font-size: 48px; margin-bottom: 16px; opacity: 0.6; }
    .ai-history-pagination { margin-top: 20px; display: flex; justify-content: center; }
    .ai-history-pagination .ant-pagination-item { background: rgba(30, 41, 59, 0.8) !important; border-color: #334155 !important; }
    .ai-history-pagination .ant-pagination-item a { color: #e2e8f0 !important; }
    .ai-history-pagination .ant-pagination-item-active { border-color: #3b82f6 !important; background: rgba(59, 130, 246, 0.2) !important; }
    .ai-history-pagination .ant-pagination-prev .ant-pagination-item-link, .ai-history-pagination .ant-pagination-next .ant-pagination-item-link { background: rgba(30, 41, 59, 0.8) !important; border-color: #334155 !important; color: #e2e8f0 !important; }
    .ai-history-pagination .ant-pagination-disabled .ant-pagination-item-link { color: #475569 !important; }
    .ai-history-pagination .ant-pagination-options { display: none; }

    .hub-satellite-float:nth-child(2) { animation-delay: 0.5s; }
    .hub-satellite-float:nth-child(3) { animation-delay: 1s; }
    .hub-satellite-float:nth-child(4) { animation-delay: 1.5s; }

    /* Bottom Section Specific Headers */
    .bottom-card-header {
      background: #1e3a8a; /* Solid blue for bottom headers as per design */
      display: flex;
      align-items: center;
      height: 32px;
      padding: 0 12px;
      font-weight: bold;
      color: white;
      font-size: 14px;
    }

    /* Table Styles */
    .tech-table {
      width: 100%;
      font-size: 11px;
      border-collapse: separate;
      border-spacing: 0;
    }
    .tech-table th {
      background: rgba(59, 130, 246, 0.15);
      color: #bfdbfe;
      font-weight: 600;
      padding: 6px 4px;
      border: 1px solid rgba(71, 85, 105, 0.5);
      text-align: center;
    }
    .tech-table td {
      padding: 6px 4px;
      border: 1px solid rgba(71, 85, 105, 0.5);
      text-align: center;
      color: #e2e8f0;
    }
    /* Progress Curves 两表列宽对齐 */
    .progress-curves-tables .tech-table {
      table-layout: fixed;
    }
    .progress-curves-tables .tech-table th:nth-child(1),
    .progress-curves-tables .tech-table td:nth-child(1) { width: 14%; }
    .progress-curves-tables .tech-table th:nth-child(2),
    .progress-curves-tables .tech-table td:nth-child(2) { width: 14%; }
    .progress-curves-tables .tech-table th:nth-child(3),
    .progress-curves-tables .tech-table td:nth-child(3) { width: 18%; }
    .progress-curves-tables .tech-table th:nth-child(4),
    .progress-curves-tables .tech-table td:nth-child(4) { width: 18%; }
    .progress-curves-tables .tech-table th:nth-child(5),
    .progress-curves-tables .tech-table td:nth-child(5) { width: 18%; }
    .progress-curves-tables .tech-table th:nth-child(6),
    .progress-curves-tables .tech-table td:nth-child(6) { width: 18%; }

    /* Progress Override */
    .ant-progress-bg {
      height: 8px !important;
      border-radius: 2px !important;
    }
    .ant-progress-inner {
      background-color: rgba(255,255,255,0.1) !important;
      border-radius: 2px !important;
    }
  `;

  const renderProgressRing = (title: string, plan: number, forecast: number, actual: number, variance: number, size: number = 62) => (
    <div style={{ textAlign: 'center', marginBottom: 10 }}>
      <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={[
                { name: 'Actual', value: actual },
                { name: 'Remaining', value: 100 - actual }
              ]}
              cx="50%" cy="50%" innerRadius={size/2 - 5} outerRadius={size/2}
              fill="#8884d8" paddingAngle={0} dataKey="value" startAngle={90} endAngle={-270}
              stroke="none"
            >
              <Cell key="cell-0" fill={actual >= plan ? "#22c55e" : "#3b82f6"} />
              <Cell key="cell-1" fill="rgba(255,255,255,0.05)" />
            </Pie>
            <text x="50%" y="50%" dy={3} textAnchor="middle" fill="#fff" style={{ fontSize: 12, fontWeight: 'bold', fontFamily: 'Arial' }}>
              +{actual.toFixed(1)}%
            </text>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ marginTop: 4 }}>
        <div style={{ fontSize: 11, color: '#f1f5f9', fontWeight: 600, marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 10, color: '#94a3b8', display: 'flex', justifyContent: 'space-between', padding: '0 6px' }}>
          <span>Plan</span>
          <span style={{ color: '#fff' }}>{plan.toFixed(2)}%</span>
        </div>
        <div style={{ fontSize: 10, color: '#94a3b8', display: 'flex', justifyContent: 'space-between', padding: '0 6px' }}>
          <span>Forecast</span>
          <span style={{ color: '#fff' }}>{forecast.toFixed(2)}%</span>
        </div>
        <div style={{ fontSize: 10, color: '#94a3b8', display: 'flex', justifyContent: 'space-between', padding: '0 6px' }}>
          <span>Actual</span>
          <span style={{ color: '#fff' }}>{actual.toFixed(2)}%</span>
        </div>
        <div style={{ fontSize: 10, fontWeight: 'bold', color: variance < 0 ? '#ef4444' : '#22c55e', marginTop: 1 }}>
          Variance {variance >= 0 ? '+' : ''}{variance.toFixed(1)}%
        </div>
      </div>
    </div>
  );

  return (
    <div className="dashboard-container">
      <style>{dashboardStyles}</style>

      <LegacyModuleBanner
        title="遗留工程首页"
        description="该页面保留原工程建设计划系统的驾驶舱、S 曲线、施工量与协作好评等视图，适合查询历史工程项目数据，不再作为机械制造平台默认首页。"
        note="大型机械制造建议以订单、工单、物料齐套、工艺路线、设备稼动与交付节点为主线，不再沿用 EPC 工程驾驶舱作为主入口。"
        actions={[
          { label: '进入制造驾驶舱', path: '/manufacturing', type: 'primary' },
          { label: '查看制造订单', path: '/manufacturing/orders' },
        ]}
      />

      {/* 1. Header Section：两列等高 160px */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }} className="row-equal-height">
        <Col span={12} style={{ minHeight: 160 }}>
          <div className="tech-card" style={{ padding: 20, height: 160, display: 'flex', alignItems: 'center', background: '#1e293b', border: 'none', boxShadow: 'none' }}>
            <Row gutter={24} style={{ width: '100%' }}>
              <Col span={8}>
                <div style={{ 
                  width: '100%', height: 120, background: '#0f172a', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 6, border: '1px dashed #334155'
                }}>
                  <PictureOutlined style={{ fontSize: 32, color: '#475569' }} />
                </div>
              </Col>
              <Col span={16} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <Title level={4} style={{ color: '#fff', margin: '0 0 8px 0', fontWeight: 600 }}>天然气化工综合体项目</Title>
                  <Text style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.5, display: 'block', marginBottom: 16 }}>
                    GCC项目是全球最大的乙烯一体化项目，是目前全球石化领域单个合同额最大的项目...
                  </Text>
                </div>
                <div style={{ display: 'flex', gap: 32 }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 2 }}>已开工</div>
                    <div style={{ fontSize: 20, fontWeight: 'bold', color: '#fff' }}>
                      {homeStats != null ? homeStats.started_days.toLocaleString() : '—'} <span style={{ fontSize: 12, fontWeight: 'normal' }}>天</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 2 }}>进度</div>
                    <div style={{ fontSize: 20, fontWeight: 'bold', color: '#fff' }}>
                      {(homeStats != null ? homeStats.cumulative_progress : overallActual).toFixed(2)} <span style={{ fontSize: 12, fontWeight: 'normal' }}>%</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 2 }}>一期机械竣工倒计时</div>
                    <div style={{ 
                      fontSize: 20, 
                      fontWeight: mechanicalCompletionCountdown.isOverdue ? 700 : 'bold', 
                      color: mechanicalCompletionCountdown.color 
                    }}>
                      {mechanicalCompletionCountdown.text}
                    </div>
                  </div>
                </div>
              </Col>
            </Row>
          </div>
        </Col>
        <Col span={12} style={{ minHeight: 160 }}>
          <Card 
            className="tech-card"
            title="协作好评（HMD）-种子数据占位测试中，下周投用。"
            bodyStyle={{ padding: 0, flex: 1, minHeight: 0, overflow: 'hidden' }}
            style={{ ...cardStyle, height: 160, display: 'flex', flexDirection: 'column' }}
            styles={cardStyles}
          >
            <div className="feedback-card-layout">
              {/* 左 1/3：排名（特别好评、好评如潮、部门解决问题的数量、提问专家），上下自动滚动，鼠标悬停暂停 */}
              <div
                className={`feedback-rankings-panel${hmdRankingsHovered ? ' feedback-rankings-panel-paused' : ''}`}
                onMouseEnter={() => setHmdRankingsHovered(true)}
                onMouseLeave={() => setHmdRankingsHovered(false)}
              >
                {feedbackRankings && (
                  <div className="feedback-rankings-scroll-wrapper">
                    {/* 重复两份以实现无缝循环滚动 */}
                    <div className="feedback-rankings-list feedback-rankings-list-copy">
                      <div className="feedback-ranking-group">
                        {(feedbackRankings.special_praise?.length ?? 0) > 0 ? (
                          <>
                            <div className="feedback-ranking-title">特别好评</div>
                            {feedbackRankings.special_praise!.map((r, i) => (
                              <div key={`sp-a-${i}`} className="feedback-ranking-item">
                                <span className="feedback-ranking-medal">{i + 1}</span>
                                <span>{r.display_name}</span>
                                <span className="feedback-ranking-count">×{r.count}</span>
                              </div>
                            ))}
                          </>
                        ) : (feedbackRankings.praise_4star?.length ?? 0) > 0 ? (
                          <>
                            <div className="feedback-ranking-title">好评如潮</div>
                            {feedbackRankings.praise_4star!.map((r, i) => (
                              <div key={`p4-a-${i}`} className="feedback-ranking-item">
                                <span className="feedback-ranking-medal">{i + 1}</span>
                                <span>{r.display_name}</span>
                                <span className="feedback-ranking-count">×{r.count}</span>
                              </div>
                            ))}
                          </>
                        ) : (
                          <>
                            <div className="feedback-ranking-title">特别好评</div>
                            <div className="feedback-ranking-empty">暂无</div>
                          </>
                        )}
                      </div>
                      <div className="feedback-ranking-group">
                        <div className="feedback-ranking-title">部门解决榜</div>
                        {(feedbackRankings.dept_solvers?.length ?? 0) > 0 ? (
                          feedbackRankings.dept_solvers.map((r, i) => (
                            <div key={`ds-a-${i}`} className="feedback-ranking-item">
                              <span className="feedback-ranking-medal">{i + 1}</span>
                              <span>{r.display_name}</span>
                              <span className="feedback-ranking-count">×{r.count}</span>
                            </div>
                          ))
                        ) : (
                          <div className="feedback-ranking-empty">暂无</div>
                        )}
                      </div>
                      <div className="feedback-ranking-group">
                        <div className="feedback-ranking-title">提问专家</div>
                        {(feedbackRankings.ask_experts?.length ?? 0) > 0 ? (
                          feedbackRankings.ask_experts.map((r, i) => (
                            <div key={`ask-a-${i}`} className="feedback-ranking-item">
                              <span className="feedback-ranking-medal">{i + 1}</span>
                              <span>{r.display_name}</span>
                              <span className="feedback-ranking-count">×{r.count}</span>
                            </div>
                          ))
                        ) : (
                          <div className="feedback-ranking-empty">暂无</div>
                        )}
                      </div>
                    </div>
                    <div className="feedback-rankings-list feedback-rankings-list-copy">
                      <div className="feedback-ranking-group">
                        {(feedbackRankings.special_praise?.length ?? 0) > 0 ? (
                          <>
                            <div className="feedback-ranking-title">特别好评</div>
                            {feedbackRankings.special_praise!.map((r, i) => (
                              <div key={`sp-b-${i}`} className="feedback-ranking-item">
                                <span className="feedback-ranking-medal">{i + 1}</span>
                                <span>{r.display_name}</span>
                                <span className="feedback-ranking-count">×{r.count}</span>
                              </div>
                            ))}
                          </>
                        ) : (feedbackRankings.praise_4star?.length ?? 0) > 0 ? (
                          <>
                            <div className="feedback-ranking-title">好评如潮</div>
                            {feedbackRankings.praise_4star!.map((r, i) => (
                              <div key={`p4-b-${i}`} className="feedback-ranking-item">
                                <span className="feedback-ranking-medal">{i + 1}</span>
                                <span>{r.display_name}</span>
                                <span className="feedback-ranking-count">×{r.count}</span>
                              </div>
                            ))}
                          </>
                        ) : (
                          <>
                            <div className="feedback-ranking-title">特别好评</div>
                            <div className="feedback-ranking-empty">暂无</div>
                          </>
                        )}
                      </div>
                      <div className="feedback-ranking-group">
                        <div className="feedback-ranking-title">部门解决榜</div>
                        {(feedbackRankings.dept_solvers?.length ?? 0) > 0 ? (
                          feedbackRankings.dept_solvers.map((r, i) => (
                            <div key={`ds-b-${i}`} className="feedback-ranking-item">
                              <span className="feedback-ranking-medal">{i + 1}</span>
                              <span>{r.display_name}</span>
                              <span className="feedback-ranking-count">×{r.count}</span>
                            </div>
                          ))
                        ) : (
                          <div className="feedback-ranking-empty">暂无</div>
                        )}
                      </div>
                      <div className="feedback-ranking-group">
                        <div className="feedback-ranking-title">提问专家</div>
                        {(feedbackRankings.ask_experts?.length ?? 0) > 0 ? (
                          feedbackRankings.ask_experts.map((r, i) => (
                            <div key={`ask-b-${i}`} className="feedback-ranking-item">
                              <span className="feedback-ranking-medal">{i + 1}</span>
                              <span>{r.display_name}</span>
                              <span className="feedback-ranking-count">×{r.count}</span>
                            </div>
                          ))
                        ) : (
                          <div className="feedback-ranking-empty">暂无</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {/* 弹幕：多行全宽滚动，从右往左跑进排名区域 */}
              <div className="feedback-marquee-track">
                {feedbackMarquee.length > 0 ? (
                  (() => {
                    const rows = 3
                    const perRow = Math.ceil(feedbackMarquee.length / rows)
                    return Array.from({ length: rows }, (_, rowIdx) => {
                      const chunk = feedbackMarquee.slice(rowIdx * perRow, (rowIdx + 1) * perRow)
                      if (chunk.length === 0) return null
                      const doubled = [...chunk, ...chunk]
                      return (
                        <div key={rowIdx} className="feedback-marquee-row">
                          <div className="feedback-marquee-container" style={{ gap: 32 }}>
                            {doubled.map((m, i) => (
                              <span
                                key={`${m.id}-${rowIdx}-${i}`}
                                style={{
                                  fontSize: 11,
                                  color: '#10b981',
                                  flexShrink: 0,
                                  padding: '0 4px',
                                }}
                              >
                                {m.message}
                              </span>
                            ))}
                          </div>
                        </div>
                      )
                    })
                  })()
                ) : (
                  <div className="feedback-marquee-empty">暂无近期好评反馈</div>
                )}
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 2. Middle Section：三列等高，以最高列为准 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12, alignItems: 'stretch' }} className="row-equal-height">
        {/* Overall Status：去掉重复标题与 Cut-off，缩小字号与间距 */}
        <Col span={5}>
          <Card 
            className="tech-card"
            title="Overall Status"
            bodyStyle={{ padding: 10 }}
            style={cardStyle}
            styles={cardStyles}
          >
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
               <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
                 <div style={{ textAlign: 'center' }}>
                   <div style={{ fontSize: 10, color: '#94a3b8' }}>Plan</div>
                   <div style={{ fontSize: 14, fontWeight: 'bold', color: '#fff' }}>{overallPlan.toFixed(2)}%</div>
                 </div>
                 <div style={{ height: 22, width: 1, background: '#334155' }} />
                 <div style={{ textAlign: 'center' }}>
                   <div style={{ fontSize: 10, color: '#94a3b8' }}>Forecast</div>
                   <div style={{ fontSize: 14, fontWeight: 'bold', color: '#fff' }}>{overallForecast.toFixed(2)}%</div>
                 </div>
                 <div style={{ height: 22, width: 1, background: '#334155' }} />
                 <div style={{ textAlign: 'center' }}>
                   <div style={{ fontSize: 10, color: '#94a3b8' }}>Actual</div>
                   <div style={{ fontSize: 14, fontWeight: 'bold', color: '#fff' }}>{overallActual.toFixed(2)}%</div>
                 </div>
               </div>
               <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                 Variance: <span style={{ fontWeight: 'bold', color: overallVariance < 0 ? '#ef4444' : '#22c55e' }}>{overallVariance >= 0 ? '+' : ''}{overallVariance.toFixed(2)}%</span>
               </div>
            </div>
            
            <div style={{ borderTop: '1px solid #334155', paddingTop: 12 }}>
              {renderProgressRing(
                'Engineering',
                epcRows.EN?.plan ?? 0,
                epcRows.EN?.forecast ?? 0,
                epcRows.EN?.actual ?? 0,
                epcRows.EN?.variance ?? 0
              )}
              {renderProgressRing(
                'Procurement',
                epcRows.PR?.plan ?? 0,
                epcRows.PR?.forecast ?? 0,
                epcRows.PR?.actual ?? 0,
                epcRows.PR?.variance ?? 0
              )}
              {renderProgressRing(
                'Construction',
                epcRows.CT?.plan ?? 0,
                epcRows.CT?.forecast ?? 0,
                epcRows.CT?.actual ?? 0,
                epcRows.CT?.variance ?? 0
              )}
            </div>
          </Card>
        </Col>

        {/* Center Hub */}
        <Col span={11}>
          <div className="tech-card" style={{ padding: 0, position: 'relative', background: 'radial-gradient(circle at 50% 50%, #1e3a8a 0%, #0f172a 70%)', border: 'none', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
               {/* 顶部：新会话 + 历史记录 + 剩余次数 */}
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px 0', flexShrink: 0 }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                   <span
                     onClick={handleNewSession}
                     style={{
                       cursor: 'pointer',
                       color: '#60a5fa',
                       fontSize: 12,
                       display: 'flex',
                       alignItems: 'center',
                       gap: 4,
                     }}
                     title="开始新对话"
                   >
                     <PlusOutlined /> 新会话
                   </span>
                   <span
                     onClick={() => setAiHistoryOpen(true)}
                     style={{
                       cursor: 'pointer',
                       color: '#94a3b8',
                       fontSize: 12,
                       display: 'flex',
                       alignItems: 'center',
                       gap: 4,
                     }}
                     title="查看历史记录"
                   >
                     <HistoryOutlined /> 历史记录
                   </span>
                 </div>
                 {aiRemaining !== null && (
                   <span style={{ fontSize: 11, color: '#94a3b8' }}>今日剩余 {aiRemaining} 次</span>
                 )}
               </div>
               {/* 对话消息列表：AI 左，用户右 */}
               <div
                 ref={aiChatScrollRef}
                 style={{
                   flex: 1,
                   overflow: 'auto',
                   padding: '12px 16px',
                   display: 'flex',
                   flexDirection: 'column',
                   gap: 12,
                   minHeight: 120,
                   maxHeight: 280,
                 }}
               >
                 {aiHistory.map((msg, idx) => {
                   const isLastAssistant = msg.role === 'assistant' && idx === aiHistory.length - 1;
                   return (
                     <div
                       key={idx}
                       style={{
                         alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                         maxWidth: '85%',
                         padding: '8px 12px',
                         borderRadius: 8,
                         fontSize: 13,
                         lineHeight: 1.5,
                         wordBreak: 'break-word',
                         whiteSpace: 'pre-wrap',
                         overflowWrap: 'break-word',
                         ...(msg.role === 'user'
                           ? { background: 'rgba(59, 130, 246, 0.3)', color: '#e2e8f0', marginLeft: 'auto' }
                           : { background: 'rgba(15, 23, 42, 0.9)', color: '#e2e8f0', border: '1px solid rgba(59, 130, 246, 0.2)' }),
                       }}
                     >
                       {msg.content}
                       {isLastAssistant && aiReplyLogId && (
                         <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 12 }}>
                           <span
                             onClick={() => handleAiFeedback('like')}
                             style={{
                               cursor: aiFeedback ? 'default' : 'pointer',
                               color: aiFeedback === 'like' ? '#22c55e' : '#64748b',
                               opacity: aiFeedback && aiFeedback !== 'like' ? 0.4 : 1,
                             }}
                             title="有帮助"
                           >
                             <LikeOutlined /> 有用
                           </span>
                           <span
                             onClick={() => handleAiFeedback('dislike')}
                             style={{
                               cursor: aiFeedback ? 'default' : 'pointer',
                               color: aiFeedback === 'dislike' ? '#ef4444' : '#64748b',
                               opacity: aiFeedback && aiFeedback !== 'dislike' ? 0.4 : 1,
                             }}
                             title="无帮助"
                           >
                             <DislikeOutlined /> 无用
                           </span>
                         </div>
                       )}
                     </div>
                   );
                 })}
                 {aiSendingMessage && (
                   <div
                     style={{
                       alignSelf: 'flex-end',
                       maxWidth: '85%',
                       padding: '8px 12px',
                       borderRadius: 8,
                       fontSize: 13,
                       background: 'rgba(59, 130, 246, 0.3)',
                       color: '#e2e8f0',
                       wordBreak: 'break-word',
                       whiteSpace: 'pre-wrap',
                     }}
                   >
                     {aiSendingMessage}
                   </div>
                 )}
                 {aiLoading && (
                   <div style={{ alignSelf: 'flex-start', padding: '8px 12px', color: '#94a3b8', fontSize: 12 }}>
                     正在生成...
                   </div>
                 )}
               </div>
               {/* 输入框 */}
               <div style={{ padding: '12px 16px', flexShrink: 0 }}>
                 <div className="ai-input-rgb-wrap" style={{ width: '100%', maxWidth: 480, margin: '0 auto' }}>
                   <Input
                     placeholder="有什么可以帮您？"
                     value={aiInput}
                     onChange={(e) => setAiInput(e.target.value)}
                     onPressEnter={handleAiSubmit}
                     disabled={aiLoading}
                     suffix={
                       <SendOutlined
                         onClick={handleAiSubmit}
                         style={{ color: aiLoading ? '#94a3b8' : '#60a5fa', cursor: aiLoading ? 'not-allowed' : 'pointer' }}
                       />
                     }
                     style={{
                       background: 'rgba(15, 23, 42, 0.9)',
                       border: '1px solid transparent',
                       color: '#e2e8f0',
                       width: '100%',
                     }}
                     styles={{ input: { color: '#e2e8f0' } }}
                   />
                 </div>
               </div>
            </div>

            {/* AI 历史记录 - 居中弹窗 */}
            <Modal
              className="ai-history-modal"
              title={
                <span>
                  <HistoryOutlined style={{ color: '#60a5fa' }} />
                  AI 提问历史
                </span>
              }
              open={aiHistoryOpen}
              onCancel={() => setAiHistoryOpen(false)}
              footer={null}
              width={860}
              centered
              destroyOnClose
              styles={{
                body: { padding: '16px 24px', background: '#0f172a', maxHeight: '70vh', overflowY: 'auto' },
                header: { background: 'transparent', borderBottom: '1px solid #334155' },
              }}
            >
              {aiHistoryLoading ? (
                <div style={{ textAlign: 'center', padding: 48 }}>
                  <Spin size="large" tip="加载历史记录..." />
                </div>
              ) : aiHistoryList.length === 0 ? (
                <div className="ai-history-empty">
                  <div className="ai-history-empty-icon"><HistoryOutlined /></div>
                  <div style={{ fontSize: 14, marginBottom: 4 }}>暂无历史记录</div>
                  <div style={{ fontSize: 12 }}>在左侧输入问题与 AI 对话后，记录会显示在这里</div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                    <Input
                      placeholder="搜索提问或回复内容"
                      value={aiHistorySearchKeyword}
                      onChange={(e) => setAiHistorySearchKeyword(e.target.value)}
                      prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                      allowClear
                      style={{
                        maxWidth: 280,
                        background: '#1e293b',
                        border: '1px solid #334155',
                        color: '#e2e8f0',
                      }}
                      styles={{ input: { background: 'transparent', color: '#e2e8f0' } }}
                    />
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>
                      最近 30 天 · {aiHistorySearchKeyword.trim() ? `匹配 ${aiHistoryFilteredList.length} 条` : `共 ${aiHistoryTotal} 条`}
                    </span>
                  </div>
                  {aiHistoryGrouped.length === 0 ? (
                    <div className="ai-history-empty">
                      <div className="ai-history-empty-icon"><SearchOutlined /></div>
                      <div style={{ fontSize: 14, marginBottom: 4 }}>无匹配记录</div>
                      <div style={{ fontSize: 12 }}>尝试其他关键词</div>
                    </div>
                  ) : (
                  <div className="ai-history-conversations">
                    {aiHistoryGrouped.map((group, gIdx) => {
                      const chronological = [...group].reverse();
                      const firstTime = chronological[0]?.created_at ?? null;
                      return (
                        <div key={gIdx} className="ai-history-conv-block">
                          <div className="ai-history-conv-time" title={firstTime ? new Date(firstTime).toLocaleString('zh-CN') : ''}>
                            {formatConversationTime(firstTime)}
                          </div>
                          <div className="ai-history-conv-messages">
                            {chronological.map((item: QueryLogItem) => {
                              const replyText = item.reply || '—';
                              return (
                                <span key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  <div className="ai-history-msg user">{item.question}</div>
                                  <div className="ai-history-msg assistant">
                                    <div className="ai-history-reply-text">{replyText}</div>
                                    <div className="ai-history-msg-assistant-footer">
                                      {item.feedback && (
                                        item.feedback === 'like' ? <LikeOutlined style={{ color: '#22c55e', fontSize: 12 }} /> : <DislikeOutlined style={{ color: '#ef4444', fontSize: 12 }} />
                                      )}
                                    </div>
                                  </div>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  )}
                  {aiHistoryTotal > aiHistoryPageSize && (
                    <div className="ai-history-pagination">
                      <Pagination
                        current={aiHistoryPage}
                        pageSize={aiHistoryPageSize}
                        total={aiHistoryTotal}
                        showSizeChanger={false}
                        showTotal={(t) => `共 ${t} 条`}
                        onChange={loadAiHistory}
                        size="small"
                      />
                    </div>
                  )}
                </>
              )}
            </Modal>

            <div style={{ flex: 1, minHeight: 480, position: 'relative', overflow: 'hidden', perspective: 1200, perspectiveOrigin: '50% 50%' }}>
               {/* 3D 倾斜平面：俯视椭圆轨道，中心/环绕进出更有纵深感 */}
               <div style={{
                 position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
                 transform: `rotateX(${HUB_3D_TILT_DEG}deg)`,
                 transformStyle: 'preserve-3d',
                 transformOrigin: '50% 50%',
               }}>
               {/* Background Orbit Rings (Visual only) */}
               <div style={{ 
                 position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                 width: 320, height: 320, borderRadius: '50%', border: '1px solid rgba(59, 130, 246, 0.1)',
                 transformStyle: 'preserve-3d',
               }} />
               <div style={{ 
                 position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                 width: 500, height: 500, borderRadius: '50%', border: '1px solid rgba(59, 130, 246, 0.05)',
                 transformStyle: 'preserve-3d',
               }} />

               {/* 中心球：当前中心项（非过渡时）或 轮换动画（过渡时：中心→轨道 + 轨道→中心） */}
               {!hubTransitioning ? (
                 <div
                   className="hub-orb-float"
                   role="button"
                   tabIndex={0}
                   onClick={() => handleHubItemClick(HUB_ITEMS[hubCenterIndex])}
                   onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleHubItemClick(HUB_ITEMS[hubCenterIndex]); }}
                   style={{ 
                     position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                     width: HUB_CENTER_SIZE, height: HUB_CENTER_SIZE, borderRadius: '50%', 
                     background: HUB_ITEM_METADATA[HUB_ITEMS[hubCenterIndex]]?.bgColor || 'radial-gradient(circle at 35% 35%, #60a5fa 0%, #2563eb 40%, #1e3a8a 100%)',
                     display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                     boxShadow: `0 0 50px ${HUB_ITEM_METADATA[HUB_ITEMS[hubCenterIndex]]?.color || '#2563eb'}80, inset 0 0 20px rgba(255,255,255,0.2)`, 
                     zIndex: 10,
                     transformStyle: 'preserve-3d',
                     cursor: 'pointer',
                   }}
                 >
                   <div style={{ fontSize: 32, color: '#fff', marginBottom: 4, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                     {HUB_ITEM_METADATA[HUB_ITEMS[hubCenterIndex]]?.icon}
                   </div>
                   {HUB_ITEMS[hubCenterIndex].split(' ').map((word, i) => (
                     <div key={i} style={{ fontSize: 14, fontWeight: 'bold', color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.5)', lineHeight: 1.2, textAlign: 'center' }}>{word}</div>
                   ))}
                 </div>
               ) : (() => {
                 // 顺序两段：先 中心→轨道，再 轨道→中心（不是交换）
                 const p = hubTransitionProgress;
                 const phase1Progress = p <= HUB_TRANSITION_PHASE1_RATIO ? p / HUB_TRANSITION_PHASE1_RATIO : 1;
                 const phase2Progress = p <= HUB_TRANSITION_PHASE1_RATIO ? 0 : (p - HUB_TRANSITION_PHASE1_RATIO) / (1 - HUB_TRANSITION_PHASE1_RATIO);
                 const R = HUB_ORBIT_RADIUS;
                 const S = HUB_SATELLITE_SCALE;
                 const zOut = -HUB_3D_DEPTH_PX * phase1Progress;
                 const zIn = -HUB_3D_DEPTH_PX * (1 - phase2Progress);
                 const scale1 = 1 - (1 - S) * phase1Progress;
                 const scale2 = S + (1 - S) * phase2Progress;
                 const tx1 = 'translate3d(0, -' + (R * phase1Progress) + 'px, ' + zOut + 'px) scale(' + scale1 + ')';
                 const tx2 = 'translate3d(0, -' + (R * (1 - phase2Progress)) + 'px, ' + zIn + 'px) scale(' + scale2 + ')';
                 return (
                   <>
                     {/* 第一段：中心→轨道 — 当前中心移出到轨道并缩小，Z 轴向后 */}
                     <div style={{
                       position: 'absolute', top: '50%', left: '50%', width: HUB_CENTER_SIZE, height: HUB_CENTER_SIZE,
                       marginLeft: -HUB_CENTER_SIZE / 2, marginTop: -HUB_CENTER_SIZE / 2,
                       transform: tx1,
                       transformOrigin: '50% 50%',
                       transformStyle: 'preserve-3d',
                       borderRadius: '50%',
                       background: HUB_ITEM_METADATA[HUB_ITEMS[hubCenterIndex]]?.bgColor || 'radial-gradient(circle at 35% 35%, #60a5fa 0%, #2563eb 40%, #1e3a8a 100%)',
                       display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                       boxShadow: `0 0 50px ${HUB_ITEM_METADATA[HUB_ITEMS[hubCenterIndex]]?.color || '#2563eb'}80, inset 0 0 20px rgba(255,255,255,0.2)`,
                       zIndex: 11,
                     }}>
                       <div style={{ fontSize: 32, color: '#fff', marginBottom: 4 }}>
                         {HUB_ITEM_METADATA[HUB_ITEMS[hubCenterIndex]]?.icon}
                       </div>
                       {HUB_ITEMS[hubCenterIndex].split(' ').map((word, i) => (
                         <div key={i} style={{ fontSize: 14, fontWeight: 'bold', color: '#fff', textAlign: 'center' }}>{word}</div>
                       ))}
                     </div>
                     {/* phase2: orbit to center */}
                     <div style={{
                       position: 'absolute', top: '50%', left: '50%', width: HUB_CENTER_SIZE, height: HUB_CENTER_SIZE,
                       marginLeft: -HUB_CENTER_SIZE / 2, marginTop: -HUB_CENTER_SIZE / 2,
                       transform: tx2,
                       transformOrigin: '50% 50%',
                       transformStyle: 'preserve-3d',
                       borderRadius: '50%',
                       background: HUB_ITEM_METADATA[HUB_ITEMS[hubNextCenterIndex]]?.bgColor || 'radial-gradient(circle at 35% 35%, #60a5fa 0%, #2563eb 40%, #1e3a8a 100%)',
                       display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                       boxShadow: `0 0 50px ${HUB_ITEM_METADATA[HUB_ITEMS[hubNextCenterIndex]]?.color || '#2563eb'}80, inset 0 0 20px rgba(255,255,255,0.2)`,
                       zIndex: 12,
                     }}>
                       <div style={{ fontSize: 32, color: '#fff', marginBottom: 4 }}>
                         {HUB_ITEM_METADATA[HUB_ITEMS[hubNextCenterIndex]]?.icon}
                       </div>
                       {HUB_ITEMS[hubNextCenterIndex].split(' ').map((word, i) => (
                         <div key={i} style={{ fontSize: 14, fontWeight: 'bold', color: '#fff', textAlign: 'center' }}>{word}</div>
                       ))}
                     </div>
                   </>
                 );
               })()}

               {/* 环绕：非过渡时 5 项等间距旋转；过渡时仅 4 项（0° 由动画占用） */}
               <div style={{
                 position: 'absolute',
                 left: '50%',
                 top: '50%',
                 width: 0,
                 height: 0,
                 transform: `translate(-50%, -50%) rotate(${hubOrbitRotation}deg)`,
                 transformOrigin: '0 0',
                 transformStyle: 'preserve-3d',
               }}>
                 {(hubTransitioning ? [1, 2, 3, 4] : [0, 1, 2, 3, 4]).map((i) => {
                   const angle = i * 72;
                   const label = HUB_ITEMS[(hubCenterIndex + 1 + i) % HUB_ITEMS.length];
                   return (
                     <div
                       key={hubTransitioning ? `t-${i}-${label}` : `${hubCenterIndex}-${i}-${label}`}
                       style={{
                         position: 'absolute',
                         left: 0,
                         top: 0,
                         width: HUB_SATELLITE_SIZE,
                         height: HUB_SATELLITE_SIZE,
                         marginLeft: -HUB_SATELLITE_SIZE / 2,
                         marginTop: -HUB_SATELLITE_SIZE / 2,
                         transform: `rotate(${angle}deg) translateY(-${HUB_ORBIT_RADIUS}px)`,
                         transformOrigin: '50% 50%',
                       }}
                     >
                       <div
                         role="button"
                         tabIndex={0}
                         onClick={() => handleHubItemClick(label)}
                         onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleHubItemClick(label); }}
                         style={{
                           width: HUB_SATELLITE_SIZE,
                           height: HUB_SATELLITE_SIZE,
                           borderRadius: '50%',
                           background: 'rgba(30, 41, 59, 0.4)',
                           border: `1px solid ${HUB_ITEM_METADATA[label]?.color}40` || '1px solid rgba(148, 163, 184, 0.2)',
                           display: 'flex',
                           flexDirection: 'column',
                           alignItems: 'center',
                           justifyContent: 'center',
                           textAlign: 'center',
                           fontSize: 11,
                           color: '#e2e8f0',
                           backdropFilter: 'blur(4px)',
                           boxShadow: `0 4px 6px rgba(0,0,0,0.2), inset 0 0 10px ${HUB_ITEM_METADATA[label]?.color}15`,
                           transform: `rotate(${-hubOrbitRotation - angle}deg)`,
                           cursor: 'pointer',
                           gap: 4,
                         }}
                       >
                         <div style={{ fontSize: 18, color: HUB_ITEM_METADATA[label]?.color }}>
                           {HUB_ITEM_METADATA[label]?.icon}
                         </div>
                         <div style={{ padding: '0 8px', fontWeight: 500 }}>{label}</div>
                       </div>
                     </div>
                   );
                 })}
               </div>

               </div>
            </div>
          </div>
        </Col>

        {/* Curves & Detailed Tables */}
        <Col span={8}>
          <Card 
            className="tech-card"
            title="Progress Curves"
            style={cardStyle}
            styles={cardStyles}
            bodyStyle={{ flex: 1, minHeight: 0, overflow: 'auto' }}
          >
            <div style={{ height: 200, marginBottom: 20, position: 'relative' }}>
              {curveLoading ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Spin tip="加载中..." />
                </div>
              ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="date" fontSize={10} stroke="#94a3b8" tickLine={false} axisLine={{ stroke: '#475569' }} />
                  <YAxis fontSize={10} stroke="#94a3b8" tickLine={false} axisLine={false} />
                  <RechartsTooltip 
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 4, color: '#fff' }} 
                    itemStyle={{ fontSize: 12 }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Line type="monotone" dataKey="cum_plan_wf" stroke="#3b82f6" name="Plan" dot={false} strokeWidth={2} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="cum_actual_wf" stroke="#22c55e" name="Actual" dot={false} strokeWidth={2} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="cum_forecast_wf" stroke="#a855f7" name="Forecast" dot={false} strokeWidth={2} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
              )}
            </div>
            
            <div className="progress-curves-tables" style={{ marginBottom: 20 }}>
               <table className="tech-table">
                 <thead>
                   <tr>
                     <th>GCC</th>
                     <th>Weight</th>
                     <th>Plan</th>
                     <th>Forecast</th>
                     <th>Actual</th>
                     <th>Variance</th>
                   </tr>
                 </thead>
                 <tbody>
                   {[
                     { name: 'E', row: epcRows.EN },
                     { name: 'P', row: epcRows.PR },
                     { name: 'C', row: epcRows.CT },
                   ].map(({ name, row }) => (
                     <tr key={name}>
                       <td>{name}</td>
                       <td>{row?.weight_pct != null ? row.weight_pct.toFixed(1) + '%' : '—'}</td>
                       <td>{row ? row.plan.toFixed(2) + '%' : '—'}</td>
                       <td>{row ? row.forecast.toFixed(2) + '%' : '—'}</td>
                       <td>{row ? row.actual.toFixed(2) + '%' : '—'}</td>
                       <td style={{ color: row && row.variance < 0 ? '#ef4444' : '#22c55e' }}>
                         {row ? (row.variance >= 0 ? '+' : '') + row.variance.toFixed(2) + '%' : '—'}
                       </td>
                     </tr>
                   ))}
                   {globalRow && (
                     <tr style={{ fontWeight: 'bold', background: 'rgba(255,255,255,0.05)' }}>
                       <td>Total</td>
                       <td>100%</td>
                       <td>{globalRow.plan.toFixed(2)}%</td>
                       <td>{globalRow.forecast.toFixed(2)}%</td>
                       <td>{globalRow.actual.toFixed(2)}%</td>
                       <td style={{ color: globalRow.variance < 0 ? '#ef4444' : '#22c55e' }}>
                         {(globalRow.variance >= 0 ? '+' : '') + globalRow.variance.toFixed(2)}%
                       </td>
                     </tr>
                   )}
                 </tbody>
               </table>
            </div>

            <div className="progress-curves-tables" style={{ overflow: 'hidden' }}>
               <table className="tech-table">
                 <thead>
                   <tr>
                     <th>GCC</th>
                     <th>Weight</th>
                     <th>Plan</th>
                     <th>Forecast</th>
                     <th>Actual</th>
                     <th>Variance</th>
                   </tr>
                 </thead>
                 <tbody>
                   {curvePhases.length > 0 ? [...curvePhases]
                     .sort((a, b) => {
                       const order = ['add.1', 'add2.1', 'add2.2', 'add.3'];
                       const da = a.gcc_display ?? a.gcc_name;
                       const db = b.gcc_display ?? b.gcc_name;
                       const ia = order.indexOf(da);
                       const ib = order.indexOf(db);
                       return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
                     })
                     .map((row) => (
                     <tr key={row.gcc_name}>
                       <td>{row.gcc_display ?? row.gcc_name}</td>
                       <td>{row.weight_pct.toFixed(1)}%</td>
                       <td>{row.plan.toFixed(2)}%</td>
                       <td>{row.forecast.toFixed(2)}%</td>
                       <td>{row.actual.toFixed(2)}%</td>
                       <td style={{ color: row.variance < 0 ? '#ef4444' : '#22c55e' }}>
                         {(row.variance >= 0 ? '+' : '') + row.variance.toFixed(2)}%
                       </td>
                     </tr>
                   )) : (
                     <tr><td colSpan={6} style={{ color: '#94a3b8' }}>—</td></tr>
                   )}
                 </tbody>
               </table>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 3. Bottom Section: Discipline Deep Dive，四列等高 */}
      <Row gutter={[12, 12]} className="row-equal-height">
        {/* Engineering */}
        <Col span={6}>
          <div className="tech-card" style={{ border: 'none', background: 'rgba(30, 41, 59, 0.6)', boxShadow: 'none' }}>
            <div className="bottom-card-header">E</div>
            <div style={{ padding: 12, background: 'linear-gradient(180deg, rgba(30, 58, 138, 0.4) 0%, rgba(15, 23, 42, 0.8) 100%)', flex: 1, minHeight: 0 }}>
               <div style={{ marginBottom: 15 }}>
                  <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 8, color: '#fff' }}>DDD</div>
                  <Row gutter={4}>
                    {[
                      { label: 'Total', value: dddStats != null ? dddStats.total.toLocaleString() : '—', color: 'rgba(255,255,255,0.1)' },
                      { label: 'IFR', value: dddStats != null ? dddStats.ifr.toLocaleString() : '—', color: 'rgba(59, 130, 246, 0.3)' },
                      { label: 'IFC', value: dddStats != null ? dddStats.ifc.toLocaleString() : '—', color: 'rgba(34, 197, 94, 0.3)' },
                      { label: 'IFC-A', value: dddStats != null ? dddStats.ifc_a.toLocaleString() : '—', color: 'rgba(168, 85, 247, 0.3)' },
                    ].map(item => (
                      <Col span={6} key={item.label}>
                        <div style={{ background: item.color, padding: '8px 2px', textAlign: 'center', borderRadius: 2 }}>
                          <div style={{ fontSize: 9, color: '#cbd5e1' }}>{item.label}</div>
                          <div style={{ fontSize: 10, fontWeight: 'bold', color: '#fff' }}>{item.value}</div>
                        </div>
                      </Col>
                    ))}
                  </Row>
               </div>
               <div style={{ marginBottom: 8 }}>
                 <div style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between', color: '#cbd5e1', marginBottom: 2 }}>
                   <span style={{ fontWeight: 600 }}>MAC</span>
                   <span>{dddStats != null && dddStats.mac_total > 0
                     ? (dddStats.mac_ifc_a / dddStats.mac_total * 100).toFixed(1) + '%'
                     : '—'}</span>
                 </div>
                 <Progress
                   percent={dddStats != null && dddStats.mac_total > 0 ? (dddStats.mac_ifc_a / dddStats.mac_total * 100) : 0}
                   size="small"
                   strokeColor="#3b82f6"
                   trailColor="rgba(255,255,255,0.1)"
                   showInfo={false}
                 />
               </div>
               <div>
                 <div style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between', color: '#cbd5e1', marginBottom: 2 }}>
                   <span style={{ fontWeight: 600 }}>KITSO</span>
                   <span>{dddStats != null && dddStats.kisto_total > 0
                     ? (dddStats.kisto_ifc_a / dddStats.kisto_total * 100).toFixed(1) + '%'
                     : '—'}</span>
                 </div>
                 <Progress
                   percent={dddStats != null && dddStats.kisto_total > 0 ? (dddStats.kisto_ifc_a / dddStats.kisto_total * 100) : 0}
                   size="small"
                   strokeColor="#f59e0b"
                   trailColor="rgba(255,255,255,0.1)"
                   showInfo={false}
                 />
               </div>
            </div>
          </div>
        </Col>

        {/* Procurement：按 subproject 分解（汇总 + ECU/PEL/UIO） */}
        <Col span={6}>
          <div className="tech-card" style={{ border: 'none', background: 'rgba(30, 41, 59, 0.6)', boxShadow: 'none' }}>
            <div className="bottom-card-header">P</div>
            <div style={{ padding: 12, background: 'linear-gradient(180deg, rgba(30, 58, 138, 0.4) 0%, rgba(15, 23, 42, 0.8) 100%)', flex: 1, minHeight: 0 }}>
               <SubprojectVolumeCardLayout
                 summaryItems={pCardsSummary}
                 ecuItems={pCardsECU}
                 pelItems={pCardsPEL}
                 uioItems={pCardsUIO}
                 loading={pCardsLoading}
                 emptyText="暂无材料到货数据（需工程量权限）"
                 accentColor="#3b82f6"
                 masterDimensionList={volumeCardMasterDimensionList}
                 activeIndex={volumeCardActiveIndex}
                 onActiveIndexChange={handleVolumeCardActiveIndexChange}
                 page={volumeCardPage}
                 onPageChange={setVolumeCardPage}
               />
               <a
                 href="https://app.powerbi.com/links/ZgF8TfJmw_?ctid=21b5462b-6976-411e-9ee7-32e1e6e77339&pbi_source=linkShare&bookmarkGuid=83a69718-2dc6-41f4-8e10-131317694206"
                 target="_blank"
                 rel="noopener noreferrer"
                 style={{
                   display: 'flex',
                   alignItems: 'center',
                   gap: 6,
                   marginTop: 10,
                   padding: '6px 10px',
                   background: 'rgba(59, 130, 246, 0.15)',
                   borderRadius: 4,
                   color: '#60a5fa',
                   fontSize: 11,
                   textDecoration: 'none',
                   border: '1px solid rgba(59, 130, 246, 0.3)',
                 }}
               >
                 <LinkOutlined />
                 项目 Power BI，点击查看更多信息
               </a>
            </div>
          </div>
        </Col>

        {/* Construction：按 subproject 分解（汇总 + ECU/PEL/UIO） */}
        <Col span={6}>
          <div className="tech-card" style={{ border: 'none', background: 'rgba(30, 41, 59, 0.6)', boxShadow: 'none' }}>
            <div className="bottom-card-header">C</div>
            <div style={{ padding: 12, background: 'linear-gradient(180deg, rgba(30, 58, 138, 0.4) 0%, rgba(15, 23, 42, 0.8) 100%)', flex: 1, minHeight: 0 }}>
               <SubprojectVolumeCardLayout
                 summaryItems={cCardsSummary}
                 ecuItems={cCardsECU}
                 pelItems={cCardsPEL}
                 uioItems={cCardsUIO}
                 loading={cCardsLoading}
                 emptyText="暂无施工完成数据（需工程量权限）"
                 accentColor="#22c55e"
                 masterDimensionList={volumeCardMasterDimensionList}
                 activeIndex={volumeCardActiveIndex}
                 onActiveIndexChange={handleVolumeCardActiveIndexChange}
                 page={volumeCardPage}
                 onPageChange={setVolumeCardPage}
               />
            </div>
          </div>
        </Col>

        {/* Pre-Commissioning */}
        <Col span={6}>
          <div className="tech-card" style={{ border: 'none', background: 'rgba(30, 41, 59, 0.6)', boxShadow: 'none' }}>
            <div className="bottom-card-header">Pre-C</div>
            <div style={{ padding: 12, background: 'linear-gradient(180deg, rgba(30, 58, 138, 0.4) 0%, rgba(15, 23, 42, 0.8) 100%)', flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <a
                 href="https://10.78.44.3:5000/"
                 target="_blank"
                 rel="noopener noreferrer"
                 style={{
                   display: 'flex',
                   alignItems: 'center',
                   gap: 6,
                   padding: '6px 10px',
                   background: 'rgba(34, 197, 94, 0.15)',
                   borderRadius: 4,
                   color: '#22c55e',
                   fontSize: 11,
                   textDecoration: 'none',
                   border: '1px solid rgba(34, 197, 94, 0.3)',
                 }}
               >
                 <LinkOutlined />
                 点击前往预试车管理系统
               </a>
            </div>
          </div>
        </Col>
      </Row>

      <ProductivityAnalysisDrawer
        open={productivityDrawerOpen}
        onClose={() => setProductivityDrawerOpen(false)}
      />
      <HMDSummaryDrawer
        open={hmdSummaryDrawerOpen}
        onClose={() => setHmdSummaryDrawerOpen(false)}
      />
      <PlanDeltaAnalysisModal
        open={planDeltaAnalysisModalOpen}
        onClose={() => setPlanDeltaAnalysisModalOpen(false)}
      />
      <KeyQuantitiesDrawer
        open={keyQuantitiesDrawerOpen}
        onClose={() => setKeyQuantitiesDrawerOpen(false)}
      />
    </div>
  );
};

export default Dashboard;

