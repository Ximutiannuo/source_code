"""
认证服务 - JWT token生成和验证
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from app.config import settings
from app.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """创建JWT访问令牌"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict]:
    """解码JWT令牌"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        token = token.strip()
        if not token:
            return None
        
        if token.startswith('Bearer '):
            token = token[7:].strip()
        
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        # 生产环境下不再记录详细错误，保持日志精简
        return None
    except Exception as e:
        logger.error(f"Token decode error: {str(e)}")
        return None


def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
    """验证用户"""
    user = db.query(User).filter(User.username == username).first()
    if not user:
        return None
    if not user.is_active:
        return None
    if not user.check_password(password):
        return None
    
    # 更新最后登录时间
    user.last_login = datetime.now(timezone.utc)
    db.commit()
    
    return user


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    """根据用户名获取用户"""
    return db.query(User).filter(User.username == username).first()


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    """根据ID获取用户（包含角色信息）"""
    from sqlalchemy.orm import selectinload
    # 确保加载角色关系（User模型中roles使用lazy="selectin"，会自动加载，但这里显式确保）
    return db.query(User).options(selectinload(User.roles)).filter(User.id == user_id).first()
