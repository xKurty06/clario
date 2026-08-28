from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import files, reports, templates, validation
from app.config.constants import API_PREFIX, APP_DISPLAY_NAME, APP_VERSION
from app.config.settings import get_settings
from app.core.exceptions import AppError
from app.core.logging import configure_logging
from app.database.migrations import migrate


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    configure_logging(settings.log_level)
    migrate()
    yield


app = FastAPI(
    title=APP_DISPLAY_NAME,
    version=APP_VERSION,
    docs_url="/docs",
    redoc_url=None,
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:1420", "http://localhost:1420", "http://127.0.0.1:1421", "http://localhost:1421", "tauri://localhost", "http://tauri.localhost"],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1):\d+$",
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Accept", "Cache-Control", "Pragma"],
    expose_headers=["Content-Disposition", "X-Report-Filename", "X-Report-Path"],
)


@app.exception_handler(AppError)
async def handle_app_error(request: Request, error: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=error.status_code,
        content={"code": error.code, "detail": error.message, "path": request.url.path},
    )


@app.get("/health", tags=["system"])
async def health() -> dict[str, str]:
    return {"status": "ok", "service": APP_DISPLAY_NAME, "version": APP_VERSION}


app.include_router(files.router, prefix=API_PREFIX)
app.include_router(templates.router, prefix=API_PREFIX)
app.include_router(validation.router, prefix=API_PREFIX)
app.include_router(reports.router, prefix=API_PREFIX)
