"""
密钥管理服务 - 支持 HashiCorp Vault、环境变量和加密配置文件
优先使用 HashiCorp Vault（业界标准，满足合规要求）
"""
import os
import json
import logging
from typing import Optional, Dict
from pathlib import Path
from enum import Enum

logger = logging.getLogger(__name__)


class SecretSource(str, Enum):
    """密钥源类型（按优先级排序）"""
    VAULT = "vault"  # HashiCorp Vault（业界标准，满足合规要求）
    ENV_VAR = "env_var"  # 环境变量（折中方案）
    ENCRYPTED_FILE = "encrypted_file"  # 加密配置文件（备选方案）


class SecretManager:
    """
    密钥管理器
    
    支持三种方式（按优先级）：
    1. HashiCorp Vault（推荐，业界标准，满足合规要求）
    2. 环境变量（折中方案）
    3. 加密配置文件（备选方案）
    """
    
    def __init__(self, source: Optional[SecretSource] = None):
        """
        初始化密钥管理器
        
        Args:
            source: 密钥源类型，如果为None则自动检测
        """
        self.source = source or self._detect_source()
        self._cache: Dict[str, str] = {}
        self._encrypted_data: Optional[Dict[str, str]] = None
        self._vault_client = None
        
        if self.source == SecretSource.VAULT:
            self._init_vault_client()
        elif self.source == SecretSource.ENCRYPTED_FILE:
            self._load_encrypted_secrets()
    
    def _detect_source(self) -> SecretSource:
        """
        自动检测密钥源
        
        优先级（从高到低）：
        1. HashiCorp Vault（如果配置了 VAULT_ADDR 和 VAULT_TOKEN）
        2. 环境变量（如果设置了角色密码环境变量）
        3. 加密配置文件（如果文件存在）
        """
        # 优先检查 Vault 配置
        vault_addr = os.getenv('VAULT_ADDR')
        vault_token = os.getenv('VAULT_TOKEN')
        
        if vault_addr and vault_token:
            logger.info(f"检测到 Vault 配置 (VAULT_ADDR={vault_addr})，使用 Vault 模式（业界标准，满足合规要求）")
            return SecretSource.VAULT
        if vault_addr or vault_token:
            logger.warning("Vault 未启用: VAULT_ADDR=%s, VAULT_TOKEN=%s", "已设置" if vault_addr else "未设置", "已设置" if vault_token else "未设置")
        
        # 其次检查环境变量
        test_env_keys = [
            'ROLE_PLANNING_MANAGER_PASSWORD',
            'ROLE_SYSTEM_ADMIN_PASSWORD',
            'ROLE_PLANNING_SUPERVISOR_PASSWORD',
            'ROLE_PLANNER_PASSWORD'
        ]
        
        if any(os.getenv(key) for key in test_env_keys):
            logger.info("检测到环境变量密钥，使用环境变量模式（折中方案）")
            return SecretSource.ENV_VAR
        
        # 最后检查加密配置文件
        encrypted_file = os.getenv(
            'SECRETS_ENCRYPTED_FILE',
            os.path.join(os.path.dirname(__file__), '..', '..', 'config', 'secrets.encrypted')
        )
        
        if os.path.exists(encrypted_file):
            logger.info(f"检测到加密配置文件: {encrypted_file}，使用加密文件模式（备选）")
            return SecretSource.ENCRYPTED_FILE
        else:
            logger.warning("未检测到任何密钥源配置，将无法获取角色密码")
            logger.warning("请通过以下方式之一配置密钥：")
            logger.warning("1. 配置 HashiCorp Vault（推荐，业界标准）：设置 VAULT_ADDR 和 VAULT_TOKEN 环境变量")
            logger.warning("2. 通过环境变量注入（折中方案）：设置 ROLE_*_PASSWORD 环境变量")
            logger.warning("3. 创建加密配置文件（备选）：运行 scripts/generate_encrypted_secrets.py")
            return SecretSource.ENV_VAR  # 默认返回，即使没有值
    
    def _init_vault_client(self):
        """初始化 Vault 客户端"""
        try:
            import hvac
            
            vault_addr = os.getenv('VAULT_ADDR', 'http://127.0.0.1:8200')
            vault_token = os.getenv('VAULT_TOKEN')
            
            if not vault_token:
                logger.error("VAULT_TOKEN 未设置，无法连接到 Vault（请确认服务通过 NSSM AppEnvironmentExtra 注入了 VAULT_TOKEN）")
                logger.warning("回退到环境变量模式")
                self.source = SecretSource.ENV_VAR
                return
            
            self._vault_client = hvac.Client(url=vault_addr, token=vault_token)
            
            # 测试连接
            if not self._vault_client.is_authenticated():
                logger.error("Vault 认证失败，请检查 VAULT_TOKEN")
                logger.warning("回退到环境变量模式")
                self.source = SecretSource.ENV_VAR
                self._vault_client = None
                return
            
            logger.info(f"成功连接到 Vault ({vault_addr})")
            
        except ImportError:
            logger.error("hvac 库未安装，请运行: pip install hvac")
            logger.warning("回退到环境变量模式")
            self.source = SecretSource.ENV_VAR
            self._vault_client = None
        except Exception as e:
            logger.error(f"初始化 Vault 客户端失败: {e}")
            logger.warning("回退到环境变量模式")
            self.source = SecretSource.ENV_VAR
            self._vault_client = None
    
    def _load_encrypted_secrets(self):
        """加载加密的密钥文件"""
        try:
            from cryptography.fernet import Fernet
            
            encrypted_file = os.getenv(
                'SECRETS_ENCRYPTED_FILE',
                os.path.join(os.path.dirname(__file__), '..', '..', 'config', 'secrets.encrypted')
            )
            key_file = os.getenv(
                'SECRETS_KEY_FILE',
                os.path.join(os.path.dirname(__file__), '..', '..', 'config', '.secrets.key')
            )
            
            # 检查文件是否存在
            if not os.path.exists(encrypted_file):
                logger.warning(f"加密配置文件不存在: {encrypted_file}")
                return
            
            if not os.path.exists(key_file):
                logger.error(f"密钥文件不存在: {key_file}")
                logger.error("请使用 scripts/generate_encrypted_secrets.py 生成密钥文件")
                return
            
            # 读取密钥
            with open(key_file, 'rb') as f:
                key = f.read()
            
            # 读取并解密配置文件
            fernet = Fernet(key)
            with open(encrypted_file, 'rb') as f:
                encrypted_data = f.read()
            
            decrypted_data = fernet.decrypt(encrypted_data)
            self._encrypted_data = json.loads(decrypted_data.decode('utf-8'))
            
            logger.info("成功加载加密密钥配置文件")
            
        except Exception as e:
            logger.error(f"加载加密密钥文件失败: {e}")
            logger.warning("回退到环境变量模式")
            self.source = SecretSource.ENV_VAR
            self._encrypted_data = None
    
    def get_role_password(self, role_name: str) -> Optional[str]:
        """
        获取角色密码
        
        Args:
            role_name: 角色名称（例如：'PLANNING_MANAGER', 'SYSTEM_ADMIN'）
            
        Returns:
            角色密码，如果不存在则返回None
        """
        cache_key = f"ROLE_{role_name}_PASSWORD"
        
        # 检查缓存
        if cache_key in self._cache:
            return self._cache[cache_key]
        
        password = None
        
        if self.source == SecretSource.VAULT:
            # 从 Vault 读取
            password = self._get_from_vault(role_name, 'password')
        elif self.source == SecretSource.ENCRYPTED_FILE:
            # 从加密文件读取
            if self._encrypted_data:
                password = self._encrypted_data.get(cache_key)
                if not password:
                    # 尝试小写key
                    password = self._encrypted_data.get(cache_key.lower())
        else:
            # 从环境变量读取
            password = os.getenv(cache_key)
        
        # 缓存密码
        if password:
            self._cache[cache_key] = password
        else:
            logger.warning(f"未找到角色密码: {role_name} (来源: {self.source.value})")
        
        return password
    
    def get_role_username(self, role_name: str) -> Optional[str]:
        """
        获取角色用户名
        
        Args:
            role_name: 角色名称（例如：'PLANNING_MANAGER'）
            
        Returns:
            角色用户名，如果不存在则使用默认值
        """
        cache_key = f"ROLE_{role_name}_USERNAME"
        
        if cache_key in self._cache:
            return self._cache[cache_key]
        
        username = None
        
        if self.source == SecretSource.VAULT:
            # 从 Vault 读取，如果没有则使用默认值
            username = self._get_from_vault(role_name, 'username')
        elif self.source == SecretSource.ENCRYPTED_FILE:
            if self._encrypted_data:
                username = self._encrypted_data.get(cache_key)
        else:
            username = os.getenv(cache_key)
        
        # 如果用户名不存在，使用默认值（role_角色名小写）
        if not username:
            username = f"role_{role_name.lower()}"
        
        self._cache[cache_key] = username
        return username
    
    def _get_from_vault(self, role_name: str, field: str) -> Optional[str]:
        """
        从 Vault 获取密钥
        
        Args:
            role_name: 角色名称（例如：'PLANNING_MANAGER'）
            field: 字段名（'username' 或 'password'）
            
        Returns:
            密钥值，如果不存在则返回None
        """
        if not self._vault_client:
            return None
        
        try:
            # Vault 路径：secret/data/db-roles/{role_name}
            # 角色名称映射：PLANNING_MANAGER -> planning_manager
            vault_role_name = role_name.lower()
            
            # 默认使用 KV v2 存储引擎
            # vault kv put secret/db-roles/planning_manager ... 实际存储路径是 secret/data/db-roles/planning_manager
            # 但读取时，hvac API 需要的是挂载路径下的路径：db-roles/planning_manager
            vault_mount_point = os.getenv('VAULT_MOUNT_POINT', 'secret')
            secret_path = f'db-roles/{vault_role_name}'
            
            try:
                # 尝试使用 KV v2 API
                # read_secret_version 的第一个参数是挂载点，第二个是路径
                response = self._vault_client.secrets.kv.v2.read_secret_version(
                    mount_point=vault_mount_point,
                    path=secret_path
                )
                if response and 'data' in response:
                    data = response['data'].get('data', {})
                    return data.get(field)
            except Exception as e1:
                # 如果 KV v2 失败，尝试 KV v1 API
                try:
                    response = self._vault_client.secrets.kv.v1.read_secret(
                        mount_point=vault_mount_point,
                        path=secret_path
                    )
                    if response and 'data' in response:
                        return response['data'].get(field)
                except Exception as e2:
                    logger.debug(f"KV v2 失败: {e1}, KV v1 失败: {e2}")
                    pass
            
            logger.warning(f"Vault 中未找到密钥: {secret_path}/{field}")
            return None
        except Exception as e:
            logger.error(f"从 Vault 读取密钥失败: {e}")
            return None

    def get_app_config(self, key: str) -> Optional[str]:
        """
        从 Vault 的 app-config 路径获取应用配置（如 DEEPSEEK_API_KEY、SECRET_KEY）
        Path: secret/data/app-config
        """
        cache_key = f"APP_CONFIG_{key}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        value = None
        if self.source == SecretSource.VAULT and self._vault_client:
            try:
                mount_point = os.getenv('VAULT_MOUNT_POINT', 'secret')
                res = self._vault_client.secrets.kv.v2.read_secret_version(
                    mount_point=mount_point, path='app-config'
                )
                if res and 'data' in res:
                    data = res['data'].get('data', {})
                    # 支持 snake_case 和 小写
                    value = data.get(key) or data.get(key.lower())
            except Exception as e:
                logger.debug(f"从 Vault app-config 读取 {key} 失败: {e}")
        elif self.source == SecretSource.ENCRYPTED_FILE and self._encrypted_data:
            value = self._encrypted_data.get(key) or self._encrypted_data.get(f"APP_CONFIG_{key}")

        if value:
            self._cache[cache_key] = value
        return value


# 全局密钥管理器实例（延迟初始化）
_secret_manager_instance: Optional[SecretManager] = None


def get_secret_manager() -> SecretManager:
    """获取全局密钥管理器实例（单例模式）"""
    global _secret_manager_instance
    if _secret_manager_instance is None:
        _secret_manager_instance = SecretManager()
    return _secret_manager_instance


def reload_secrets():
    """重新加载密钥（用于密码轮换后）"""
    global _secret_manager_instance
    _secret_manager_instance = None
    return get_secret_manager()
