from fastapi import APIRouter, Depends
from app.dependencies import get_current_active_user

router = APIRouter()

@router.get("/stats")
async def get_summary_stats(current_user = Depends(get_current_active_user)):
    return {"message": "Summary statistics skeleton"}
