from .wbs import WBSNode, WBSDiagram
from .user import User, Role, Permission, UserPermission, RolePermission
from .config import SystemConfig
from .department import Department
from .activity_summary import ActivitySummary
from .activity_extensions import ActivityExtensions
from .dashboard import BudgetedDB, AtCompletionDB, OWFDB, SCurveCache, ProjectInfo, ProjectImage
from .productivity_cache import ProductivityCache, ProductivityCacheWp
from .process_template import ProcessTemplate, TemplateActivity, TemplateActivityLink
from .facility_type import FacilityType
from .facility import Facility
from .rsc import RSCDefine
from .ai_assistant_usage import AIAssistantUsage
from .ai_assistant_query_log import AIAssistantQueryLog
from .activity_status import ActivityStatusRecord

# 新增制造板块的基础模型
from .bom import BOMHeader, BOMItem, Material
from .order import ManufacturingOrder, OrderItem
from .production_step import ProductionStep
from .work_report import WorkReport
from .step_quality_check import StepQualityCheck
from .equipment import Equipment
from .equipment_maintenance import EquipmentMaintenance
from .ecn import ECNHeader, ECNImpact
from .procurement import ProcurementRequest, ProcurementRequestItem

__all__ = [
    "WBSNode",
    "WBSDiagram",
    "SystemConfig",
    "User",
    "Role",
    "Permission",
    "UserPermission",
    "Department",
    "RolePermission",
    "ActivitySummary",
    "ActivityExtensions",
    "ActivityStatusRecord",
    "BudgetedDB",
    "AtCompletionDB",
    "OWFDB",
    "SCurveCache",
    "ProjectInfo",
    "ProjectImage",
    "ProductivityCache",
    "ProductivityCacheWp",
    "ProcessTemplate",
    "TemplateActivity",
    "TemplateActivityLink",
    "Facility",
    "FacilityType",
    "RSCDefine",
    "AIAssistantUsage",
    "AIAssistantQueryLog",
    
    # 制造板块
    "BOMHeader",
    "BOMItem",
    "Material",
    "ManufacturingOrder",
    "OrderItem",
    "ProductionStep",
    "WorkReport",
    "StepQualityCheck",
    "Equipment",
    "EquipmentMaintenance",
    "ECNHeader",
    "ECNImpact",
    "ProcurementRequest",
    "ProcurementRequestItem",
]
