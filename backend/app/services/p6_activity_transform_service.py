"""
P6作业数据转换服务
将P6 API返回的数据转换为Activity表格式
"""
from typing import Dict, List, Optional
import logging

logger = logging.getLogger(__name__)


class P6ActivityTransformService:
    """P6作业数据转换服务"""
    
    # ActivityCodeTypeName到Activity字段的映射
    CODE_TYPE_MAPPING = {
        'GCC_Scope': 'scope',
        'Discipline': 'discipline',
        'Work Package': 'work_package',
        'Contract Phase': 'contract_phase',
        'Block': 'block',
        # 可以根据实际需要添加更多映射
    }
    
    @classmethod
    def extract_activity_codes(
        cls,
        activity_code_assignments: List[Dict],
        activity_object_id: Optional[int] = None
    ) -> Dict[str, str]:
        """
        从ActivityCodeAssignment列表中提取字段值
        
        Args:
            activity_code_assignments: ActivityCodeAssignment列表
            activity_object_id: 可选的ActivityObjectId，用于过滤
            
        Returns:
            字段名到值的字典，例如：
            {
                'scope': 'CC7',
                'discipline': 'CI',
                'work_package': 'GP',
                'block': '1100',
                'contract_phase': 'Phase1'
            }
        """
        result = {}
        
        for assignment in activity_code_assignments:
            if not isinstance(assignment, dict):
                continue
            
            # 如果指定了activity_object_id，进行过滤
            if activity_object_id is not None:
                if assignment.get('ActivityObjectId') != activity_object_id:
                    continue
            
            code_type_name = assignment.get('ActivityCodeTypeName', '')
            code_value = assignment.get('ActivityCodeValue', '')
            
            # 根据映射表提取字段
            if code_type_name in cls.CODE_TYPE_MAPPING:
                field_name = cls.CODE_TYPE_MAPPING[code_type_name]
                result[field_name] = code_value
        
        return result
    
    @classmethod
    def transform_p6_to_activity(
        cls,
        p6_activity: Dict,
        activity_code_assignments: List[Dict] = None,
        activity_code_map: Dict[int, List[Dict]] = None
    ) -> Dict:
        """
        将P6 API返回的Activity数据转换为Activity表格式
        
        Args:
            p6_activity: P6 API返回的Activity数据
            activity_code_assignments: 可选的ActivityCodeAssignment列表（如果已按ObjectId分组）
            activity_code_map: 可选的ActivityCodeAssignment映射 {ActivityObjectId: [assignments]}
            
        Returns:
            Activity表格式的数据字典
        """
        if not isinstance(p6_activity, dict):
            raise ValueError("p6_activity必须是字典类型")
        
        # 获取ActivityObjectId
        activity_object_id = p6_activity.get('ObjectId')
        
        # 提取ActivityCodeAssignment字段
        extracted_codes = {}
        if activity_code_map and activity_object_id:
            # 从映射中获取
            assignments = activity_code_map.get(activity_object_id, [])
            extracted_codes = cls.extract_activity_codes(assignments)
        elif activity_code_assignments:
            # 从列表中过滤并提取
            extracted_codes = cls.extract_activity_codes(
                activity_code_assignments,
                activity_object_id
            )
        
        # 构建Activity表格式的数据
        activity_data = {
            'activity_id': p6_activity.get('Id', ''),  # Id → activity_id
            'wbs': p6_activity.get('WBSPath', '') or p6_activity.get('WBSCode', ''),  # WBSPath (long) → wbs
            'title': p6_activity.get('Name', ''),  # Name → title
            'scope': extracted_codes.get('scope', ''),  # 从ActivityCodeAssignment提取
            'discipline': extracted_codes.get('discipline', ''),  # 从ActivityCodeAssignment提取
            'work_package': extracted_codes.get('work_package', ''),  # 从ActivityCodeAssignment提取
            'contract_phase': extracted_codes.get('contract_phase', ''),  # 从ActivityCodeAssignment提取
            'block': extracted_codes.get('block', ''),  # 从ActivityCodeAssignment提取
            # 注意：weight_factor和man_hours需要通过计算服务计算，不在这里设置
        }
        
        return activity_data
    
    @classmethod
    def batch_transform(
        cls,
        p6_activities: List[Dict],
        activity_code_map: Dict[int, List[Dict]]
    ) -> List[Dict]:
        """
        批量转换P6作业数据
        
        Args:
            p6_activities: P6 API返回的Activity列表
            activity_code_map: ActivityCodeAssignment映射 {ActivityObjectId: [assignments]}
            
        Returns:
            Activity表格式的数据列表
        """
        result = []
        
        for p6_activity in p6_activities:
            try:
                activity_data = cls.transform_p6_to_activity(
                    p6_activity,
                    activity_code_map=activity_code_map
                )
                result.append(activity_data)
            except Exception as e:
                activity_id = p6_activity.get('Id', 'Unknown')
                logger.error(f"转换作业 {activity_id} 失败: {e}")
                continue
        
        return result
