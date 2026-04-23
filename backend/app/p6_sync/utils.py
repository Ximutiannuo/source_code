"""
P6同步工具函数
"""
from datetime import datetime
from typing import Optional, Any
import logging

logger = logging.getLogger(__name__)


def parse_date(date_str: Optional[str]) -> Optional[datetime]:
    """
    解析P6日期字符串
    
    Args:
        date_str: P6日期字符串，格式可能是 "2024-01-15T00:00:00" 或 "2024-01-15T00:00:00Z"
        
    Returns:
        datetime对象或None
    """
    if not date_str:
        return None
    try:
        # P6日期格式可能是: "2024-01-15T00:00:00" 或 "2024-01-15T00:00:00Z"
        if 'T' in date_str:
            date_str = date_str.replace('Z', '+00:00')
            return datetime.fromisoformat(date_str)
        else:
            return datetime.strptime(date_str, '%Y-%m-%d')
    except Exception as e:
        logger.warning(f"无法解析日期 '{date_str}': {e}")
        return None


def parse_boolean(value: Any) -> bool:
    """
    解析P6布尔值（可能是字符串'true'/'false'或布尔值）
    
    Args:
        value: 可能是字符串、布尔值、数字等
        
    Returns:
        bool值
    """
    if value is None:
        return False
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.lower() in ('true', '1', 'yes', 'y', 't')
    # 如果是数字，0为False，非0为True
    if isinstance(value, (int, float)):
        return bool(value)
    return False


def parse_numeric(value: Any) -> Optional[float]:
    """
    解析P6数值（可能是字符串或数字）
    
    Args:
        value: 可能是字符串、数字等
        
    Returns:
        float值或None
    """
    if value is None:
        return None
    try:
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            # 移除可能的空格
            value = value.strip()
            if not value or value == '':
                return None
            return float(value)
        return None
    except (ValueError, TypeError):
        logger.warning(f"无法解析数值 '{value}'")
        return None


def safe_get(data: dict, key: str, default: Any = None) -> Any:
    """
    安全获取字典值
    
    Args:
        data: 字典
        key: 键
        default: 默认值
        
    Returns:
        值或默认值
    """
    if not isinstance(data, dict):
        return default
    return data.get(key, default)
