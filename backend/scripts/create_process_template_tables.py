"""
在 projectcontrols 库中创建工序逻辑规则库相关表：
- facility_types：装置类型（变电站、管廊、棚式结构等）
- process_templates：工序模板（可关联 facility_type_id）
- template_activities：模板工序行（工作包+计划工期）
- template_activity_links：模板内工序逻辑关系（前驱-后继）

也可不运行本脚本：应用启动时 Base.metadata.create_all 会自动创建缺失表。
facilities 表新增 facility_type_id 列需单独 ALTER 或重建。
"""
import sys
import os
from pathlib import Path

project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from app.database import load_env_with_fallback
if not os.getenv("DATABASE_URL"):
    load_env_with_fallback()

from app.database import get_default_engine, Base
from app.models.facility_type import FacilityType
from app.models.process_template import ProcessTemplate, TemplateActivity, TemplateActivityLink
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def create_tables():
    """创建 facility_types、process_templates、template_activities、template_activity_links 表"""
    engine = get_default_engine()
    logger.info("创建工序逻辑规则库表 facility_types, process_templates, template_activities, template_activity_links ...")
    Base.metadata.create_all(
        engine,
        tables=[
            FacilityType.__table__,
            ProcessTemplate.__table__,
            TemplateActivity.__table__,
            TemplateActivityLink.__table__,
        ]
    )
    logger.info("表已就绪。若 facilities 表尚无 facility_type_id 列，请执行：ALTER TABLE facilities ADD COLUMN facility_type_id INT NULL;")


if __name__ == "__main__":
    create_tables()
