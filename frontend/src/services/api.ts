import axios, { AxiosError } from 'axios'
import { tokenService } from './authService'
import { logger } from '../utils/logger'

// 自动检测API基础URL
// 安全策略：统一使用相对路径，确保API请求使用与页面相同的协议（HTTP/HTTPS）
// 这样如果页面是HTTPS，API请求也会自动使用HTTPS，避免明文传输登录凭据
function getApiBaseURL(): string {
  // 如果设置了环境变量，优先使用
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL
  }
  
  // 开发模式：检测是否从网络访问且需要直接连接后端
  if (import.meta.env.DEV) {
    const hostname = window.location.hostname
    
    // 如果不是 localhost 或 127.0.0.1，说明是从网络访问
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      // 如果页面是HTTPS，必须使用HTTPS API（通过Nginx代理）
      // 如果页面是HTTP，也应该使用相对路径，让Nginx重定向到HTTPS
      // 统一使用相对路径，确保安全
      return '/api'
    }
  }
  
  // 默认使用相对路径（通过Vite代理或nginx代理）
  // 相对路径会自动使用当前页面的协议，确保HTTPS页面使用HTTPS API
  // 这是最安全的方案，避免明文传输登录凭据
  return '/api'
}

const api = axios.create({
  baseURL: getApiBaseURL(),
  timeout: 120000, // 120秒超时，对于大量数据查询应该足够
  headers: {
    'Content-Type': 'application/json',
  },
  maxRedirects: 5, // 允许最多5次重定向
  validateStatus: (status) => {
    // 允许307重定向
    return status >= 200 && status < 400
  },
})

// 请求拦截器：添加token
api.interceptors.request.use(
  (config) => {
    const token = tokenService.getToken()
    if (token) {
      const cleanToken = token.trim()
      config.headers.Authorization = `Bearer ${cleanToken}`
    }
    // 如果请求数据是URLSearchParams，确保Content-Type正确
    if (config.data instanceof URLSearchParams) {
      config.headers['Content-Type'] = 'application/x-www-form-urlencoded'
    }
    // FormData 上传时删除 Content-Type，让浏览器自动添加 multipart/form-data; boundary=xxx
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type']
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器：处理401错误和404错误
api.interceptors.response.use(
  (response) => {
    return response
  },
  (error: AxiosError) => {
    const status = error.response?.status
    const url = error.config?.url || ''
    
    // 静默处理404错误（特别是activity-code-description接口）
    if (status === 404 && url.includes('/activity-code-description')) {
      // 404是正常的（可能没有对应的activity_code），完全静默处理
      // 返回一个空对象，而不是reject，避免触发错误处理
      return Promise.resolve({ data: { description: null } })
    }
    
    if (status === 401) {
      const method = error.config?.method?.toUpperCase() || ''
      
      // 如果是登录接口返回401，不要清除token（可能是密码错误）
      if (url.includes('/auth/login')) {
        return Promise.reject(error)
      }
      
      // Token过期或无效，清除token并跳转到登录页
      logger.error('API 401错误:', method, url, error.response?.data)
      
      tokenService.removeToken()
      // 只在非登录页面时跳转，避免循环重定向
      if (window.location.pathname !== '/login' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api

