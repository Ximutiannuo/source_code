from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from app.database import get_db
from app.services import auth_service
from app.dependencies import get_current_active_user
from app.models.user import User
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()

class Token(BaseModel):
    access_token: str
    token_type: str

class UserRoleInfo(BaseModel):
    id: int
    name: str

class UserInfo(BaseModel):
    id: int
    username: str
    full_name: Optional[str]
    is_active: bool
    roles: List[UserRoleInfo]

@router.post("/login", response_model=Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = auth_service.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = auth_service.create_access_token(
        data={"sub": str(user.id)}
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserInfo)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "full_name": current_user.full_name,
        "is_active": current_user.is_active,
        "roles": [{"id": r.id, "name": r.name} for r in current_user.roles]
    }
