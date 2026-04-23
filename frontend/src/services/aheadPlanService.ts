import api from './api'

export interface AheadPlanItem {
  id: number
  type_of_plan: string
  activity_id: string
  resource_id: string
  date: string
  planned_units: string
  remarks?: string | null
  user_defined_activity_name?: string | null
  created_at?: string | null
  create_by?: string | null
  updated_at?: string | null
  updated_by?: string | null
  reviewed_at?: string | null
  reviewed_by?: string | null
  approved_at?: string | null
  approved_by?: string | null
  comments?: string | null
  commented_by?: string | null
}

export interface AheadPlanListResponse {
  items: AheadPlanItem[]
  total: number
  skip: number
  limit: number
}

export interface AheadPlanCreatePayload {
  type_of_plan: string
  activity_id: string
  date: string
  planned_units: number | string
  remarks?: string | null
  user_defined_activity_name?: string | null
}

export interface AheadPlanUpdatePayload {
  planned_units?: number | string
  remarks?: string | null
  user_defined_activity_name?: string | null
  reviewed_at?: string | null
  reviewed_by?: string | null
  approved_at?: string | null
  approved_by?: string | null
  comments?: string | null
  commented_by?: string | null
}

export const aheadPlanService = {
  /** 列出已有计划版本（type_of_plan），格式如 月滚动计划_2026-01-30~2026-02-26 */
  async listPlanTypes(): Promise<{ plan_types: string[] }> {
    const { data } = await api.get<{ plan_types: string[] }>('/ahead-plan/plan-types')
    return data
  },

  async list(params: {
    type_of_plan?: string
    plan_month?: string
    resource_id?: string
    activity_id?: string
    skip?: number
    limit?: number
  }): Promise<AheadPlanListResponse> {
    const { data } = await api.get<AheadPlanListResponse>('/ahead-plan/', { params })
    return data
  },

  async get(id: number): Promise<AheadPlanItem> {
    const { data } = await api.get<AheadPlanItem>(`/ahead-plan/${id}`)
    return data
  },

  async create(payload: AheadPlanCreatePayload): Promise<AheadPlanItem> {
    const { data } = await api.post<AheadPlanItem>('/ahead-plan/', payload)
    return data
  },

  async update(id: number, payload: AheadPlanUpdatePayload): Promise<AheadPlanItem> {
    const { data } = await api.put<AheadPlanItem>(`/ahead-plan/${id}`, payload)
    return data
  },

  /**
   * 批量更新多条计划（一次请求替代多次 PUT），减轻高并发时连接与请求压力。
   * 当对同一作业多周赋相同值（如作业描述、备注）时请优先使用此接口。
   */
  async batchUpdate(updates: Array<{ plan_id: number } & Partial<AheadPlanUpdatePayload>>): Promise<{ updated: number }> {
    if (updates.length === 0) return { updated: 0 }
    const { data } = await api.post<{ updated: number }>('/ahead-plan/batch-update', { updates })
    return data
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/ahead-plan/${id}`)
  },

  async batchDelete(params: {
    type_of_plan: string
    plan_month?: string
    period_start?: string
    period_end?: string
    activity_ids: string[]
  }): Promise<{ deleted: number }> {
    const { data } = await api.post<{ deleted: number }>('/ahead-plan/batch-delete', params)
    return data
  },

  /** 系统推荐入池：近 30 天有 MP/VFACT 报送且完成比例≠100% 的作业 id 列表 */
  async getRecommendedActivityIds(): Promise<{ activity_ids: string[] }> {
    const { data } = await api.get<{ activity_ids: string[] }>('/ahead-plan/recommended-activity-ids')
    return data
  },

  /** 从作业池批量加入：为每个作业在计划月内每周创建一行（计划量 0） */
  async batchAdd(params: {
    type_of_plan: string
    plan_month?: string
    period_start?: string
    period_end?: string
    activity_ids: string[]
  }): Promise<{ created: number; skipped: number; errors: string[] }> {
    const { data } = await api.post<{ created: number; skipped: number; errors: string[] }>(
      '/ahead-plan/batch-add',
      params
    )
    return data
  },

  /** 整批/逐条审批或批准 */
  async batchApprove(params: {
    type_of_plan: string
    plan_month?: string
    period_start?: string
    period_end?: string
    activity_ids: string[]
    action: 'review' | 'approve' | 'revoke_review' | 'revoke_approve'
  }): Promise<{ updated: number }> {
    const { data } = await api.post<{ updated: number }>('/ahead-plan/batch-approve', params)
    return data
  },

  /** 计划视图：按作业聚合，含 activity 字段 + 周计划量 + 周期计划量，用于栏位1/2/3/4。支持 filters（globalFilter JSON）保证首屏符合筛选。 */
  async view(params: {
    type_of_plan: string
    plan_month?: string
    period_start?: string
    period_end?: string
    skip?: number
    limit?: number
    filters?: string
  }): Promise<AheadPlanViewResponse> {
    const { data } = await api.get<AheadPlanViewResponse>('/ahead-plan/view', { params: params as any })
    return data
  },

  /** 导出 Excel */
  async exportXlsx(params: {
    type_of_plan: string
    period_start: string
    period_end: string
    columns: Array<{ key: string; title: string; width?: number }>
    filters?: Record<string, any>
  }): Promise<Blob> {
    const { data } = await api.post('/ahead-plan/export/xlsx', params, {
      responseType: 'blob',
    })
    return data
  },

  /** 汇总统计：按工作包/资源/只看主要工作项/项目编码分组；compare_actual 为 true 时返回每周期实际完成 weekly_actual */
  async getSummary(params: {
    type_of_plan: string
    period_start: string
    period_end: string
    group_by: 'work_package' | 'resource_id_name' | 'key_qty' | 'bcc_kq_code'
    filters?: Record<string, any>
    compare_actual?: boolean
  }): Promise<AheadPlanSummaryResponse> {
    const { data } = await api.post<AheadPlanSummaryResponse>('/ahead-plan/summary', params)
    return data
  },

  /** 导入 Excel（单次上传，保留以兼容） */
  async importXlsx(file: File, typeOfPlan: string): Promise<any> {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await api.post(`/ahead-plan/import/xlsx?type_of_plan=${encodeURIComponent(typeOfPlan)}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return data
  },

  /** 分批导入（前端解析 Excel 后分批调用，支持进度展示） */
  async batchImportRecords(
    typeOfPlan: string,
    records: Array<{ activity_id: string; remarks?: string | null; user_defined_activity_name?: string | null; weekly: Record<string, string> }>
  ): Promise<{ created: number; updated: number; errors: string[]; skipped: Array<{ activity_id: string; reason: string }> }> {
    const { data } = await api.post('/ahead-plan/import/batch', {
      type_of_plan: typeOfPlan,
      records,
    })
    return data
  },

  /** 汇总行展开：按维度统计问题状态 */
  async getIssueDimensionStats(params: {
    type_of_plan: string
    period_start: string
    period_end: string
    group_by: string
    group_name: string
    dimension: 'issue_type' | 'raised_by' | 'responsible_user_id' | 'resolving_department' | 'priority' | 'raising_department'
    filters?: Record<string, any>
  }): Promise<IssueDimensionStatsResponse> {
    const { data } = await api.post<IssueDimensionStatsResponse>('/ahead-plan/issue-dimension-stats', params)
    return data
  },

  /** 汇总行展开：该分组下的问题清单。支持 dimension/dimension_value/status 过滤，分页返回 items+total。 */
  async getIssueListByGroup(params: {
    type_of_plan: string
    period_start: string
    period_end: string
    group_by: string
    group_name: string
    filters?: Record<string, any>
    limit?: number
    skip?: number
    search?: string
    dimension?: string
    dimension_value?: string | number | null
    status?: string | null
  }): Promise<{ items: AheadPlanIssueItem[]; total: number }> {
    const { data } = await api.post<{ items: AheadPlanIssueItem[]; total: number }>('/ahead-plan/issue-list-by-group', params)
    return data
  },

  /** 需要解决的问题：按作业+计划类型列表，分页返回 items+total（默认每页10条）。 */
  async listIssues(
    activityId: string,
    typeOfPlan: string,
    opts?: { skip?: number; limit?: number; search?: string }
  ): Promise<{ items: AheadPlanIssueItem[]; total: number }> {
    const { data } = await api.get<{ items: AheadPlanIssueItem[]; total: number }>('/ahead-plan/issues', {
      params: {
        activity_id: activityId,
        type_of_plan: typeOfPlan,
        skip: opts?.skip ?? 0,
        limit: opts?.limit ?? 10,
        search: opts?.search || undefined,
      },
    })
    return data
  },

  async createIssue(payload: AheadPlanIssueCreatePayload): Promise<AheadPlanIssueItem> {
    const { data } = await api.post<AheadPlanIssueItem>('/ahead-plan/issues', payload)
    return data
  },

  async updateIssue(issueId: number, payload: AheadPlanIssueUpdatePayload): Promise<AheadPlanIssueItem> {
    const { data } = await api.put<AheadPlanIssueItem>(`/ahead-plan/issues/${issueId}`, payload)
    return data
  },

  async confirmIssue(issueId: number, payload: { rating: number; rating_reason?: string; rating_reason_tags?: string[] }): Promise<AheadPlanIssueItem> {
    const { data } = await api.put<AheadPlanIssueItem>(`/ahead-plan/issues/${issueId}/confirm`, payload)
    return data
  },

  /** 批量确认评分并结案（提出人一次性对多条已解决问题好评结案） */
  async batchConfirmIssues(items: Array<{ issue_id: number; rating?: number; rating_reason?: string; rating_reason_tags?: string[] }>): Promise<{ updated: number; errors: Array<{ issue_id: number; message: string }> }> {
    const { data } = await api.post<{ updated: number; errors: Array<{ issue_id: number; message: string }> }>(
      '/ahead-plan/issues/batch-confirm',
      { items: items.map((x) => ({ issue_id: x.issue_id, rating: x.rating ?? 5, rating_reason: x.rating_reason, rating_reason_tags: x.rating_reason_tags })) }
    )
    return data
  },

  async deleteIssue(issueId: number): Promise<void> {
    await api.delete(`/ahead-plan/issues/${issueId}`)
  },

  /** 责任人下拉选项（可选按部门 code 过滤） */
  async listAssigneeOptions(departmentCode?: string): Promise<Array<{ id: number; username: string; full_name: string | null; responsible_for?: string | null }>> {
    const params = departmentCode ? { department_code: departmentCode } : undefined
    const { data } = await api.get<Array<{ id: number; username: string; full_name: string | null; responsible_for?: string | null }>>('/ahead-plan/assignee-options', { params })
    return data
  },

  /** 某问题的回复列表 */
  async listIssueReplies(issueId: number): Promise<AheadPlanIssueReplyItem[]> {
    const { data } = await api.get<AheadPlanIssueReplyItem[]>(`/ahead-plan/issues/${issueId}/replies`)
    return data
  },

  async createIssueReply(issueId: number, payload: { content: string; reply_type?: string }): Promise<AheadPlanIssueReplyItem> {
    const { data } = await api.post<AheadPlanIssueReplyItem>(`/ahead-plan/issues/${issueId}/replies`, payload)
    return data
  },

  /** 我的全局问题列表（分页、tab 筛选、搜索） */
  async listMyIssues(params?: {
    tab?: 'urgent' | 'unsolved' | 'to_confirm' | 'closed'
    search?: string
    skip?: number
    limit?: number
  }): Promise<{ items: AheadPlanIssueItem[]; total: number }> {
    const { data } = await api.get<{ items: AheadPlanIssueItem[]; total: number }>('/ahead-plan/my-issues', {
      params: params as Record<string, unknown>,
    })
    return data
  },

  /** @我的：在回复中被提及的问题列表（分页、搜索；可选是否包含已关闭） */
  async listMyMentionedIssues(params?: {
    search?: string
    include_closed?: boolean
    skip?: number
    limit?: number
  }): Promise<{ items: AheadPlanIssueItem[]; total: number }> {
    const { data } = await api.get<{ items: AheadPlanIssueItem[]; total: number }>('/ahead-plan/my-mentioned-issues', {
      params: params as Record<string, unknown>,
    })
    return data
  },

  /** 各 Tab 的 badge 数量（@我的 含 mention_unclosed / mention_closed 区分） */
  async listMyIssuesCounts(): Promise<{
    mention: number
    mention_unclosed?: number
    mention_closed?: number
    urgent: number
    unsolved: number
    to_confirm: number
    closed: number
  }> {
    const { data } = await api.get('/ahead-plan/my-issues-counts')
    return data
  },

  /** @提及 用户选项：按 full_name、username 模糊搜索 */
  async listMentionUserOptions(search?: string): Promise<Array<{ id: number; username: string; full_name: string | null; responsible_for?: string | null }>> {
    const { data } = await api.get('/ahead-plan/mention-options', {
      params: { search: search || undefined, limit: 50 },
    })
    return data
  },

  /** 当前用户的问题通知（消息中心） */
  async listIssueNotifications(params?: { unread_only?: boolean; skip?: number; limit?: number }): Promise<AheadPlanIssueNotificationItem[]> {
    const { data } = await api.get<AheadPlanIssueNotificationItem[]>('/ahead-plan/notifications', { params })
    return data
  },

  async markIssueNotificationRead(notificationId: number): Promise<void> {
    await api.put(`/ahead-plan/notifications/${notificationId}/read`)
  },

  /** 好评弹幕（4星及以上），用于首页替换里程碑模块 */
  async getFeedbackMarquee(limit = 20): Promise<Array<{ id: number; user_name: string; label: string; message: string; confirmed_at: string }>> {
    const { data } = await api.get('/ahead-plan/feedback-marquee', { params: { limit } })
    return data
  },

  /** 协作好评排名：提问专家、好评如潮、特别好评 Top N；部门解决榜单独 dept_top_n */
  async getFeedbackRankings(topN = 5, deptTopN = 3): Promise<FeedbackRankings> {
    const { data } = await api.get('/ahead-plan/feedback-rankings', { params: { top_n: topN, dept_top_n: deptTopN } })
    return data
  },

  /** 我的反馈汇总（HMD）：责任人视角，scope=overall|department */
  async getResponsibleSummary(scope: 'overall' | 'department' = 'overall'): Promise<ResponsibleSummary> {
    const { data } = await api.get<ResponsibleSummary>('/ahead-plan/responsible-summary', { params: { scope } })
    return data
  },
}

