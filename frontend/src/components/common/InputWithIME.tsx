import React, { useCallback, useState, useEffect, useRef } from 'react'
import { Input } from 'antd'
import type { InputProps } from 'antd'

const { TextArea } = Input

/**
 * 支持中文等 IME 输入的 Input 组件。
 * 内部维护 internalValue 以防止父组件在 composition 期间 re-render 导致输入中断或清空。
 */
export const InputWithIME: React.FC<InputProps> = ({ value, onChange, ...rest }) => {
  const [internalValue, setInternalValue] = useState(value)
  const isComposing = useRef(false)

  useEffect(() => {
    if (!isComposing.current) {
      setInternalValue(value)
    }
  }, [value])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInternalValue(e.target.value)
      if (!isComposing.current) {
        onChange?.(e)
      }
    },
    [onChange]
  )

  const handleCompositionStart = useCallback(() => {
    isComposing.current = true
  }, [])

  const handleCompositionEnd = useCallback(
    (e: React.CompositionEvent<HTMLInputElement>) => {
      isComposing.current = false
      // 触发一次最终的 onChange
      onChange?.({ target: { value: e.currentTarget.value } } as React.ChangeEvent<HTMLInputElement>)
    },
    [onChange]
  )

  return (
    <Input
      {...rest}
      value={internalValue}
      onChange={handleChange}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
    />
  )
}

/**
 * 支持中文等 IME 输入的 TextArea 组件。
 */
export const TextAreaWithIME: React.FC<React.ComponentProps<typeof Input.TextArea>> = ({ value, onChange, ...rest }) => {
  const [internalValue, setInternalValue] = useState(value)
  const isComposing = useRef(false)

  useEffect(() => {
    if (!isComposing.current) {
      setInternalValue(value)
    }
  }, [value])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInternalValue(e.target.value)
      if (!isComposing.current) {
        onChange?.(e)
      }
    },
    [onChange]
  )

  const handleCompositionStart = useCallback(() => {
    isComposing.current = true
  }, [])

  const handleCompositionEnd = useCallback(
    (e: React.CompositionEvent<HTMLTextAreaElement>) => {
      isComposing.current = false
      onChange?.({ target: { value: e.currentTarget.value } } as React.ChangeEvent<HTMLTextAreaElement>)
    },
    [onChange]
  )

  return (
    <TextArea
      {...rest}
      value={internalValue}
      onChange={handleChange}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
    />
  )
}
