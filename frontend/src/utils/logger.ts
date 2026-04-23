/**
 * 日志工具
 * 开发环境：输出所有日志
 * 生产环境：只输出错误日志
 */

const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development'

export const logger = {
  log: (...args: any[]) => {
    if (isDev) {
      console.log(...args)
    }
  },
  
  error: (...args: any[]) => {
    // 错误始终记录（生产环境也需要）
    console.error(...args)
  },
  
  warn: (...args: any[]) => {
    if (isDev) {
      console.warn(...args)
    }
  },
  
  debug: (...args: any[]) => {
    if (isDev) {
      console.debug(...args)
    }
  },
  
  info: (...args: any[]) => {
    if (isDev) {
      console.info(...args)
    }
  }
}