export interface ResponsibleSummary {
  total: number
  r1: number
  r2: number
  r3: number
  r4: number
  r5: number
  good_rate_pct: number
  special_praise_count: number
  scope?: string
  good_rate_tiers?: Array<{ key: string; label: string; range: string; desc: string; pct: number }>
  user_tier?: string
  answer_count_rank?: { count: number; exceed_pct: number; total_users: number }
  my_imprint?: Array<{ issue_type: string; count: number }>
  improvement_tags?: Array<{ tag: string; count: number }>
}

export interface FeedbackRankings {
  special_praise: Array<{ display_name: string; count: number }>
  praise_4star: Array<{ display_name: string; count: number }>
  dept_solvers: Array<{ display_name: string; count: number }>
  ask_experts: Array<{ display_name: string; count: number }>
}

/** 协作反馈预设标签（3星及以下必填原因时可用） */
export const RATING_REASON_OPTIONS = ['响应慢', '推诿', '沟通不畅', '未解决', '其他'] as const

export interface AheadPlanIssueItem {
  id: number
  activity_id: string
  type_of_plan: string
  issue_type: string
  description: string
  raised_by: number
  raised_by_name?: string | null
  raised_at: string
  status: string
  logic_status: string
  responsible_user_id?: number | null
  responsible_user_name?: string | null
  priority: string
  resolving_department?: string | null
  raising_department?: string | null
  resolved_by?: number | null
  resolved_by_name?: string | null
  resolved_at?: string | null
  planned_resolve_at?: string | null
  days_until_resolve?: number | null
  rating?: number | null
  confirmed_at?: string | null
  confirmed_by?: number | null
  confirmed_by_name?: string | null
  solution?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface AheadPlanIssueReplyItem {
  id: number
  issue_id: number
  user_id: number
  user_name?: string | null
  content: string
  reply_type?: string | null
  created_at: string
}

export interface AheadPlanIssueNotificationItem {
  id: number
  user_id: number
  issue_id: number
  type: string
  read_at?: string | null
  created_at: string
  payload?: { activity_id?: string; type_of_plan?: string; title?: string; reply_preview?: string } | null
}

export interface AheadPlanIssueCreatePayload {
  activity_id: string
  type_of_plan: string
  issue_type: string
  description: string
  resolving_department?: string | null
  planned_resolve_at?: string | null
  status?: string
  responsible_user_id?: number | null
  priority?: string
}

export interface AheadPlanIssueUpdatePayload {
  issue_type?: string
  description?: string
  status?: string
  resolving_department?: string | null
  resolved_by?: number | null
  resolved_at?: string | null
  planned_resolve_at?: string | null
  responsible_user_id?: number | null
  priority?: string
}

export interface AheadPlanViewRow {
  activity_id: string
  resource_id: string
  bcc_kq_code?: string | null
  status?: string | null
  title?: string | null
  wbs_code?: string | null
  block?: string | null
  discipline?: string | null
  work_package?: string | null
  scope?: string | null
  implement_phase?: string | null
  project?: string | null
  subproject?: string | null
  train?: string | null
  unit?: string | null
  main_block?: string | null
  quarter?: string | null
  start_up_sequence?: string | null
  contract_phase?: string | null
  key_qty?: number | null
  uom?: string | null
  calculated_mhrs?: number | null
  weight_factor?: number | null
  actual_weight_factor?: number | null
  start_date?: string | null
  finish_date?: string | null
  baseline1_start_date?: string | null
  baseline1_finish_date?: string | null
  planned_duration?: number | null
  actual_start_date?: string | null
  actual_finish_date?: string | null
  actual_duration?: number | null
  completed?: number | null
  actual_manhour?: number | null
  remaining_qty?: number | null
  user_defined_activity_name?: string | null
  remarks?: string | null
  issue_summary?: {
    total_count: number
    pending_count: number
    overdue_count: number
    all_resolved: boolean
  }
  comments?: string | null
  commented_by?: string | null
  reviewed_at?: string | null
  reviewed_by?: string | null
  approved_at?: string | null
  approved_by?: string | null
  weekly: Record<string, string>
  weekly_ids: Record<string, number>
  total_planned_units: string
}

export interface AheadPlanViewResponse {
  items: AheadPlanViewRow[]
  thursdays: string[]
  total: number
}

export interface AheadPlanSummaryItem {
  group_name: string
  description?: string | null
  activity_count: number
  total_planned_units: number
  weekly: Record<string, number>
  /** 每周期实际完成（compare_actual=true 时返回），date_str -> sum achieved */
  weekly_actual?: Record<string, number> | null
  count_reviewed: number
  count_approved: number
  /** HMD 问题解决状态计数 */
  issue_count_pending?: number
  issue_count_in_progress?: number
  issue_count_resolved?: number
  issue_count_overdue?: number
  sort_id?: number
  key_qty?: number
  completed?: number
  remaining_qty?: number
}

export interface AheadPlanSummaryResponse {
  items: AheadPlanSummaryItem[]
  thursdays: string[]
}

export interface IssueDimensionStatsItem {
  dimension_value: string | number
  dimension_label: string
  pending: number
  in_progress: number
  resolved: number
  overdue: number
  total: number
}

export interface IssueDimensionStatsResponse {
  items: IssueDimensionStatsItem[]
}
