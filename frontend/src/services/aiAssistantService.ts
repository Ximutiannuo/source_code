import api from './api'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatResponse {
  reply: string
  remaining: number
  log_id?: number
  /** 本轮后的完整历史，供下次请求传入（对话模式上下文） */
  history?: ChatMessage[]
}

export interface UsageResponse {
  used: number
  limit: number
  remaining: number
}

export interface QueryLogItem {
  id: number
  question: string
  reply: string
  feedback: string | null
  created_at: string | null
}

export interface QueryLogResponse {
  total: number
  page: number
  page_size: number
  items: QueryLogItem[]
}

export const aiAssistantService = {
  /**
   * 发送消息，支持对话模式（传入 history 可让 AI 理解上下文，如「再查一下上周的」等追问）
   * 超时 5 分钟：AI 聊天涉及 DeepSeek + 多轮 Function Calling + ahead_plan 复杂查询，避免 504
   */
  chat(message: string, history?: ChatMessage[]): Promise<ChatResponse> {
    return api
      .post('/ai-assistant/chat', { message, history: history ?? undefined }, { timeout: 300000 })
      .then((r) => r.data)
  },
  getUsage(): Promise<UsageResponse> {
    return api.get('/ai-assistant/usage').then((r) => r.data)
  },
  submitFeedback(logId: number, feedback: 'like' | 'dislike'): Promise<void> {
    return api.post('/ai-assistant/feedback', { log_id: logId, feedback }).then(() => {})
  },
  /** 获取当前用户 AI 提问历史记录（分页） */
  getQueryLog(params?: { page?: number; page_size?: number; days?: number }): Promise<QueryLogResponse> {
    return api.get('/ai-assistant/query-log', { params }).then((r) => r.data)
  },
}
