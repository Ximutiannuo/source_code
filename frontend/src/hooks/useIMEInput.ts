import { useRef, useCallback } from 'react'

/**
 * 支持中文等 IME 输入的受控输入 props。
 * 在 IME 组合输入过程中不更新 state，避免出现 "ccece'hsi测试" 之类的乱码。
 */
export function useIMEInput<T extends HTMLInputElement | HTMLTextAreaElement>(
  value: string,
  onChange: (value: string) => void
) {
  const composingRef = useRef(false)

  return {
    value,
    onCompositionStart: useCallback(() => {
      composingRef.current = true
    }, []),
    onCompositionEnd: useCallback(
      (e: React.CompositionEvent<T>) => {
        composingRef.current = false
        onChange((e.target as HTMLInputElement).value)
      },
      [onChange]
    ),
    onChange: useCallback(
      (e: React.ChangeEvent<T>) => {
        if (!composingRef.current) {
          onChange((e.target as HTMLInputElement).value)
        }
      },
      [onChange]
    ),
  }
}
