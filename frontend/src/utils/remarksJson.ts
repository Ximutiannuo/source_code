/**
 * 备注/意见 JSON 格式（即时通讯风格）
 * 存储格式：{ "thread": [{ "id", "user", "userId", "content", "createdAt", "replyTo" }] }
 */
export interface RemarksMessage {
  id: string
  user: string
  userId?: string
  content: string
  createdAt: string // ISO
  replyTo?: string | null // 回复的 msg id
}

export interface RemarksThreadJson {
  thread: RemarksMessage[]
}

const THREAD_VERSION = 1

/** 解析 remarks/comments 字符串为结构化数据，兼容旧格式（纯文本） */
export function parseRemarksJson(raw: string | null | undefined): RemarksThreadJson {
  if (!raw || typeof raw !== 'string') return { thread: [] }
  const trimmed = raw.trim()
  if (!trimmed) return { thread: [] }
  try {
    const parsed = JSON.parse(trimmed)
    if (parsed && Array.isArray(parsed.thread)) {
      return parsed
    }
  } catch (_) {}
  // 旧格式：纯文本视为一条消息
  return {
    thread: [
      {
        id: `legacy_${Date.now()}`,
        user: '未知',
        content: trimmed,
        createdAt: new Date().toISOString(),
      },
    ],
  }
}

/** 将结构化数据序列化为 JSON 字符串 */
export function stringifyRemarksJson(data: RemarksThreadJson): string {
  return JSON.stringify({ ...data, version: THREAD_VERSION })
}

/** 添加一条新消息 */
export function addMessage(
  data: RemarksThreadJson,
  msg: { user: string; userId?: string; content: string; replyTo?: string | null }
): RemarksThreadJson {
  const newMsg: RemarksMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    user: msg.user,
    userId: msg.userId,
    content: msg.content.trim(),
    createdAt: new Date().toISOString(),
    replyTo: msg.replyTo ?? null,
  }
  return {
    thread: [...data.thread, newMsg],
  }
}
