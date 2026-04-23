"""
FastAPI依赖项 - 认证和权限检查
"""
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import get_db, current_role_context
from app.services.auth_service import decode_access_token, get_user_by_id
from app.models.user import User
from app.services.permission_service import PermissionService, PermissionScope

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/auth/login",
    auto_error=False  # 不自动抛出错误，让我们自己处理
)


async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme)
) -> User:
    """获取当前登录用户"""
    import logging
    logger = logging.getLogger(__name__)
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无法验证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not token:
        raise credentials_exception
    
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    
    # JWT标准中sub是字符串，需要转换为整数
    user_id_str = payload.get("sub")
    if user_id_str is None:
        raise credentials_exception
    
    try:
        user_id = int(user_id_str)
    except (ValueError, TypeError):
        raise credentials_exception
    
    # 获取用户需要使用默认连接（因为此时还没有角色上下文）
    # 使用临时的默认数据库连接
    from app.database import DefaultSessionLocal
    db = DefaultSessionLocal()
    try:
        user = get_user_by_id(db, user_id)
    finally:
        db.close()
    
    if user is None:
        raise credentials_exception
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="用户已被禁用"
        )
    
    # 设置当前用户的角色到上下文
    if user.roles:
        primary_role = user.roles[0].name if user.roles else None
        if primary_role:
            current_role_context.set(primary_role)
    
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """获取当前活跃用户"""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="用户已被禁用"
        )
    return current_user


async def get_current_system_admin(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """获取当前系统管理员 (仅限 role_system_admin)"""
    if current_user.username != "role_system_admin" and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有系统管理员(role_system_admin)可以执行此操作"
        )
    return current_user


def require_permission(
    permission_code: str,
    scope: Optional[PermissionScope] = None
):
    """
    权限检查依赖
    
    Usage:
        @router.get("/items")
        def get_items(
            current_user: User = Depends(require_permission("daily_report:read"))
        ):
            ...
    """
    async def permission_checker(
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db)
    ) -> User:
        has_permission = PermissionService.check_permission(
            db, current_user, permission_code, scope
        )
        
        if not has_permission:
            # 仅在权限拒绝时记录一条警告
            import logging
            logging.getLogger(__name__).warning(f"Permission denied: {current_user.username} -> {permission_code}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"没有权限: {permission_code}"
            )
        return current_user
    
    return permission_checker
