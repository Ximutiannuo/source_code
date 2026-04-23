"""
Mechanical Manufacturing Platform API entrypoint.
"""

import logging
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import auth, departments, equipment_mgmt, facility, facility_type
from app.api import manufacturing_exchange, manufacturing_orders, permissions, process_template, quality as quality_api, users
from app.database import load_env_with_fallback
from app.utils.logging import setup_logging

if not os.getenv('DATABASE_URL'):
    load_env_with_fallback()

setup_logging(level=logging.INFO)
logger = logging.getLogger(__name__)

# Ensure core manufacturing models are imported before metadata initialization.
from app.models import bom, ecn, procurement, user  # noqa: E402,F401

app = FastAPI(
    title="Manufacturing Management Platform API",
    description="Mechanical manufacturing management platform API",
    version="3.0.0",
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception: %s %s - %s", request.method, request.url, exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"message": "Internal Server Error", "detail": str(exc)},
    )


@app.on_event("startup")
async def startup_event():
    try:
        from app.database import Base, get_default_engine
        from app.services.schema_compat_service import ensure_schema_compatibility

        db_engine = get_default_engine()
        Base.metadata.create_all(bind=db_engine)
        ensure_schema_compatibility(db_engine)
        logger.info("Database schema initialized")
    except Exception as exc:
        logger.error("Application startup failed: %s", exc, exc_info=True)


cors_origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["认证"])
app.include_router(users.router, prefix="/api/users", tags=["用户管理"])
app.include_router(departments.router, prefix="/api", tags=["部门管理"])
app.include_router(permissions.router, prefix="/api/permissions", tags=["权限管理"])

app.include_router(facility.router, prefix="/api/facility", tags=["工位与设施"])
app.include_router(facility_type.router, prefix="/api/facility-type", tags=["设施类型"])
app.include_router(process_template.router, prefix="/api/process-template", tags=["工艺模板"])
app.include_router(manufacturing_orders.router, prefix="/api/manufacturing", tags=["制造订单"])
app.include_router(manufacturing_exchange.router, prefix="/api/manufacturing", tags=["制造数据交换"])
app.include_router(quality_api.router, prefix="/api/quality", tags=["质量管理"])
app.include_router(equipment_mgmt.router, prefix="/api/equipment", tags=["设备管理"])

try:
    from app.api import plm

    app.include_router(plm.router, prefix="/api/plm", tags=["PLM"])
except ImportError:
    logger.warning("PLM module not available, skipped registration")


@app.get("/")
async def root():
    return {"message": "Manufacturing Platform API", "version": "3.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down application")
