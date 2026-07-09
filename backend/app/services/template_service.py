from app.core.exceptions import AppError
from app.models.template_models import MappingTemplate
from app.repositories.template_repository import TemplateRepository


class TemplateService:
    def __init__(self, repository: TemplateRepository | None = None) -> None:
        self.repository = repository or TemplateRepository()

    def list(self) -> list[MappingTemplate]: return self.repository.list()
    def save(self, template: MappingTemplate) -> MappingTemplate: return self.repository.save(template)
    def delete(self, template_id: str) -> None:
        if not self.repository.delete(template_id):
            raise AppError("Template not found.", "TEMPLATE_NOT_FOUND", 404)
    def duplicate(self, template_id: str) -> MappingTemplate:
        source = self.repository.get(template_id)
        if not source: raise AppError("Template not found.", "TEMPLATE_NOT_FOUND", 404)
        return self.repository.save(source.model_copy(update={"id": None, "name": f"{source.name} copy"}))
