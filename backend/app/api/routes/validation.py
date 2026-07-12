from fastapi import APIRouter, HTTPException

from app.models.validation_models import ValidationRequest, ValidationResult
from app.services.validation_service import run_validation
from app.repositories.session_repository import SessionRepository

router = APIRouter(prefix="/validation", tags=["validation"])


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
    SessionRepository().save(result, result.file_names)
    return result


@router.get("/recent")
async def recent_sessions() -> list[dict[str, object]]:
    return SessionRepository().list_recent()
