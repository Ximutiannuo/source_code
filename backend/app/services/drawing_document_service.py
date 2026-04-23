import mimetypes
import os
import re
import shutil
import uuid
from itertools import zip_longest
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

from fastapi import UploadFile
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.bom import BOMHeader, BOMItem, Material
from app.models.drawing_document import DrawingDocument


class DrawingDocumentService:
    SOLIDWORKS_EXTENSIONS = {".sldasm", ".sldprt", ".slddrw"}
    CAD_EXTENSIONS = {".dwg", ".dxf"}
    STEP_EXTENSIONS = {".step", ".stp", ".igs", ".iges"}

    @staticmethod
    def _backend_dir() -> Path:
        return Path(__file__).resolve().parents[2]

    @staticmethod
    def _storage_root() -> Path:
        path = DrawingDocumentService._backend_dir() / "uploads" / "drawing_documents"
        path.mkdir(parents=True, exist_ok=True)
        return path

    @staticmethod
    def _normalize_text(value: Any) -> Optional[str]:
        if value is None:
            return None
        normalized = str(value).strip()
        return normalized or None

    @staticmethod
    def _sanitize_extension(filename: str) -> str:
        suffix = Path(filename or "").suffix.strip().lower()
        return suffix[:20]

    @staticmethod
    def _infer_document_type(file_name: str) -> str:
        extension = DrawingDocumentService._sanitize_extension(file_name)
        if extension in DrawingDocumentService.SOLIDWORKS_EXTENSIONS:
            return "SOLIDWORKS"
        if extension in DrawingDocumentService.CAD_EXTENSIONS:
            return "CAD"
        if extension in DrawingDocumentService.STEP_EXTENSIONS:
            return "STEP"
        if extension == ".pdf":
            return "PDF"
        if extension:
            return extension.lstrip(".").upper()
        return "CAD"

    @staticmethod
    def _infer_cad_software(file_name: str) -> Optional[str]:
        extension = DrawingDocumentService._sanitize_extension(file_name)
        if extension in DrawingDocumentService.SOLIDWORKS_EXTENSIONS:
            return "SolidWorks"
        if extension in DrawingDocumentService.CAD_EXTENSIONS:
            return "AutoCAD"
        if extension in DrawingDocumentService.STEP_EXTENSIONS:
            return "Neutral CAD"
        return None

    @staticmethod
    def _extract_filename_metadata(file_name: str) -> Dict[str, Optional[str]]:
        stem = Path(file_name or "").stem.strip()
        working = stem

        revision = None
        revision_match = re.search(r"(?i)(?:^|[_\-\s])(rev|revision|r)[_\-\s]*([A-Za-z0-9]+)$", working)
        if revision_match:
            revision = revision_match.group(2).upper()
            working = working[: revision_match.start()].rstrip(" _-")

        version = None
        version_match = re.search(r"(?i)(?:^|[_\-\s])(v\d+(?:\.\d+)*)$", working)
        if version_match:
            version = version_match.group(1).lower()
            working = working[: version_match.start()].rstrip(" _-")

        document_number = working or stem or file_name
        return {
            "document_number": document_number,
            "document_name": document_number,
            "version": version,
            "revision": revision,
            "document_type": DrawingDocumentService._infer_document_type(file_name),
            "cad_software": DrawingDocumentService._infer_cad_software(file_name),
        }

    @staticmethod
    def _build_storage_path(file_name: str) -> str:
        suffix = DrawingDocumentService._sanitize_extension(file_name)
        shard = Path(uuid.uuid4().hex[:2]) / uuid.uuid4().hex[2:4]
        target_dir = DrawingDocumentService._storage_root() / shard
        target_dir.mkdir(parents=True, exist_ok=True)
        stored_name = f"{uuid.uuid4().hex}{suffix}"
        absolute_path = target_dir / stored_name
        return str(absolute_path.relative_to(DrawingDocumentService._backend_dir()))

    @staticmethod
    def _save_upload(file: UploadFile) -> Dict[str, Any]:
        relative_path = DrawingDocumentService._build_storage_path(file.filename or "document.bin")
        absolute_path = DrawingDocumentService._backend_dir() / relative_path
        with absolute_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        mime_type = file.content_type or mimetypes.guess_type(file.filename or "")[0] or "application/octet-stream"
        return {
            "file_name": file.filename or os.path.basename(relative_path),
            "file_ext": DrawingDocumentService._sanitize_extension(file.filename or ""),
            "mime_type": mime_type,
            "file_size": absolute_path.stat().st_size,
            "file_path": relative_path.replace("\\", "/"),
        }

    @staticmethod
    def _delete_stored_file(relative_path: Optional[str]) -> None:
        if not relative_path:
            return
        absolute_path = DrawingDocumentService._backend_dir() / relative_path
        try:
            if absolute_path.exists():
                absolute_path.unlink()
        except OSError:
            pass

    @staticmethod
    def _version_tokens(value: Optional[str]) -> List[Any]:
        normalized = DrawingDocumentService._normalize_text(value)
        if not normalized:
            return []
        tokens: List[Any] = []
        for token in re.findall(r"\d+|[A-Za-z]+", normalized.upper()):
            tokens.append(int(token) if token.isdigit() else token)
        return tokens

    @staticmethod
    def _compare_text_versions(left: Optional[str], right: Optional[str]) -> int:
        left_tokens = DrawingDocumentService._version_tokens(left)
        right_tokens = DrawingDocumentService._version_tokens(right)

        for left_token, right_token in zip_longest(left_tokens, right_tokens, fillvalue=None):
            if left_token is None:
                return -1
            if right_token is None:
                return 1
            if left_token == right_token:
                continue
            return 1 if left_token > right_token else -1
        return 0

    @staticmethod
    def _compare_payload_version_to_document(payload: Dict[str, Any], document: DrawingDocument) -> int:
        version_compare = DrawingDocumentService._compare_text_versions(payload.get("version"), document.version)
        if version_compare != 0:
            return version_compare
        return DrawingDocumentService._compare_text_versions(payload.get("revision"), document.revision)

    @staticmethod
    def _validate_version_replacement(
        db: Session,
        payload: Dict[str, Any],
        exclude_document_id: Optional[int] = None,
        allow_same_version_replace: bool = False,
    ) -> Dict[str, Any]:
        document_number = DrawingDocumentService._normalize_text(payload.get("document_number"))
        document_type = DrawingDocumentService._normalize_text(payload.get("document_type")) or "CAD"
        version = DrawingDocumentService._normalize_text(payload.get("version"))
        revision = DrawingDocumentService._normalize_text(payload.get("revision"))

        if not document_number:
            return {
                "status": "VALID",
                "can_import": True,
                "warnings": [],
                "errors": [],
                "exact_match": None,
                "latest_document": None,
                "message": "No document number provided",
            }

        query = db.query(DrawingDocument).filter(
            DrawingDocument.document_number == document_number,
            DrawingDocument.document_type == document_type,
        )
        if exclude_document_id:
            query = query.filter(DrawingDocument.id != exclude_document_id)
        existing_documents = query.order_by(DrawingDocument.id.desc()).all()

        exact_match = None
        latest_document = None
        for document in existing_documents:
            if (
                DrawingDocumentService._normalize_text(document.version) == version
                and DrawingDocumentService._normalize_text(document.revision) == revision
            ):
                exact_match = document
            if latest_document is None:
                latest_document = document
                continue
            if DrawingDocumentService._compare_payload_version_to_document(
                {"version": document.version, "revision": document.revision},
                latest_document,
            ) > 0:
                latest_document = document

        warnings: List[str] = []
        errors: List[str] = []

        if exact_match:
            if allow_same_version_replace:
                warnings.append(
                    f"资料库中已存在相同图号与版本，将替换现有文件：{exact_match.file_name}"
                )
            else:
                errors.append(
                    f"已存在相同图号与版本的图纸：{document_number} {version or '-'} / {revision or '-'}"
                )
        elif latest_document:
            compare_result = DrawingDocumentService._compare_payload_version_to_document(payload, latest_document)
            if compare_result < 0:
                errors.append(
                    f"候选版本低于资料库最新版本：{latest_document.version or '-'} / {latest_document.revision or '-'}"
                )
            elif compare_result > 0:
                warnings.append(
                    f"检测到高版本导入，将作为 {latest_document.version or '-'} / {latest_document.revision or '-'} 的替换候选"
                )

        status = "ERROR" if errors else "WARNING" if warnings else "VALID"
        message = errors[0] if errors else warnings[0] if warnings else "Version validation passed"
        return {
            "status": status,
            "can_import": not errors,
            "warnings": warnings,
            "errors": errors,
            "exact_match": exact_match,
            "latest_document": latest_document,
            "message": message,
        }

    @staticmethod
    def _resolve_links(db: Session, payload: Dict[str, Any]) -> Dict[str, Any]:
        material_code = (payload.get("material_code") or "").strip() or None
        product_code = (payload.get("product_code") or "").strip() or None
        bom_header_id = payload.get("bom_header_id")
        document_number = (payload.get("document_number") or "").strip() or None

        material = None
        if material_code:
            material = db.query(Material).filter(Material.code == material_code).first()
        elif document_number:
            material = db.query(Material).filter(Material.drawing_no == document_number).first()
            if material:
                material_code = material.code

        if material:
            payload["material_id"] = material.id
            payload["material_code"] = material.code
        else:
            payload["material_id"] = None
            payload["material_code"] = material_code

        bom_header = None
        if bom_header_id:
            bom_header = db.query(BOMHeader).filter(BOMHeader.id == bom_header_id).first()
        elif product_code:
            bom_header = (
                db.query(BOMHeader)
                .filter(BOMHeader.product_code == product_code)
                .order_by(BOMHeader.is_active.desc(), BOMHeader.id.desc())
                .first()
            )
        elif document_number:
            bom_header = (
                db.query(BOMHeader)
                .filter(BOMHeader.cad_document_no == document_number)
                .order_by(BOMHeader.is_active.desc(), BOMHeader.id.desc())
                .first()
            )

        if bom_header:
            payload["bom_header_id"] = bom_header.id
            payload["product_code"] = payload.get("product_code") or bom_header.product_code
        else:
            payload["bom_header_id"] = None if bom_header_id is None else bom_header_id
            payload["product_code"] = product_code

        return payload

    @staticmethod
    def _apply_document_payload(document: DrawingDocument, payload: Dict[str, Any]) -> None:
        for field in [
            "document_number",
            "document_name",
            "document_type",
            "source_type",
            "status",
            "version",
            "revision",
            "discipline",
            "cad_software",
            "tags",
            "description",
            "product_code",
            "material_id",
            "material_code",
            "bom_header_id",
            "file_name",
            "file_ext",
            "mime_type",
            "file_size",
            "file_path",
            "source_relative_path",
            "ocr_status",
            "ocr_text",
            "uploader_name",
        ]:
            if field in payload:
                setattr(document, field, payload[field])

    @staticmethod
    def _serialize(document: DrawingDocument) -> Dict[str, Any]:
        return {
            "id": document.id,
            "document_number": document.document_number,
            "document_name": document.document_name,
            "document_type": document.document_type,
            "source_type": document.source_type,
            "status": document.status,
            "version": document.version,
            "revision": document.revision,
            "discipline": document.discipline,
            "cad_software": document.cad_software,
            "tags": document.tags,
            "description": document.description,
            "product_code": document.product_code,
            "material_id": document.material_id,
            "material_code": document.material_code,
            "bom_header_id": document.bom_header_id,
            "file_name": document.file_name,
            "file_ext": document.file_ext,
            "mime_type": document.mime_type,
            "file_size": int(document.file_size or 0),
            "source_relative_path": document.source_relative_path,
            "ocr_status": document.ocr_status,
            "ocr_text": document.ocr_text,
            "uploader_name": document.uploader_name,
            "created_at": document.created_at,
            "updated_at": document.updated_at,
            "download_url": f"/api/plm/drawings/{document.id}/download",
            "material": document.material,
            "bom_header": {
                "id": document.bom_header.id,
                "product_code": document.bom_header.product_code,
                "version": document.bom_header.version,
                "bom_type": document.bom_header.bom_type,
                "cad_document_no": document.bom_header.cad_document_no,
            }
            if document.bom_header
            else None,
        }

    @staticmethod
    def list_documents(
        db: Session,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        document_type: Optional[str] = None,
        source_type: Optional[str] = None,
        material_code: Optional[str] = None,
        product_code: Optional[str] = None,
        bom_header_id: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        query = db.query(DrawingDocument)

        if search:
            like_pattern = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    DrawingDocument.document_number.like(like_pattern),
                    DrawingDocument.document_name.like(like_pattern),
                    DrawingDocument.material_code.like(like_pattern),
                    DrawingDocument.product_code.like(like_pattern),
                    DrawingDocument.tags.like(like_pattern),
                    DrawingDocument.source_relative_path.like(like_pattern),
                )
            )
        if document_type:
            query = query.filter(DrawingDocument.document_type == document_type)
        if source_type:
            query = query.filter(DrawingDocument.source_type == source_type)
        if material_code:
            query = query.filter(DrawingDocument.material_code == material_code)
        if product_code:
            query = query.filter(DrawingDocument.product_code == product_code)
        if bom_header_id:
            query = query.filter(DrawingDocument.bom_header_id == bom_header_id)

        rows = query.order_by(DrawingDocument.updated_at.desc(), DrawingDocument.id.desc()).offset(skip).limit(limit).all()
        return [DrawingDocumentService._serialize(row) for row in rows]

    @staticmethod
    def get_document(db: Session, document_id: int) -> Optional[DrawingDocument]:
        return db.query(DrawingDocument).filter(DrawingDocument.id == document_id).first()

    @staticmethod
    def create_document(
        db: Session,
        payload: Dict[str, Any],
        file: UploadFile,
        uploader_name: Optional[str] = None,
    ) -> DrawingDocument:
        stored_file = DrawingDocumentService._save_upload(file)
        prepared_payload = DrawingDocumentService._resolve_links(db, {**payload, **stored_file})
        prepared_payload["uploader_name"] = uploader_name

        validation = DrawingDocumentService._validate_version_replacement(db, prepared_payload)
        if not validation["can_import"]:
            DrawingDocumentService._delete_stored_file(stored_file["file_path"])
            raise ValueError(validation["message"])

        document = DrawingDocument()
        DrawingDocumentService._apply_document_payload(document, prepared_payload)
        db.add(document)
        db.commit()
        db.refresh(document)
        return document

    @staticmethod
    def update_document(db: Session, document_id: int, payload: Dict[str, Any]) -> Optional[DrawingDocument]:
        document = DrawingDocumentService.get_document(db, document_id)
        if not document:
            return None

        next_payload = DrawingDocumentService._resolve_links(
            db,
            {
                "document_number": payload.get("document_number", document.document_number),
                "document_type": payload.get("document_type", document.document_type),
                "version": payload.get("version", document.version),
                "revision": payload.get("revision", document.revision),
                "material_code": payload.get("material_code", document.material_code),
                "product_code": payload.get("product_code", document.product_code),
                "bom_header_id": payload.get("bom_header_id", document.bom_header_id),
                **payload,
            },
        )

        validation = DrawingDocumentService._validate_version_replacement(
            db,
            next_payload,
            exclude_document_id=document_id,
        )
        if not validation["can_import"]:
            raise ValueError(validation["message"])

        DrawingDocumentService._apply_document_payload(document, next_payload)
        db.commit()
        db.refresh(document)
        return document

    @staticmethod
    def _replace_existing_binary(
        db: Session,
        document: DrawingDocument,
        payload: Dict[str, Any],
        file: UploadFile,
        uploader_name: Optional[str] = None,
    ) -> DrawingDocument:
        stored_file = DrawingDocumentService._save_upload(file)
        old_path = document.file_path
        prepared_payload = DrawingDocumentService._resolve_links(db, {**payload, **stored_file})
        prepared_payload["uploader_name"] = uploader_name or document.uploader_name

        DrawingDocumentService._apply_document_payload(document, prepared_payload)
        db.commit()
        db.refresh(document)

        if old_path != document.file_path:
            DrawingDocumentService._delete_stored_file(old_path)
        return document

    @staticmethod
    def batch_import_documents(
        db: Session,
        files: Sequence[UploadFile],
        relative_paths: Optional[Sequence[Optional[str]]] = None,
        defaults: Optional[Dict[str, Any]] = None,
        uploader_name: Optional[str] = None,
        replace_existing: bool = False,
    ) -> Dict[str, Any]:
        defaults = defaults or {}
        results: List[Dict[str, Any]] = []
        imported = 0
        replaced = 0
        skipped = 0

        for index, file in enumerate(files):
            relative_path = None
            if relative_paths and index < len(relative_paths):
                relative_path = DrawingDocumentService._normalize_text(relative_paths[index])

            inferred = DrawingDocumentService._extract_filename_metadata(file.filename or "")
            payload = {
                "document_number": defaults.get("document_number") or inferred["document_number"],
                "document_name": inferred["document_name"],
                "document_type": defaults.get("document_type") or inferred["document_type"],
                "source_type": defaults.get("source_type") or "CAD_DIRECTORY",
                "status": defaults.get("status") or "RELEASED",
                "version": defaults.get("version") or inferred["version"],
                "revision": defaults.get("revision") or inferred["revision"],
                "discipline": defaults.get("discipline"),
                "cad_software": defaults.get("cad_software") or inferred["cad_software"],
                "tags": defaults.get("tags"),
                "description": defaults.get("description"),
                "product_code": defaults.get("product_code"),
                "material_code": defaults.get("material_code"),
                "bom_header_id": defaults.get("bom_header_id"),
                "ocr_status": "NONE",
                "ocr_text": None,
                "source_relative_path": relative_path,
            }
            payload = DrawingDocumentService._resolve_links(db, payload)

            validation = DrawingDocumentService._validate_version_replacement(
                db,
                payload,
                allow_same_version_replace=replace_existing,
            )

            if not validation["can_import"]:
                skipped += 1
                results.append(
                    {
                        "file_name": file.filename or "",
                        "relative_path": relative_path,
                        "document_number": payload.get("document_number"),
                        "action": "skipped",
                        "message": validation["message"],
                        "validation_status": validation["status"],
                        "document": None,
                    }
                )
                continue

            if validation["exact_match"] is not None and replace_existing:
                document = DrawingDocumentService._replace_existing_binary(
                    db,
                    validation["exact_match"],
                    payload,
                    file,
                    uploader_name=uploader_name,
                )
                replaced += 1
                action = "replaced"
            else:
                document = DrawingDocumentService.create_document(
                    db,
                    payload,
                    file,
                    uploader_name=uploader_name,
                )
                imported += 1
                action = "imported"

            results.append(
                {
                    "file_name": file.filename or "",
                    "relative_path": relative_path,
                    "document_number": document.document_number,
                    "action": action,
                    "message": validation["message"],
                    "validation_status": validation["status"],
                    "document": DrawingDocumentService._serialize(document),
                }
            )

        return {
            "total": len(files),
            "imported": imported,
            "replaced": replaced,
            "skipped": skipped,
            "results": results,
        }

    @staticmethod
    def resolve_file_path(document: DrawingDocument) -> Path:
        return DrawingDocumentService._backend_dir() / str(document.file_path)

    @staticmethod
    def get_documents_for_bom(db: Session, bom_id: int) -> List[Dict[str, Any]]:
        header = db.query(BOMHeader).filter(BOMHeader.id == bom_id).first()
        if not header:
            return []

        bom_items = db.query(BOMItem).filter(BOMItem.header_id == bom_id).all()
        item_codes = {row.child_item_code for row in bom_items if row.child_item_code}
        mapped_document_ids = {row.drawing_document_id for row in bom_items if row.drawing_document_id}
        related_codes = {header.product_code, *item_codes}

        filters = [DrawingDocument.bom_header_id == bom_id, DrawingDocument.product_code == header.product_code]
        if related_codes:
            filters.append(DrawingDocument.material_code.in_(list(related_codes)))
        if mapped_document_ids:
            filters.append(DrawingDocument.id.in_(list(mapped_document_ids)))
        if header.cad_document_no:
            filters.append(DrawingDocument.document_number == header.cad_document_no)

        rows = (
            db.query(DrawingDocument)
            .filter(or_(*filters))
            .order_by(DrawingDocument.updated_at.desc(), DrawingDocument.id.desc())
            .all()
        )

        deduped: List[DrawingDocument] = []
        seen_ids = set()
        for row in rows:
            if row.id in seen_ids:
                continue
            seen_ids.add(row.id)
            deduped.append(row)
        return [DrawingDocumentService._serialize(row) for row in deduped]
