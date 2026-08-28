import json
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.models.validation_models import ValidationRequest, ValidationResult
from app.services.validation_service import run_validation
from app.repositories.session_repository import SessionRepository

router = APIRouter(prefix="/validation", tags=["validation"])


class SessionRenameRequest(BaseModel):
    project_name: str = Field(min_length=1, max_length=160)


@router.get("/capabilities")
async def validation_capabilities() -> dict[str, str]:
    return {"status": "ready", "matching": "strict", "workflow": "comparison_builder"}


@router.post("/run", response_model=ValidationResult)
async def validate(request: ValidationRequest) -> ValidationResult:
    unconfirmed = [source.name for source in request.data_sources if not source.row_setup_confirmed]
    if unconfirmed:
        names = ", ".join(unconfirmed[:3])
        suffix = f" and {len(unconfirmed) - 3} more" if len(unconfirmed) > 3 else ""
        raise HTTPException(
            status_code=400,
            detail=f"Confirm the header row and first data row for {names}{suffix} before running validation.",
        )

    result = run_validation(request)
    SessionRepository().save(result, result.file_names, request)
    return result


@router.get("/recent")
async def recent_sessions() -> list[dict[str, object]]:
    return SessionRepository().list_recent()


@router.get("/sessions/{session_id}")
async def get_session_state(session_id: str) -> dict[str, Any]:
    state = SessionRepository().get_state(session_id)
    if state is None:
        raise HTTPException(status_code=404, detail="This session cannot be reopened because its saved validation result is missing.")
    return state


@router.put("/sessions/{session_id}")
async def rename_session(session_id: str, request: SessionRenameRequest) -> dict[str, str]:
    project_name = request.project_name.strip()
    if not project_name:
        raise HTTPException(status_code=422, detail="Session name cannot be blank.")
    try:
        renamed = SessionRepository().rename(session_id, project_name)
    except (OSError, ValueError, json.JSONDecodeError) as cause:
        raise HTTPException(status_code=500, detail="The session could not be renamed.") from cause
    if not renamed:
        raise HTTPException(status_code=404, detail="Session not found.")
    return {"status": "renamed", "project_name": project_name}


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(session_id: str) -> None:
    try:
        deleted = SessionRepository().delete(session_id)
    except (OSError, ValueError) as cause:
        raise HTTPException(status_code=500, detail="The session could not be deleted.") from cause
    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found.")
