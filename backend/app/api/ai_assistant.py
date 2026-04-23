from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional, Literal
from app.database import get_db
from app.dependencies import get_current_active_user
from app.services.ai_assistant_service import AIAssistantService
from pydantic import BaseModel

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    history: List[Dict[str, str]] = []
    context: Optional[Dict[str, Any]] = None


class FeedbackRequest(BaseModel):
    log_id: int
    feedback: Literal["like", "dislike"]

@router.post("/chat")
async def chat_with_assistant(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    service = AIAssistantService(db)
    try:
        response = await service.chat(
            user_id=current_user.id,
            message=request.message,
            history=request.history,
            context=request.context
        )
        return response
    except HTTPException:
        raise
    except ValueError as e:
        detail = str(e)
        status_code = 429 if "次数已用完" in detail else 400
        raise HTTPException(status_code=status_code, detail=detail)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/usage")
async def get_usage(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    service = AIAssistantService(db)
    return service.get_usage(current_user.id)


@router.post("/feedback")
async def submit_feedback(
    request: FeedbackRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    service = AIAssistantService(db)
    try:
        service.submit_feedback(current_user.id, request.log_id, request.feedback)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/query-log")
async def get_query_log(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    service = AIAssistantService(db)
    return service.get_query_log(current_user.id, page=page, page_size=page_size, days=days)

@router.get("/history")
async def get_chat_history(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    service = AIAssistantService(db)
    return service.get_user_chat_history(current_user.id)
