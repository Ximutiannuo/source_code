"""
初始化权限系统 - 创建默认权限定义
"""
import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database import SessionLocal
from app.models.user import Permission

# 默认权限定义
DEFAULT_PERMISSIONS = [
    # 计划管理权限（实际权限，activity:* 通过映射使用此权限）
    {"code": "planning:read", "name": "计划管理 - 查看", "description": "查看作业/活动信息（API使用activity:read时会映射到此权限）", "resource_type": "planning", "action": "read"},
    {"code": "planning:create", "name": "计划管理 - 创建", "description": "创建作业/活动（API使用activity:create时会映射到此权限）", "resource_type": "planning", "action": "create"},
    {"code": "planning:update", "name": "计划管理 - 更新", "description": "更新作业/活动信息（API使用activity:update时会映射到此权限）", "resource_type": "planning", "action": "update"},
    {"code": "planning:delete", "name": "计划管理 - 删除", "description": "删除作业/活动（API使用activity:delete时会映射到此权限）", "resource_type": "planning", "action": "delete"},

    # 日报管理权限
    {"code": "daily_report:read", "name": "日报管理 - 查看", "description": "人力日报和工程量日报管理的查看权限", "resource_type": "daily_report", "action": "read"},
    {"code": "daily_report:create", "name": "日报管理 - 创建", "description": "人力日报和工程量日报管理的创建权限", "resource_type": "daily_report", "action": "create"},
    {"code": "daily_report:update", "name": "日报管理 - 更新", "description": "人力日报和工程量日报管理的更新权限", "resource_type": "daily_report", "action": "update"},
    {"code": "daily_report:delete", "name": "日报管理 - 删除", "description": "人力日报和工程量日报管理的删除权限", "resource_type": "daily_report", "action": "delete"},

    # 工程量具体类型权限
    {"code": "construction_volume:read", "name": "施工工程量信息管理 - 查看", "description": "查看施工工程量信息", "resource_type": "construction_volume", "action": "read"},
    {"code": "construction_volume:create", "name": "施工工程量信息管理 - 创建", "description": "创建施工工程量信息", "resource_type": "construction_volume", "action": "create"},
    {"code": "construction_volume:update", "name": "施工工程量信息管理 - 更新", "description": "更新施工工程量信息", "resource_type": "construction_volume", "action": "update"},
    {"code": "construction_volume:delete", "name": "施工工程量信息管理 - 删除", "description": "删除施工工程量信息", "resource_type": "construction_volume", "action": "delete"},
    
    {"code": "acceptance_volume:read", "name": "验收工程量信息管理 - 查看", "description": "查看验收工程量信息", "resource_type": "acceptance_volume", "action": "read"},
    {"code": "acceptance_volume:create", "name": "验收工程量信息管理 - 创建", "description": "创建验收工程量信息", "resource_type": "acceptance_volume", "action": "create"},
    {"code": "acceptance_volume:update", "name": "验收工程量信息管理 - 更新", "description": "更新验收工程量信息", "resource_type": "acceptance_volume", "action": "update"},
    {"code": "acceptance_volume:delete", "name": "验收工程量信息管理 - 删除", "description": "删除验收工程量信息", "resource_type": "acceptance_volume", "action": "delete"},
    
    {"code": "abd_volume:read", "name": "ABD工程量信息管理 - 查看", "description": "查看ABD工程量信息", "resource_type": "abd_volume", "action": "read"},
    {"code": "abd_volume:create", "name": "ABD工程量信息管理 - 创建", "description": "创建ABD工程量信息", "resource_type": "abd_volume", "action": "create"},
    {"code": "abd_volume:update", "name": "ABD工程量信息管理 - 更新", "description": "更新ABD工程量信息", "resource_type": "abd_volume", "action": "update"},
    {"code": "abd_volume:delete", "name": "ABD工程量信息管理 - 删除", "description": "删除ABD工程量信息", "resource_type": "abd_volume", "action": "delete"},
    
    {"code": "ovr_volume:read", "name": "OVR工程量信息管理 - 查看", "description": "查看OVR工程量信息", "resource_type": "ovr_volume", "action": "read"},
    {"code": "ovr_volume:create", "name": "OVR工程量信息管理 - 创建", "description": "创建OVR工程量信息", "resource_type": "ovr_volume", "action": "create"},
    {"code": "ovr_volume:update", "name": "OVR工程量信息管理 - 更新", "description": "更新OVR工程量信息", "resource_type": "ovr_volume", "action": "update"},
    {"code": "ovr_volume:delete", "name": "OVR工程量信息管理 - 删除", "description": "删除OVR工程量信息", "resource_type": "ovr_volume", "action": "delete"},
    
    {"code": "exhibition_report:read", "name": "展报管理 - 查看", "description": "查看展报", "resource_type": "exhibition_report", "action": "read"},
    {"code": "exhibition_report:create", "name": "展报管理 - 创建", "description": "创建展报", "resource_type": "exhibition_report", "action": "create"},
    {"code": "exhibition_report:update", "name": "展报管理 - 更新", "description": "更新展报", "resource_type": "exhibition_report", "action": "update"},
    {"code": "exhibition_report:delete", "name": "展报管理 - 删除", "description": "删除展报", "resource_type": "exhibition_report", "action": "delete"},

    # P6资源变动权限
    {"code": "p6_resource:read", "name": "查看P6资源", "description": "查看P6资源信息", "resource_type": "p6_resource", "action": "read"},
    {"code": "p6_resource:update", "name": "更新P6资源", "description": "更新P6资源信息", "resource_type": "p6_resource", "action": "update"},
    {"code": "p6_resource:sync", "name": "同步P6资源", "description": "执行P6资源同步", "resource_type": "p6_resource", "action": "sync"},
    
    # P6数据库权限（用于p6_resource权限映射）
    {"code": "p6_database:read", "name": "P6数据库管理 - 查看", "description": "查看P6数据库信息", "resource_type": "p6_database", "action": "read"},
    {"code": "p6_database:update", "name": "P6数据库管理 - 更新", "description": "更新P6数据库信息", "resource_type": "p6_database", "action": "update"},
    {"code": "p6_database:sync", "name": "P6数据库管理 - 同步", "description": "执行P6数据库同步", "resource_type": "p6_database", "action": "sync"},
    
    # P6同步权限（用于P6同步数据管理）
    {"code": "p6_sync:read", "name": "查看P6同步数据", "description": "查看P6同步的活动、WBS等数据", "resource_type": "p6_sync", "action": "read"},
    {"code": "p6_sync:update", "name": "更新P6同步数据", "description": "更新P6同步的活动、WBS等数据", "resource_type": "p6_sync", "action": "update"},
    {"code": "p6_sync:delete", "name": "删除P6同步数据", "description": "删除P6同步的活动、WBS等数据", "resource_type": "p6_sync", "action": "delete"},
    {"code": "p6_sync:sync", "name": "执行P6同步", "description": "执行P6数据同步操作", "resource_type": "p6_sync", "action": "sync"},
    
    # 用户管理权限
    {"code": "user:read", "name": "查看用户", "description": "查看用户信息", "resource_type": "user", "action": "read"},
    {"code": "user:create", "name": "创建用户", "description": "创建新用户", "resource_type": "user", "action": "create"},
    {"code": "user:update", "name": "更新用户", "description": "更新用户信息", "resource_type": "user", "action": "update"},
    {"code": "user:delete", "name": "删除用户", "description": "删除用户", "resource_type": "user", "action": "delete"},
    
    # 权限管理权限
    {"code": "permission:read", "name": "权限管理 - 查看", "description": "查看权限信息", "resource_type": "permission", "action": "read"},
    {"code": "permission:assign", "name": "权限管理 - 分配", "description": "为用户或角色分配权限", "resource_type": "permission", "action": "assign"},
    {"code": "permission:revoke", "name": "权限管理 - 撤销", "description": "撤销用户或角色的权限", "resource_type": "permission", "action": "revoke"},
    
    # 主项清单管理权限
    {"code": "facility:read", "name": "主项清单管理 - 查看", "description": "查看主项清单信息", "resource_type": "facility", "action": "read"},
    {"code": "facility:create", "name": "主项清单管理 - 创建", "description": "创建主项清单", "resource_type": "facility", "action": "create"},
    {"code": "facility:update", "name": "主项清单管理 - 更新", "description": "更新主项清单信息", "resource_type": "facility", "action": "update"},
    {"code": "facility:delete", "name": "主项清单管理 - 删除", "description": "删除主项清单", "resource_type": "facility", "action": "delete"},
    
    # 验收日报（InspectionDB）权限
    {"code": "inspection_db:read", "name": "验收日报 - 查看", "description": "查看验收日报（RFI/验收记录）列表与详情", "resource_type": "inspection_db", "action": "read"},
    {"code": "inspection_db:create", "name": "验收日报 - 创建", "description": "创建验收日报记录", "resource_type": "inspection_db", "action": "create"},
    {"code": "inspection_db:update", "name": "验收日报 - 更新", "description": "更新验收日报记录", "resource_type": "inspection_db", "action": "update"},
    {"code": "inspection_db:delete", "name": "验收日报 - 删除", "description": "删除验收日报记录", "resource_type": "inspection_db", "action": "delete"},

    # 验收程序（ITP/验收程序列表与导出）权限
    {"code": "acceptance_procedure:read", "name": "验收程序 - 查看", "description": "查看验收程序（ITP 及工作依据）与导出 Excel", "resource_type": "acceptance_procedure", "action": "read"},

    # 系统管理员权限（工作包管理增删改、MDR 等仅 admin 可操作）
    {"code": "system:admin", "name": "系统管理 - 管理员", "description": "系统管理员权限（工作包管理增删改等，仅 admin 账号）", "resource_type": "system", "action": "admin"},
]


def init_permissions():
    """初始化权限定义"""
    db = SessionLocal()
    try:
        created_count = 0
        existing_count = 0
        
        for perm_data in DEFAULT_PERMISSIONS:
            existing = db.query(Permission).filter(Permission.code == perm_data["code"]).first()
            if existing:
                print(f"权限已存在: {perm_data['code']}")
                existing_count += 1
            else:
                permission = Permission(**perm_data)
                db.add(permission)
                print(f"创建权限: {perm_data['code']} - {perm_data['name']}")
                created_count += 1
        
        db.commit()
        print(f"\n完成！创建了 {created_count} 个权限，{existing_count} 个权限已存在")
        
    except Exception as e:
        db.rollback()
        print(f"错误: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("开始初始化权限系统...")
    init_permissions()
