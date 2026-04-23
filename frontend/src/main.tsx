import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5分钟内数据视为新鲜
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        locale={zhCN}
        theme={{
          token: {
            colorPrimary: '#3b82f6',
            borderRadius: 12,
            borderRadiusLG: 16,
            borderRadiusSM: 8,
            fontFamily:
              'Inter, Noto Sans SC, -apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, Helvetica Neue, Arial, sans-serif',
            colorBgContainer: '#ffffff',
            colorBorder: '#e2e8f0',
            colorText: '#1e293b',
            colorTextSecondary: '#64748b',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            boxShadowSecondary: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          },
          components: {
            Menu: {
              itemSelectedBg: 'rgba(255, 255, 255, 0.15)',
              itemHoverBg: 'rgba(255, 255, 255, 0.1)',
              itemSelectedColor: '#ffffff',
              itemHoverColor: '#ffffff',
              itemColor: '#ffffff',
              borderRadius: 8,
            },
            Card: {
              borderRadius: 12,
              paddingLG: 24,
            },
            Button: {
              borderRadius: 8,
              fontWeight: 500,
            },
            Input: {
              borderRadius: 8,
            },
            Select: {
              borderRadius: 8,
            },
            Table: {
              borderRadius: 8,
            },
            Modal: {
              borderRadius: 16,
            },
            Tabs: {
              borderRadius: 8,
            },
          },
        }}
      >
        <App />
      </ConfigProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)

