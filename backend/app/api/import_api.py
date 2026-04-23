from fastapi import APIRouter, Depends, UploadFile, File
from app.dependencies import get_current_active_user

router = APIRouter()

@router.post("/batch")
async def batch_import(file: UploadFile = File(...), current_user = Depends(get_current_active_user)):
    return {"message": "Batch import skeleton", "filename": file.filename}
