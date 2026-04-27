"""
用户账户数据模型
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Table
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime, timezone
from app.utils.timezone import now as system_now
import bcrypt


# 用户-角色关联表（多对多）
user_role_table = Table(
    'user_roles',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
    Column('role_id', Integer, ForeignKey('roles.id', ondelete='CASCADE'), primary_key=True)
)


class User(Base):
    """用户账户表"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True, nullable=False, comment="用户名")
    email = Column(String(255), unique=True, index=True, nullable=True, comment="邮箱")
    hashed_password = Column(String(255), nullable=False, comment="加密后的密码")
    full_name = Column(String(100), nullable=True, comment="全名")
    is_active = Column(Boolean, default=True, comment="是否激活")
    is_superuser = Column(Boolean, default=False, comment="是否超级管理员")
    created_at = Column(DateTime, default=system_now, comment="创建时间")
    updated_at = Column(DateTime, default=system_now, onupdate=system_now, comment="更新时间")
    last_login = Column(DateTime, nullable=True, comment="最后登录时间")
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True, index=True, comment="所属部门")
    responsible_for = Column(String(200), nullable=True, comment="负责内容（供选责任人时参考，如：采购对接、设计审批）")

    # 关系
    department = relationship("Department", foreign_keys=[department_id], lazy="selectin")
    roles = relationship("Role", secondary=user_role_table, back_populates="users", lazy="selectin")
    permissions = relationship("UserPermission", back_populates="user", cascade="all, delete-orphan", lazy="dynamic")
    
    def set_password(self, password: str):
        """设置密码（加密）"""
        self.hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    def check_password(self, password: str) -> bool:
        """验证密码"""
        return bcrypt.checkpw(password.encode('utf-8'), self.hashed_password.encode('utf-8'))


class Role(Base):
    """角色表"""
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False, comment="角色名称")
    description = Column(Text, nullable=True, comment="角色描述")
    is_active = Column(Boolean, default=True, comment="是否激活")
    created_at = Column(DateTime, default=system_now, comment="创建时间")
    updated_at = Column(DateTime, default=system_now, onupdate=system_now, comment="更新时间")
    
    # 关系
    users = relationship("User", secondary=user_role_table, back_populates="roles", lazy="dynamic")
    permissions = relationship("RolePermission", back_populates="role", cascade="all, delete-orphan", lazy="dynamic")


class Permission(Base):
    """权限定义表"""
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(100), unique=True, index=True, nullable=False, comment="权限代码（如：report:read, volume:write）")
    name = Column(String(100), nullable=False, comment="权限名称")
    description = Column(Text, nullable=True, comment="权限描述")
    resource_type = Column(String(50), nullable=False, comment="资源类型（report, volume, project, p6_resource等）")
    action = Column(String(50), nullable=False, comment="操作类型（read, write, delete, create）")
    
    # 权限范围限制（可选）
    # 如果这些字段为空，表示拥有该权限的所有范围
    scope = Column(String(100), nullable=True, index=True, comment="GCC_Scope范围限制")
    project = Column(String(100), nullable=True, index=True, comment="项目范围限制")
    subproject = Column(String(100), nullable=True, index=True, comment="子项目范围限制")
    block = Column(String(100), nullable=True, index=True, comment="区块范围限制")
    work_package = Column(String(100), nullable=True, index=True, comment="工作包范围限制（来自rsc_defines.work_package）")
    
    created_at = Column(DateTime, default=system_now, comment="创建时间")
    
    # 关系
    user_permissions = relationship("UserPermission", back_populates="permission", cascade="all, delete-orphan", lazy="dynamic")
    role_permissions = relationship("RolePermission", back_populates="permission", cascade="all, delete-orphan", lazy="dynamic")


class UserPermission(Base):
    """用户权限表（支持范围限制）"""
    __tablename__ = "user_permissions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete='CASCADE'), nullable=False, index=True)
    permission_id = Column(Integer, ForeignKey("permissions.id", ondelete='CASCADE'), nullable=False, index=True)
    
    # 权限范围限制（可选）
    # 如果这些字段为空，表示拥有该权限的所有范围
    scope = Column(String(100), nullable=True, index=True, comment="GCC_Scope范围限制")
    project = Column(String(100), nullable=True, index=True, comment="项目范围限制")
    subproject = Column(String(100), nullable=True, index=True, comment="子项目范围限制")
    block = Column(String(100), nullable=True, index=True, comment="区块范围限制")
    train = Column(String(100), nullable=True, index=True, comment="Train范围限制")
    unit = Column(String(100), nullable=True, index=True, comment="Unit范围限制")
    main_block = Column(String(100), nullable=True, index=True, comment="Main_Block范围限制")
    quarter = Column(String(100), nullable=True, index=True, comment="Quarter范围限制")
    simple_block = Column(String(100), nullable=True, index=True, comment="Simple_Block范围限制")
    discipline = Column(String(100), nullable=True, index=True, comment="专业范围限制")
    work_package = Column(String(100), nullable=True, index=True, comment="工作包范围限制")
    resource_id = Column(String(100), nullable=True, index=True, comment="资源ID范围限制（来自rsc_defines）")
    
    created_at = Column(DateTime, default=system_now, comment="创建时间")
    
    # 关系
    user = relationship("User", back_populates="permissions", lazy="selectin")
    permission = relationship("Permission", back_populates="user_permissions", lazy="selectin")


class RolePermission(Base):
    """角色权限表（支持范围限制）"""
    __tablename__ = "role_permissions"

    id = Column(Integer, primary_key=True, index=True)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete='CASCADE'), nullable=False, index=True)
    permission_id = Column(Integer, ForeignKey("permissions.id", ondelete='CASCADE'), nullable=False, index=True)
    
    # 权限范围限制（可选）
    scope = Column(String(100), nullable=True, index=True, comment="GCC_Scope范围限制")
    project = Column(String(100), nullable=True, index=True, comment="项目范围限制")
    subproject = Column(String(100), nullable=True, index=True, comment="子项目范围限制")
    block = Column(String(100), nullable=True, index=True, comment="区块范围限制")
    train = Column(String(100), nullable=True, index=True, comment="Train范围限制")
    unit = Column(String(100), nullable=True, index=True, comment="Unit范围限制")
    main_block = Column(String(100), nullable=True, index=True, comment="Main_Block范围限制")
    quarter = Column(String(100), nullable=True, index=True, comment="Quarter范围限制")
    simple_block = Column(String(100), nullable=True, index=True, comment="Simple_Block范围限制")
    discipline = Column(String(100), nullable=True, index=True, comment="专业范围限制")
    work_package = Column(String(100), nullable=True, index=True, comment="工作包范围限制（来自rsc_defines.work_package，resource_id的最小单元，可通过rsc_defines表映射到resource_id）")
    
    created_at = Column(DateTime, default=system_now, comment="创建时间")
    
    # 关系
    role = relationship("Role", back_populates="permissions", lazy="selectin")
    permission = relationship("Permission", back_populates="role_permissions", lazy="selectin")
