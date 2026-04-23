"""
时区工具函数
统一使用 GMT+3 时区（系统默认时区）
"""
from datetime import datetime, timezone, timedelta

# 系统默认时区：GMT+3
SYSTEM_TIMEZONE = timezone(timedelta(hours=3))

def now():
    """
    获取当前系统时间（GMT+3）
    
    Returns:
        datetime: 当前时间，带 GMT+3 时区信息
    """
    return datetime.now(SYSTEM_TIMEZONE)

def utc_to_system(utc_dt: datetime) -> datetime:
    """
    将 UTC 时间转换为系统时区（GMT+3）
    
    Args:
        utc_dt: UTC 时间
        
    Returns:
        datetime: GMT+3 时区的时间
    """
    if utc_dt.tzinfo is None:
        # 如果没有时区信息，假设是 UTC
        utc_dt = utc_dt.replace(tzinfo=timezone.utc)
    return utc_dt.astimezone(SYSTEM_TIMEZONE)

def system_to_utc(system_dt: datetime) -> datetime:
    """
    将系统时区（GMT+3）时间转换为 UTC
    
    Args:
        system_dt: GMT+3 时区的时间
        
    Returns:
        datetime: UTC 时间
    """
    if system_dt.tzinfo is None:
        # 如果没有时区信息，假设是系统时区
        system_dt = system_dt.replace(tzinfo=SYSTEM_TIMEZONE)
    return system_dt.astimezone(timezone.utc)

