import { useRef, useCallback, useEffect } from 'react'

/**
 * 防抖回调：在 delay 毫秒内无新调用时才执行最后一次
 */
export function useDebouncedCallback<T extends (...args: any[]) => void>(
  fn: T,
  delay: number
): T {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        fnRef.current(...args)
      }, delay)
    }) as T,
    [delay]
  )
}
