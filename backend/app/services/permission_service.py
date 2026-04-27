"""
权限检查服务
"""
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from app.models.user import User, Permission, UserPermission, RolePermission, Role, user_role_table


class PermissionScope:
    """权限范围"""
    def __init__(
        self,
        scope: Optional[str] = None,
        project: Optional[str] = None,
        subproject: Optional[str] = None,
        block: Optional[str] = None,
        train: Optional[str] = None,
        unit: Optional[str] = None,
        main_block: Optional[str] = None,
        quarter: Optional[str] = None,
        simple_block: Optional[str] = None,
        facility_id: Optional[int] = None,
        discipline: Optional[str] = None,
        work_package: Optional[str] = None,
        resource_id: Optional[str] = None
    ):
        self.scope = scope
        self.project = project
        self.subproject = subproject
        self.block = block
        self.train = train
        self.unit = unit
        self.main_block = main_block
        self.quarter = quarter
        self.simple_block = simple_block
        self.facility_id = facility_id
        self.discipline = discipline
        self.work_package = work_package  # 来自rsc_defines.work_package，颗粒度比resource_id更细
        self.resource_id = resource_id  # 来自rsc_defines.resource_id
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "scope": self.scope,
            "project": self.project,
            "subproject": self.subproject,
            "block": self.block,
            "train": self.train,
            "unit": self.unit,
            "main_block": self.main_block,
            "quarter": self.quarter,
            "simple_block": self.simple_block,
            "facility_id": self.facility_id,
            "discipline": self.discipline,
            "work_package": self.work_package,
            "resource_id": self.resource_id
        }


