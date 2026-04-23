"""
权重计算服务 - 根据人工时计算权重信息
"""
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.activity_summary import ActivitySummary
from app.models.report import MPDB, VFACTDB
from typing import Dict, List
import logging

logger = logging.getLogger(__name__)


class WeightCalculationService:
    """权重计算服务类"""
    
    @staticmethod
    def calculate_activity_weights(db: Session, project: str = None) -> Dict:
        """
        计算作业权重
        
        Args:
            db: 数据库会话
            project: 项目代码，如果为None则计算所有项目
            
        Returns:
            计算结果字典
        """
        try:
            # 查询所有作业
            query = db.query(ActivitySummary)
            if project:
                query = query.filter(ActivitySummary.project == project)
            
            activities = query.all()
            
            if not activities:
                return {
                    "success": False,
                    "error": "没有找到作业数据"
                }
            
            # 计算总人工时
            total_manhour = sum(
                float(act.calculated_mhrs or 0) for act in activities
            )
            
            if total_manhour == 0:
                return {
                    "success": False,
                    "error": "总人工时为0，无法计算权重"
                }
            
            # 计算每个作业的权重
            updated_count = 0
            for activity in activities:
                if activity.calculated_mhrs and activity.calculated_mhrs > 0:
                    # 计算权重百分比
                    weight_percentage = float(activity.calculated_mhrs) / total_manhour
                    
                    # 计算权重因子（假设总权重因子为254137500，根据实际项目调整）
                    total_weight_factor = 254137500
                    weight_factor = weight_percentage * total_weight_factor
                    
                    activity.weight_factor = weight_factor
                    updated_count += 1
            
            db.commit()
            
            return {
                "success": True,
                "total_manhour": total_manhour,
                "total_activities": len(activities),
                "updated_count": updated_count
            }
            
        except Exception as e:
            logger.error(f"计算权重时出错: {e}")
            db.rollback()
            return {
                "success": False,
                "error": str(e)
            }
    
    @staticmethod
    def calculate_progress_from_reports(
        db: Session,
        start_date: str = None,
        end_date: str = None
    ) -> Dict:
        """
        根据日报数据计算进度
        
        Args:
            db: 数据库会话
            start_date: 开始日期
            end_date: 结束日期
            
        Returns:
            进度计算结果
        """
        try:
            from datetime import datetime
            
            # 查询MPDB数据
            mpdb_query = db.query(MPDB)
            if start_date:
                mpdb_query = mpdb_query.filter(MPDB.date >= datetime.strptime(start_date, "%Y-%m-%d").date())
            if end_date:
                mpdb_query = mpdb_query.filter(MPDB.date <= datetime.strptime(end_date, "%Y-%m-%d").date())
            
            mpdb_data = mpdb_query.all()
            
            # 查询VFACTDB数据
            vfactdb_query = db.query(VFACTDB)
            if start_date:
                vfactdb_query = vfactdb_query.filter(VFACTDB.date >= datetime.strptime(start_date, "%Y-%m-%d").date())
            if end_date:
                vfactdb_query = vfactdb_query.filter(VFACTDB.date <= datetime.strptime(end_date, "%Y-%m-%d").date())
            
            vfactdb_data = vfactdb_query.all()
            
            # 按作业ID汇总
            activity_manpower = {}
            activity_volume = {}
            
            for entry in mpdb_data:
                if entry.activity_id not in activity_manpower:
                    activity_manpower[entry.activity_id] = {
                        "direct": 0,
                        "indirect": 0,
                        "machinery": 0
                    }
                
                if entry.typeof_mp == "Direct":
                    activity_manpower[entry.activity_id]["direct"] += entry.manpower or 0
                elif entry.typeof_mp == "Indirect":
                    activity_manpower[entry.activity_id]["indirect"] += entry.manpower or 0
                
                activity_manpower[entry.activity_id]["machinery"] += entry.machinery or 0
            
            for entry in vfactdb_data:
                if entry.activity_id not in activity_volume:
                    activity_volume[entry.activity_id] = 0
                activity_volume[entry.activity_id] += float(entry.achieved or 0)
            
            return {
                "success": True,
                "mpdb_count": len(mpdb_data),
                "vfactdb_count": len(vfactdb_data),
                "activity_manpower": activity_manpower,
                "activity_volume": activity_volume
            }
            
        except Exception as e:
            logger.error(f"计算进度时出错: {e}")
            return {
                "success": False,
                "error": str(e)
            }

