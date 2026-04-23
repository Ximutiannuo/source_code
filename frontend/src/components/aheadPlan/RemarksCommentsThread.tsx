import React, { useState, useCallback } from 'react'
import { Button, Space } from 'antd'
import { SendOutlined } from '@ant-design/icons'
import { TextAreaWithIME } from '../common/InputWithIME'
import { parseRemarksJson, addMessage, stringifyRemarksJson, type RemarksMessage } from '../../utils/remarksJson'
import dayjs from 'dayjs'

interface RemarksCommentsThreadProps {
  rawValue: string | null | undefined
  onSave: (jsonStr: string) => Promise<void>
  placeholder?: string
  maxHeight?: number
  currentUser?: { username: string; full_name?: string } | null
}

export const RemarksCommentsThread: React.FC<RemarksCommentsThreadProps> = ({
  rawValue,
  onSave,
  placeholder = '输入新消息…',
  maxHeight = 300,
  currentUser,
}) => {
  const data = parseRemarksJson(rawValue)
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  // 自动滚动到底部
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [data.thread.length])

  const userName = currentUser?.full_name || currentUser?.username || '未知'

  const handleSend = useCallback(async () => {
    const content = input.trim()
    if (!content) return
    const next = addMessage(data, {
      user: userName,
      userId: currentUser?.username,
      content,
    })
    
    setSaving(true)
    try {
      const str = stringifyRemarksJson(next)
      await onSave(str)
      setInput('')
    } catch (_) {
    } finally {
      setSaving(false)
    }
  }, [input, data, userName, currentUser?.username, onSave])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 320 }}>
      <div
        ref={scrollRef}
        style={{
          maxHeight: maxHeight,
          overflowY: 'auto',
          padding: '4px 2px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          fontSize: 11,
        }}
      >
        {data.thread.length === 0 ? (
          <div style={{ color: '#999', textAlign: 'center', padding: '4px 0', fontSize: 10 }}>暂无消息</div>
        ) : (
          data.thread.map((m: RemarksMessage) => {
            const isMe = currentUser && (m.userId === currentUser.username)
            return (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isMe ? 'flex-end' : 'flex-start',
                  width: '100%',
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  gap: 8, 
                  marginBottom: 2, 
                  fontSize: 10, 
                  color: '#8c8c8c',
                  flexDirection: isMe ? 'row-reverse' : 'row'
                }}>
                  <span style={{ fontWeight: 600 }}>{m.user}</span>
                  <span>{dayjs(m.createdAt).format('MM-DD HH:mm')}</span>
                </div>
                <div
                  style={{
                    maxWidth: '90%',
                    padding: '6px 10px',
                    background: isMe ? '#95ec69' : '#ffffff',
                    borderRadius: 4,
                    position: 'relative',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    color: '#000',
                    lineHeight: 1.4,
                    border: isMe ? 'none' : '1px solid #e8e8e8'
                  }}
                >
                  {/* 小箭头 */}
                  <div style={{
                    position: 'absolute',
                    top: 8,
                    [isMe ? 'right' : 'left']: -6,
                    width: 0,
                    height: 0,
                    borderTop: '6px solid transparent',
                    borderBottom: '6px solid transparent',
                    [isMe ? 'borderLeft' : 'borderRight']: `6px solid ${isMe ? '#95ec69' : '#ffffff'}`,
                    zIndex: 1
                  }} />
                  {!isMe && (
                    <div style={{
                      position: 'absolute',
                      top: 8,
                      left: -7,
                      width: 0,
                      height: 0,
                      borderTop: '6px solid transparent',
                      borderBottom: '6px solid transparent',
                      borderRight: '6px solid #e8e8e8',
                      zIndex: 0
                    }} />
                  )}
                  {m.content}
                </div>
              </div>
            )
          })
        )}
      </div>
      <Space.Compact style={{ width: '100%' }}>
        <TextAreaWithIME
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder={placeholder}
          autoSize={{ minRows: 1, maxRows: 3 }}
          style={{ 
            fontSize: 11, 
            resize: 'none',
            borderRadius: '4px 0 0 4px',
            borderRight: 'none'
          }}
        />
        <Button
          type="primary"
          size="small"
          icon={<SendOutlined />}
          onClick={handleSend}
          loading={saving}
          style={{ height: 'auto' }}
        />
      </Space.Compact>
    </div>
  )
}
