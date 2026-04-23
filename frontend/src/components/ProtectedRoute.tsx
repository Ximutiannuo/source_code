import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Spin } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { permissionService } from '../services/permissionService'
import { logger } from '../utils/logger'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireSuperuser?: boolean
  requirePermission?: {
    resourceType: string
    action: string
  }
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireSuperuser = false,
  requirePermission,
}) => {
  const { isAuthenticated, user, loading } = useAuth()

  // 获取用户权限（如果需要权限检查）
  const { data: userPermissions, isLoading: permissionsLoading } = useQuery({
    queryKey: ['user-permissions', user?.id],
    queryFn: () => permissionService.getUserPermissions(user!.id),
    enabled: !!user && !!user.id && !!requirePermission,
    retry: false,
  })

  // 调试信息（仅开发环境）
  React.useEffect(() => {
    if (requireSuperuser) {
      logger.log('ProtectedRoute - requireSuperuser:', requireSuperuser)
      logger.log('ProtectedRoute - user:', user)
      logger.log('ProtectedRoute - isAuthenticated:', isAuthenticated)
    }
    if (requirePermission) {
      logger.log('ProtectedRoute - requirePermission:', requirePermission)
      logger.log('ProtectedRoute - userPermissions:', userPermissions)
    }
  }, [requireSuperuser, requirePermission, user, isAuthenticated, userPermissions])

  if (loading || (requirePermission && permissionsLoading)) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <Spin size="large" />
      </div>
    )
  }

  // 如果未登录，重定向到登录页
  if (!isAuthenticated || !user) {
    logger.warn('ProtectedRoute - 用户未登录，重定向到登录页')
    return <Navigate to="/login" replace />
  }

  // 如果需要超级管理员权限但用户不是超级管理员，重定向到首页
  if (requireSuperuser && !user.is_superuser) {
    logger.warn('ProtectedRoute - 用户不是超级管理员，重定向到首页')
    return <Navigate to="/" replace />
  }

  // 如果需要特定权限，检查用户是否有该权限
  if (requirePermission && userPermissions) {
    const hasPermission = user.is_superuser || 
      userPermissions.permissions.some(
        p => p.resource_type === requirePermission.resourceType && 
             p.action === requirePermission.action
      )
    
    if (!hasPermission) {
      logger.warn(`ProtectedRoute - 用户没有权限: ${requirePermission.resourceType}:${requirePermission.action}，重定向到首页`)
      return <Navigate to="/" replace />
    }
  }

  return <>{children}</>
}

export default ProtectedRoute
