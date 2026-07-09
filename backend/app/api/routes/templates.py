from fastapi import APIRouter

from app.models.template_models import MappingTemplate
from app.services.template_service import TemplateService

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("/capabilities")
async def template_capabilities() -> dict[str, str]:
    return {"status": "ready"}


@router.get("", response_model=list[MappingTemplate])
async def list_templates() -> list[MappingTemplate]: return TemplateService().list()


@router.post("", response_model=MappingTemplate)
async def save_template(template: MappingTemplate) -> MappingTemplate: return TemplateService().save(template)


@router.post("/{template_id}/duplicate", response_model=MappingTemplate)
async def duplicate_template(template_id: str) -> MappingTemplate: return TemplateService().duplicate(template_id)


@router.delete("/{template_id}", status_code=204)
async def delete_template(template_id: str) -> None: TemplateService().delete(template_id)
