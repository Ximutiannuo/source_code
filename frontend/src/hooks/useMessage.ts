import { App } from 'antd'

/**
 * 使用Ant Design的message hook
 * 替代静态message函数，支持动态主题
 */
export const useMessage = () => {
  const { message } = App.useApp()
  return message
}
