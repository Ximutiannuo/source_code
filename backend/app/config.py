"""
应用配置
"""
from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Optional, Dict
import os
import re
from urllib.parse import quote_plus


class Settings(BaseSettings):
    # 数据库配置
    # DATABASE_URL用于默认引擎（表创建等系统操作）
    # 注意：应用主要使用SecretManager管理角色数据库连接，DATABASE_URL仅用于默认连接
    # 生产环境必须从环境变量设置，不能使用默认密码
    DATABASE_URL: str = ""
    
    @field_validator('DATABASE_URL')
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        """验证DATABASE_URL不是默认密码（生产环境）"""
        # 只在生产环境检查
        if os.getenv("ENV") == "production":
            if "root:password@" in v or ":password@" in v:
                raise ValueError(
                    "DATABASE_URL不能使用默认密码 'password'（生产环境安全要求）。"
                    "请从环境变量设置DATABASE_URL，或确保密码已更新。"
                )
        return v
    
    # 数据库连接配置
    # 注意：DB_HOST 和 DB_PORT 会从 DATABASE_URL 自动解析，如果 DATABASE_URL 存在
    DB_HOST: str = "10.78.44.17"
    DB_PORT: int = 3306
    DB_INSTANCE: str = "gcc"  # 数据库实例名
    DB_NAME: str = "projectcontrols"  # 主数据库名
    
    # 角色数据库账号配置（从环境变量读取，不硬编码密码）
    # 格式：ROLE_NAME_USERNAME, ROLE_NAME_PASSWORD
    # 计划经理
    ROLE_PLANNING_MANAGER_USERNAME: str = "role_planning_manager"
    ROLE_PLANNING_MANAGER_PASSWORD: str = ""
    
    # 系统管理员
    ROLE_SYSTEM_ADMIN_USERNAME: str = "role_system_admin"
    ROLE_SYSTEM_ADMIN_PASSWORD: str = ""
    
    # 计划主管
    ROLE_PLANNING_SUPERVISOR_USERNAME: str = "role_planning_supervisor"
    ROLE_PLANNING_SUPERVISOR_PASSWORD: str = ""
    
    # Planner
    ROLE_PLANNER_USERNAME: str = "role_planner"
    ROLE_PLANNER_PASSWORD: str = ""
    
    # JWT配置
    # SECRET_KEY建议从环境变量读取，或通过Vault自动注入
    SECRET_KEY: str = ""  
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 8 * 60
    
    @field_validator('SECRET_KEY')
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        """验证SECRET_KEY"""
        if not v:
            return v # 允许为空，后续由 __init__ 补齐
        if v == "your-secret-key-change-in-production":
            raise ValueError("SECRET_KEY不能使用默认值")
        return v
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        
        # 1. 自动解析 DATABASE_URL 设置 DB_HOST 和 DB_PORT
        if self.DATABASE_URL and '@' in self.DATABASE_URL:
            # 解析 mysql+pymysql://user:pass@host:port/dbname
            match = re.search(r'@([^:]+):(\d+)/', self.DATABASE_URL)
            if match:
                self.DB_HOST = match.group(1)
                self.DB_PORT = int(match.group(2))
        
        # 2. 暴力调试：打印当前环境中的数据库主机
        current_host = os.getenv("DB_HOST", "NOT_SET")
        # print(f"DEBUG: Process DB_HOST env var is: {current_host}") # 生产环境减少打印
        
        # 3. 自动补齐 SECRET_KEY
        if not self.SECRET_KEY:
            self.SECRET_KEY = os.getenv("SECRET_KEY", "")
            
        if not self.SECRET_KEY:
            try:
                from app.services.secret_manager import get_secret_manager
                sm = get_secret_manager()
                if sm.source.value == "vault" and sm._vault_client:
                    mount_point = os.getenv('VAULT_MOUNT_POINT', 'secret')
                    res = sm._vault_client.secrets.kv.v2.read_secret_version(mount_point=mount_point, path='app-config')
                    if res and 'data' in res:
                        self.SECRET_KEY = res['data'].get('data', {}).get('secret_key', "")
            except: pass

        # 4. 从 Vault app-config 读取 DEEPSEEK_API_KEY（若环境变量未设置）
        if not self.DEEPSEEK_API_KEY:
            try:
                from app.services.secret_manager import get_secret_manager
                sm = get_secret_manager()
                v = sm.get_app_config('deepseek_api_key')
                if v:
                    self.DEEPSEEK_API_KEY = v
            except Exception:
                pass

    
    # P6配置
    P6_SERVER_URL: Optional[str] = None
    P6_DATABASE: Optional[str] = None
    P6_USERNAME: Optional[str] = None
    P6_PASSWORD: Optional[str] = None
    
    # 邮件配置
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: Optional[int] = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    
    # 文件路径配置
    UPLOAD_DIR: str = "./uploads"
    REPORT_DIR: str = "./reports"
    POWERBI_DIR: str = "./powerbi"
    # 检验申请单 RFI 文件根目录（如 Z:\1-检验申请单RFI）；未设置时使用 UPLOAD_DIR/rfi_files
    RFI_FILES_ROOT: Optional[str] = None
    # scope（activity_summary.scope，如 MEN）→ 磁盘文件夹名（如 6-MEN）。JSON 字符串，例：{"MEN":"6-MEN","NAG":"18-NAG"}
    RFI_SCOPE_TO_FOLDER: Optional[str] = None
    
    # DeepSeek API 配置（AI 助手）
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com"
    AI_ASSISTANT_DAILY_LIMIT: int = 20  # 每用户每天提问次数上限

    # Redis配置
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: Optional[str] = None
    
    # HashiCorp Vault 配置（可选，如果使用 Vault 作为密钥管理服务）
    # 这些配置会通过环境变量自动读取，无需在此硬编码
    # VAULT_ADDR: Optional[str] = None  # Vault 服务器地址，例如：http://127.0.0.1:8200
    # VAULT_TOKEN: Optional[str] = None  # Vault 认证令牌（通过环境变量设置，不要硬编码）
    # VAULT_SECRET_PATH: Optional[str] = None  # 密钥路径前缀，默认：secret/data/db-roles
    
    class Config:
        # 不直接读取 .env 文件（已在 database.py 中加载到环境变量）
        # 只从环境变量读取，避免编码问题
        env_file = None
        case_sensitive = True
    
    def get_role_database_url(self, role_name: str) -> Optional[str]:
        """
        根据角色名称获取对应的数据库连接URL（使用SecretManager）
        
        Args:
            role_name: 角色名称（例如：'计划经理'、'系统管理员'等）
            
        Returns:
            数据库连接URL，如果角色未配置则返回None
        """
        from app.services.secret_manager import get_secret_manager
        
        # 角色名称映射（中文名 -> 配置key）
        # 固定角色映射
        role_mapping = {
            '计划经理': 'PLANNING_MANAGER',
            '系统管理员': 'SYSTEM_ADMIN',
            '计划主管': 'PLANNING_SUPERVISOR',
        }
        
        secret_manager = get_secret_manager()
        
        # 获取角色key
        if role_name in role_mapping:
            role_key = role_mapping[role_name]
        elif role_name.endswith('Planner') or role_name == 'Planner':
            # 所有 Planner 角色（C01Planner, C19Planner, Planner 等）
            role_key = 'PLANNER'
        elif role_name.endswith('ConstructionSupervisor') or role_name == 'ConstructionSupervisor':
            # 所有施工主管角色（PELConstructionSupervisor, ECUConstructionSupervisor 等）共用 role_construction_supervisor
            role_key = 'CONSTRUCTION_SUPERVISOR'
        else:
            # 其他未映射的角色，尝试直接使用角色名
            role_key = role_name.upper().replace(' ', '_')
        
        # 从SecretManager获取用户名和密码
        username = secret_manager.get_role_username(role_key)
        password = secret_manager.get_role_password(role_key)
        
        if not username or not password:
            return None
        
        # URL编码密码中的特殊字符
        encoded_password = quote_plus(password)
        
        # 构建数据库URL（连接主数据库projectcontrols）
        database_url = (
            f"mysql+pymysql://{username}:{encoded_password}@"
            f"{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?charset=utf8mb4"
        )
        
        return database_url
    
settings = Settings()
