from typing import Any

from app.ai_assistant.interface import AIAssistantProvider


class DisabledAIAssistant(AIAssistantProvider):
    @property
    def is_available(self) -> bool:
        return False

    def suggest_mapping(self, context: dict[str, Any]) -> dict[str, Any]:
        del context
        return {"suggestions": [], "provider": "disabled"}