class PermissionService:
    """权限服务"""
    
    # 权限代码映射表：将API使用的权限代码映射到实际的权限代码
    # 格式：{api_permission_code: [actual_permission_codes]}
    PERMISSION_MAPPING = {
        # 作业/活动相关权限
        'activity:read': ['planning:read'],
        'activity:create': ['planning:create'],
        'activity:update': ['planning:update'],
        'activity:delete': ['planning:delete'],
        
        # 日报相关权限映射已移除
        # 现在直接使用 daily_report:* 权限，不再需要 report:* 映射
        
        # 工程量相关权限 - 不再使用通用映射，各类型分开管理
        # 注意：如果API需要使用通用volume权限，需要明确指定具体的权限类型
        
        # P6资源权限映射（兼容p6_resource和p6_database）
        'p6_resource:read': ['p6_database:read'],
        'p6_resource:update': ['p6_database:update'],
    }
    
    @staticmethod
    def _get_mapped_permission_codes(permission_code: str) -> list:
        """
        获取权限代码的所有可能映射
        
        Args:
            permission_code: 权限代码
        
        Returns:
            list: 可能的权限代码列表（包括原始代码和映射的代码）
        """
        mapped_codes = [permission_code]  # 首先尝试原始代码
        
        # 如果存在映射，添加映射的代码
        if permission_code in PermissionService.PERMISSION_MAPPING:
            mapped_codes.extend(PermissionService.PERMISSION_MAPPING[permission_code])
        
        return mapped_codes
    
    @staticmethod
    def check_permission(
        db: Session,
        user: User,
        permission_code: str,
        scope: Optional[PermissionScope] = None
    ) -> bool:
        """
        检查用户是否有指定权限
        
        Args:
            db: 数据库会话
            user: 用户对象
            permission_code: 权限代码（如：report:read, volume:write）
            scope: 权限范围（可选）
        
        Returns:
            bool: 是否有权限
        """
        # 超级管理员自动拥有所有权限
        if user.is_superuser:
            return True
        
        # 获取所有可能的权限代码（包括映射的）
        permission_codes = PermissionService._get_mapped_permission_codes(permission_code)
        
        # 尝试每个权限代码，只要有一个匹配就返回True
        for code in permission_codes:
            # 获取权限对象
            permission = db.query(Permission).filter(Permission.code == code).first()
            if not permission:
                continue
            
            # 检查用户直接权限
            user_permissions = db.query(UserPermission).filter(
                UserPermission.user_id == user.id,
                UserPermission.permission_id == permission.id
            )
            
            # 如果有范围限制，检查范围匹配（包括层级关系）
            if scope:
                # 获取所有用户权限记录，然后逐个检查（因为需要支持层级关系）
                all_user_perms = user_permissions.all()
                for up in all_user_perms:
                    if PermissionService._check_scope_match(db, up, scope):
                        return True
            else:
                # 没有范围限制，检查是否有任何权限（全范围权限或特定范围权限都可以）
                # 只要用户有这个权限，不管是什么范围，都返回 True
                if user_permissions.first():
                    return True
            
            # 检查角色权限
            for role in user.roles:
                if not role.is_active:
                    continue
                
                role_permissions = db.query(RolePermission).filter(
                    RolePermission.role_id == role.id,
                    RolePermission.permission_id == permission.id
                )
                
                # 如果有范围限制，检查范围匹配（包括层级关系）
                if scope:
                    all_role_perms = role_permissions.all()
                    for rp in all_role_perms:
                        if PermissionService._check_scope_match(db, rp, scope):
                            return True
                else:
                    # 没有范围限制，检查是否有任何权限（全范围权限或特定范围权限都可以）
                    # 只要用户有这个权限，不管是什么范围，都返回 True
                    if role_permissions.first():
                        return True
        
        return False
    
    @staticmethod
    def _check_scope_match(db: Session, perm, scope: PermissionScope) -> bool:
        """
        检查权限记录是否匹配数据范围（支持层级关系）
        
        Args:
            db: 数据库会话
            perm: UserPermission或RolePermission对象
            scope: 数据记录的权限范围
        
        Returns:
            bool: 是否匹配
        """
        # 检查是否为全范围权限
        # 注意：不需要检查 resource_id，因为 work_package 是 resource_id 的最小单元
        if (perm.scope is None and perm.project is None and perm.subproject is None and
            perm.block is None and perm.train is None and perm.unit is None and
            perm.main_block is None and perm.quarter is None and perm.simple_block is None and
            perm.facility_id is None and perm.discipline is None and
            perm.work_package is None):
            return True
        
        # 1. Scope检查（独立维度，必须精确匹配）
        if perm.scope is not None:
            if scope.scope != perm.scope:
                return False
        
        # 2. Subproject层级检查
        if perm.subproject is not None:
            if not PermissionService._check_subproject_hierarchy(db, perm.subproject, scope):
                return False
        
        # 3. Facility层级检查
        if perm.facility_id is not None:
            if not PermissionService._check_facility_hierarchy(db, perm.facility_id, scope):
                return False
        
        # 4. Block检查（最小单位，必须精确匹配）
        if perm.block is not None:
            if scope.block != perm.block:
                return False
        
        # 5. 其他维度检查（精确匹配）
        if perm.project is not None and scope.project != perm.project:
            return False
        if perm.train is not None and scope.train != perm.train:
            return False
        if perm.unit is not None and scope.unit != perm.unit:
            return False
        if perm.main_block is not None and scope.main_block != perm.main_block:
            return False
        if perm.quarter is not None and scope.quarter != perm.quarter:
            return False
        if perm.simple_block is not None and scope.simple_block != perm.simple_block:
            return False
        if perm.discipline is not None and scope.discipline != perm.discipline:
            return False
        
        # 6. Work Package检查（支持通过rsc_defines映射到resource_id）
        # work_package是resource_id的最小单元，类似于block是facility_id的最小单元
        if perm.work_package is not None:
            if not PermissionService._check_work_package_match(db, perm.work_package, scope):
                return False
        
        # 7. Resource ID检查（仅UserPermission可能有此字段，支持通过rsc_defines映射到work_package）
        # 如果权限有resource_id，可以通过rsc_defines映射到work_package
        if hasattr(perm, 'resource_id') and perm.resource_id is not None:
            if not PermissionService._check_resource_id_match(db, perm.resource_id, scope):
                return False
        
        return True
    
    @staticmethod
    def _check_subproject_hierarchy(db: Session, allowed_subproject: str, scope: PermissionScope) -> bool:
        if scope.subproject:
            return scope.subproject == allowed_subproject
        return False
    
    @staticmethod
    def _check_facility_hierarchy(db: Session, allowed_facility_id: int, scope: PermissionScope) -> bool:
        if scope.facility_id:
            return scope.facility_id == allowed_facility_id
        return False
    
    @staticmethod
    def _check_work_package_match(db: Session, allowed_work_package: str, scope: PermissionScope) -> bool:
        if scope.work_package:
            return scope.work_package == allowed_work_package
        return False
    
    @staticmethod
    def _check_resource_id_match(db: Session, allowed_resource_id: str, scope: PermissionScope) -> bool:
        if scope.resource_id:
            return scope.resource_id == allowed_resource_id
        return False
    
    @staticmethod
    def get_user_permissions(db: Session, user: User) -> List[Dict[str, Any]]:
        """获取用户的所有权限（包括角色权限）"""
        permissions = []
        
        # 获取用户直接权限
        user_perms = db.query(UserPermission).filter(UserPermission.user_id == user.id).all()
        for up in user_perms:
            permissions.append({
                "permission_code": up.permission.code,
                "permission_name": up.permission.name,
                "resource_type": up.permission.resource_type,
                "action": up.permission.action,
                "scope": {
                    "scope": up.scope,
                    "project": up.project,
                    "subproject": up.subproject,
                    "block": up.block,
                    "train": up.train,
                    "unit": up.unit,
                    "main_block": up.main_block,
                    "quarter": up.quarter,
                    "simple_block": up.simple_block,
                    "facility_id": up.facility_id,
                    "discipline": up.discipline,
                    "work_package": up.work_package,
                    "resource_id": up.resource_id
                },
                "source": "user"
            })
        
        # 获取角色权限
        for role in user.roles:
            if not role.is_active:
                continue
            role_perms = db.query(RolePermission).filter(RolePermission.role_id == role.id).all()
            for rp in role_perms:
                permissions.append({
                    "permission_code": rp.permission.code,
                    "permission_name": rp.permission.name,
                    "resource_type": rp.permission.resource_type,
                    "action": rp.permission.action,
                    "scope": {
                        "scope": rp.scope,
                        "project": rp.project,
                        "subproject": rp.subproject,
                        "block": rp.block,
                        "train": rp.train,
                        "unit": rp.unit,
                        "main_block": rp.main_block,
                        "quarter": rp.quarter,
                        "simple_block": rp.simple_block,
                        "facility_id": rp.facility_id,
                        "discipline": rp.discipline,
                        "work_package": rp.work_package
                    },
                    "source": f"role:{role.name}"
                })
        
        return permissions
    
    @staticmethod
    def filter_by_permission(
        db: Session,
        user: User,
        query,
        permission_code: str,
        scope_field_mapping: Dict[str, str],
        user_filters: Optional[Dict[str, Any]] = None
    ):
        """
        根据权限过滤查询
        
        Args:
            db: 数据库会话
            user: 用户对象
            query: SQLAlchemy查询对象
            permission_code: 权限代码
            scope_field_mapping: 范围字段映射，如 {"scope": "scope", "block": "block"}
            user_filters: 用户选择的筛选条件（可选），用于与权限过滤取交集
        
        Returns:
            过滤后的查询对象
        """
        # 超级管理员不需要过滤
        if user.is_superuser:
            return query
        
        # 获取所有可能的权限代码（包括映射的）
        permission_codes = PermissionService._get_mapped_permission_codes(permission_code)
        
        # 获取所有相关的权限对象
        permissions = db.query(Permission).filter(
            Permission.code.in_(permission_codes)
        ).all()
        
        if not permissions:
            # 没有权限定义，返回空查询
            return query.filter(False)
        
        # 收集所有允许的范围
        allowed_scopes = []
        permission_ids = [p.id for p in permissions]
        
        # 用户直接权限 - 一次性查询所有用户权限
        user_perms = db.query(UserPermission).filter(
            UserPermission.user_id == user.id,
            UserPermission.permission_id.in_(permission_ids)
        ).all()
        
        for up in user_perms:
            scope_dict = {}
            has_any_scope = False
            for key, field_name in scope_field_mapping.items():
                value = getattr(up, key, None)
                if value is not None:
                    scope_dict[field_name] = value
                    has_any_scope = True
            if has_any_scope:
                allowed_scopes.append(scope_dict)
            # 注意：不再直接返回 query，而是继续检查是否有其他权限
            # 如果所有权限都是全范围权限，会在后面处理
        
        # 角色权限 - 优化：一次性查询所有角色的权限
        # 避免懒加载：直接通过关联表查询用户角色
        active_roles = db.query(Role).join(
            user_role_table, Role.id == user_role_table.c.role_id
        ).filter(
            user_role_table.c.user_id == user.id,
            Role.is_active == True
        ).all()
        active_role_ids = [role.id for role in active_roles]
        role_perms = []
        if active_role_ids:
            role_perms = db.query(RolePermission).filter(
                RolePermission.role_id.in_(active_role_ids),
                RolePermission.permission_id.in_(permission_ids)
            ).all()
            
            for rp in role_perms:
                scope_dict = {}
                has_any_scope = False
                for key, field_name in scope_field_mapping.items():
                    value = getattr(rp, key, None)
                    if value is not None:
                        scope_dict[field_name] = value
                        has_any_scope = True
                if has_any_scope:
                    allowed_scopes.append(scope_dict)
                # 注意：不再直接返回 query，而是继续检查是否有其他权限
                # 如果所有权限都是全范围权限，会在后面处理
        
        # 如果用户有特定范围权限，优先应用这些权限过滤
        # 只有当用户只有全范围权限（没有任何特定范围权限）时，才返回原始 query
        if allowed_scopes:
            # 有特定范围权限，应用这些权限过滤（继续下面的逻辑）
            pass
        else:
            # 没有特定范围权限，检查是否有全范围权限
            has_unrestricted_permission = False
            for up in user_perms:
                all_none = all(getattr(up, key, None) is None for key in scope_field_mapping.keys())
                if all_none:
                    has_unrestricted_permission = True
                    break
            
            if not has_unrestricted_permission:
                for rp in role_perms:
                    all_none = all(getattr(rp, key, None) is None for key in scope_field_mapping.keys())
                    if all_none:
                        has_unrestricted_permission = True
                        break
            
            if has_unrestricted_permission:
                # 有全范围权限且没有特定范围权限，直接返回（不应用任何过滤）
                return query
            else:
                # 没有任何权限，返回空查询
                return query.filter(False)
        
        # 如果用户已经选择了筛选条件，需要验证这些条件是否在权限范围内
        if user_filters:
            # 检查用户选择的block是否在权限范围内
            if 'block' in user_filters and user_filters['block']:
                user_blocks = user_filters['block'] if isinstance(user_filters['block'], list) else [user_filters['block']]
                allowed_blocks = set()
                has_unrestricted_block_permission = False
                for scope in allowed_scopes:
                    if 'block' in scope:
                        allowed_blocks.add(scope['block'])
                    else:
                        # 如果某个权限范围没有限制block，说明有全block权限
                        has_unrestricted_block_permission = True
                
                # 如果有全block权限，不需要验证
                if not has_unrestricted_block_permission and allowed_blocks:
                    # 检查用户选择的block是否至少有一个在权限范围内
                    if not any(block in allowed_blocks for block in user_blocks):
                        return query.filter(False)
            
            # 检查用户选择的scope是否在权限范围内
            if 'scope' in user_filters and user_filters['scope']:
                user_scopes = user_filters['scope'] if isinstance(user_filters['scope'], list) else [user_filters['scope']]
                allowed_scopes_set = set()
                has_unrestricted_scope_permission = False
                for scope in allowed_scopes:
                    if 'scope' in scope:
                        allowed_scopes_set.add(scope['scope'])
                    else:
                        has_unrestricted_scope_permission = True
                
                if not has_unrestricted_scope_permission and allowed_scopes_set:
                    if not any(scope_val in allowed_scopes_set for scope_val in user_scopes):
                        return query.filter(False)
            
            # 检查用户选择的discipline是否在权限范围内
            if 'discipline' in user_filters and user_filters['discipline']:
                user_discipline = user_filters['discipline']
                allowed_disciplines = set()
                has_unrestricted_discipline_permission = False
                for scope in allowed_scopes:
                    if 'discipline' in scope:
                        allowed_disciplines.add(scope['discipline'])
                    else:
                        has_unrestricted_discipline_permission = True
                
                if not has_unrestricted_discipline_permission and allowed_disciplines:
                    if user_discipline not in allowed_disciplines:
                        return query.filter(False)
        
        # 构建过滤条件（只对用户未选择的字段应用权限过滤）
        # 如果用户已经选择了所有权限相关的字段，只需要验证权限，不需要添加额外的过滤条件
        user_selected_permission_fields = set()
        if user_filters:
            for field_name in scope_field_mapping.values():
                if field_name in user_filters and user_filters[field_name]:
                    user_selected_permission_fields.add(field_name)
        
        # 如果用户已经选择了所有权限相关的字段，直接返回query（已经应用了用户筛选和权限验证）
        if len(user_selected_permission_fields) == len(scope_field_mapping):
            return query
        
        # 构建过滤条件（只对用户未选择的字段应用权限过滤）
        conditions = []
        # 获取查询的实体类（更可靠的方式）
        entity_class = None
        if hasattr(query, 'column_descriptions') and query.column_descriptions:
            entity_class = query.column_descriptions[0].get('entity')
        if not entity_class:
            # 如果 column_descriptions 不可用，尝试从 query 的实体中获取
            if hasattr(query, 'entity') and query.entity:
                entity_class = query.entity
            elif hasattr(query, '_entities') and query._entities:
                entity_class = query._entities[0].class_
        
        if entity_class:
            for scope in allowed_scopes:
                scope_conditions = []
                for field_name, value in scope.items():
                    # 如果用户已经选择了该字段的筛选条件，跳过（因为已经在query中应用了）
                    if field_name in user_selected_permission_fields:
                        continue
                    # 获取模型字段
                    if hasattr(entity_class, field_name):
                        model_field = getattr(entity_class, field_name)
                        scope_conditions.append(model_field == value)
                if scope_conditions:
                    conditions.append(and_(*scope_conditions))
        
        if conditions:
            return query.filter(or_(*conditions))
        else:
            # 如果所有字段都被用户筛选了，直接返回query（已经应用了用户筛选）
            return query
