from abc import ABC, abstractmethod
from typing import Any


class AIAssistantProvider(ABC):
    """Optional advisory provider. It must never mutate validation results."""

    @property
    @abstractmethod
    def is_available(self) -> bool:
        raise NotImplementedError

    @abstractmethod
    def suggest_mapping(self, context: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError

