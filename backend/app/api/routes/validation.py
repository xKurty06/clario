from fastapi import APIRouter

from app.models.validation_models import ValidationRequest, ValidationResult
from app.services.validation_service import run_validation
from app.repositories.session_repository import SessionRepository

router = APIRouter(prefix="/validation", tags=["validation"])


@router.get("/capabilities")
async def validation_capabilities() -> dict[str, str]:
    return {"status": "ready", "matching": "strict"}


@router.post("/run", response_model=ValidationResult)
async def validate(request: ValidationRequest) -> ValidationResult:
    result = run_validation(request)
    file_names = sorted({row.source_file_name for row in request.reference_rows + request.comparison_rows + request.bidder_rows + request.abstract_rows})
    SessionRepository().save(result, file_names)
    return result


@router.get("/recent")
async def recent_sessions() -> list[dict[str, object]]:
    return SessionRepository().list_recent()
