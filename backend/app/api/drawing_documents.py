import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_active_user
from app.services.drawing_document_service import DrawingDocumentService

router = APIRouter()


class MaterialLinkRead(BaseModel):
    id: int
    code: str
    name: str
    drawing_no: Optional[str] = None

    class Config:
        from_attributes = True


class BOMHeaderLinkRead(BaseModel):
    id: int
    product_code: str
    version: str
    bom_type: Optional[str] = None
    cad_document_no: Optional[str] = None


class DrawingDocumentRead(BaseModel):
    id: int
    document_number: str
    document_name: str
    document_type: str
    source_type: str
    status: str
    version: Optional[str] = None
    revision: Optional[str] = None
    discipline: Optional[str] = None
    cad_software: Optional[str] = None
    tags: Optional[str] = None
    description: Optional[str] = None
    product_code: Optional[str] = None
    material_id: Optional[int] = None
    material_code: Optional[str] = None
    bom_header_id: Optional[int] = None
    file_name: str
    file_ext: Optional[str] = None
    mime_type: Optional[str] = None
    file_size: int = 0
    source_relative_path: Optional[str] = None
    ocr_status: Optional[str] = None
    ocr_text: Optional[str] = None
    uploader_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    download_url: str
    material: Optional[MaterialLinkRead] = None
    bom_header: Optional[BOMHeaderLinkRead] = None


class DrawingDocumentUpdate(BaseModel):
    document_number: Optional[str] = None
    document_name: Optional[str] = None
    document_type: Optional[str] = None
    source_type: Optional[str] = None
    status: Optional[str] = None
    version: Optional[str] = None
    revision: Optional[str] = None
    discipline: Optional[str] = None
    cad_software: Optional[str] = None
    tags: Optional[str] = None
    description: Optional[str] = None
    product_code: Optional[str] = None
    material_code: Optional[str] = None
    bom_header_id: Optional[int] = None
    source_relative_path: Optional[str] = None
    ocr_status: Optional[str] = None
    ocr_text: Optional[str] = None


class DrawingBatchImportItemRead(BaseModel):
    file_name: str
    relative_path: Optional[str] = None
    document_number: Optional[str] = None
    action: str
    message: str
    validation_status: str
    document: Optional[DrawingDocumentRead] = None


class DrawingBatchImportResultRead(BaseModel):
    total: int
    imported: int
    replaced: int
    skipped: int
    results: List[DrawingBatchImportItemRead]


def _payload_to_dict(model: BaseModel) -> Dict[str, Any]:
    try:
        return model.model_dump(exclude_unset=True)
    except AttributeError:
        return model.dict(exclude_unset=True)


@router.get("/", response_model=List[DrawingDocumentRead])
async def list_drawing_documents(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    document_type: Optional[str] = None,
    source_type: Optional[str] = None,
    material_code: Optional[str] = None,
    product_code: Optional[str] = None,
    bom_header_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    return DrawingDocumentService.list_documents(
        db=db,
        skip=skip,
        limit=limit,
        search=search,
        document_type=document_type,
        source_type=source_type,
        material_code=material_code,
        product_code=product_code,
        bom_header_id=bom_header_id,
    )


@router.post("/upload", response_model=DrawingDocumentRead)
async def upload_drawing_document(
    document_number: str = Form(...),
    document_name: str = Form(...),
    document_type: str = Form("CAD"),
    source_type: str = Form("DESIGN_DOC"),
    status: str = Form("RELEASED"),
    version: Optional[str] = Form(None),
    revision: Optional[str] = Form(None),
    discipline: Optional[str] = Form(None),
    cad_software: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    product_code: Optional[str] = Form(None),
    material_code: Optional[str] = Form(None),
    bom_header_id: Optional[int] = Form(None),
    source_relative_path: Optional[str] = Form(None),
    ocr_status: Optional[str] = Form(None),
    ocr_text: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    payload = {
        "document_number": document_number,
        "document_name": document_name,
        "document_type": document_type,
        "source_type": source_type,
        "status": status,
        "version": version,
        "revision": revision,
        "discipline": discipline,
        "cad_software": cad_software,
        "tags": tags,
        "description": description,
        "product_code": product_code,
        "material_code": material_code,
        "bom_header_id": bom_header_id,
        "source_relative_path": source_relative_path,
        "ocr_status": ocr_status or ("PROCESSED" if ocr_text else "NONE"),
        "ocr_text": ocr_text,
    }
    uploader_name = getattr(current_user, "full_name", None) or getattr(current_user, "username", None)
    try:
        document = DrawingDocumentService.create_document(db, payload, file, uploader_name=uploader_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return DrawingDocumentService._serialize(document)


@router.post("/batch-import", response_model=DrawingBatchImportResultRead)
async def batch_import_drawing_documents(
    files: List[UploadFile] = File(...),
    relative_paths_json: Optional[str] = Form(None),
    source_type: str = Form("CAD_DIRECTORY"),
    status: str = Form("RELEASED"),
    version: Optional[str] = Form(None),
    revision: Optional[str] = Form(None),
    discipline: Optional[str] = Form(None),
    cad_software: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    product_code: Optional[str] = Form(None),
    material_code: Optional[str] = Form(None),
    bom_header_id: Optional[int] = Form(None),
    replace_existing: bool = Form(False),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    relative_paths: List[Optional[str]] = []
    if relative_paths_json:
        try:
            loaded = json.loads(relative_paths_json)
            if isinstance(loaded, list):
                relative_paths = [str(item) if item is not None else None for item in loaded]
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=400, detail="Invalid relative_paths_json") from exc

    uploader_name = getattr(current_user, "full_name", None) or getattr(current_user, "username", None)
    return DrawingDocumentService.batch_import_documents(
        db=db,
        files=files,
        relative_paths=relative_paths,
        defaults={
            "source_type": source_type,
            "status": status,
            "version": version,
            "revision": revision,
            "discipline": discipline,
            "cad_software": cad_software,
            "tags": tags,
            "description": description,
            "product_code": product_code,
            "material_code": material_code,
            "bom_header_id": bom_header_id,
        },
        uploader_name=uploader_name,
        replace_existing=replace_existing,
    )


@router.get("/by-bom/{bom_id}", response_model=List[DrawingDocumentRead])
async def list_drawings_by_bom(
    bom_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    return DrawingDocumentService.get_documents_for_bom(db, bom_id)


@router.get("/{document_id}", response_model=DrawingDocumentRead)
async def get_drawing_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    document = DrawingDocumentService.get_document(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Drawing document not found")
    return DrawingDocumentService._serialize(document)


@router.patch("/{document_id}", response_model=DrawingDocumentRead)
async def update_drawing_document(
    document_id: int,
    document_in: DrawingDocumentUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    try:
        document = DrawingDocumentService.update_document(db, document_id, _payload_to_dict(document_in))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not document:
        raise HTTPException(status_code=404, detail="Drawing document not found")
    return DrawingDocumentService._serialize(document)


@router.get("/{document_id}/download")
async def download_drawing_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    document = DrawingDocumentService.get_document(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Drawing document not found")

    absolute_path = DrawingDocumentService.resolve_file_path(document)
    if not absolute_path.exists():
        raise HTTPException(status_code=404, detail="Stored file not found")

    return FileResponse(
        path=absolute_path,
        media_type=document.mime_type or "application/octet-stream",
        filename=document.file_name,
    )
