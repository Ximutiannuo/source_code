import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authService, tokenService, User } from '../services/authService'
import { App } from 'antd'
import { logger } from '../utils/logger'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const { message } = App.useApp()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // 初始化时检查token并获取用户信息
  useEffect(() => {
    const initAuth = async () => {
      const token = tokenService.getToken()
      if (token) {
        try {
          const userData = await authService.getCurrentUser()
          logger.log('AuthContext - 获取用户信息成功:', userData)
          setUser(userData)
        } catch (error: any) {
          logger.error('AuthContext - 获取用户信息失败:', error)
          // Token无效或网络错误，清除token
          authService.logout()
        }
      }
      // 无论成功或失败，都要设置loading为false
      setLoading(false)
    }

    initAuth()
  }, [])

  const login = async (username: string, password: string) => {
    try {
      // 登录并获取token
      await authService.login({ username, password })
      // 立即获取用户信息（token已保存，无需延迟）
      const userData = await authService.getCurrentUser()
      logger.log('AuthContext - 登录后获取用户信息成功')
      setUser(userData)
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || '登录失败'
      message.error(errorMessage)
      throw error
    }
  }

  const logout = () => {
    authService.logout()
    setUser(null)
  }

  const refreshUser = async () => {
    try {
      const userData = await authService.getCurrentUser()
      setUser(userData)
    } catch (error) {
      // 获取用户信息失败，可能token已过期
      authService.logout()
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        refreshUser,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
