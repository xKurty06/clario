import json
from datetime import datetime, timezone
from uuid import uuid4

from app.database.connection import database
from app.models.template_models import MappingTemplate


class TemplateRepository:
    def list(self) -> list[MappingTemplate]:
        with database() as connection:
            rows = connection.execute("SELECT payload FROM templates ORDER BY updated_at DESC").fetchall()
        return [MappingTemplate.model_validate_json(row["payload"]) for row in rows]

    def get(self, template_id: str) -> MappingTemplate | None:
        with database() as connection:
            row = connection.execute("SELECT payload FROM templates WHERE id = ?", (template_id,)).fetchone()
        return MappingTemplate.model_validate_json(row["payload"]) if row else None

    def save(self, template: MappingTemplate) -> MappingTemplate:
        now = datetime.now(timezone.utc).isoformat()
        saved = template.model_copy(update={"id": template.id or uuid4().hex})
        with database() as connection:
            connection.execute("""INSERT INTO templates(id,name,file_role,payload,created_at,updated_at)
                VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,file_role=excluded.file_role,payload=excluded.payload,updated_at=excluded.updated_at""",
                (saved.id, saved.name, saved.file_role, saved.model_dump_json(), now, now))
        return saved

    def delete(self, template_id: str) -> bool:
        with database() as connection:
            cursor = connection.execute("DELETE FROM templates WHERE id = ?", (template_id,))
        return cursor.rowcount > 0
