from abc import ABC, abstractmethod
from collections.abc import Sequence
from typing import Generic, TypeVar

ContextT = TypeVar("ContextT")
DiscrepancyT = TypeVar("DiscrepancyT")


class BaseValidator(ABC, Generic[ContextT, DiscrepancyT]):
    """Pluggable validation contract. Each implementation owns one concern."""

    @property
    @abstractmethod
    def rule_id(self) -> str:
        raise NotImplementedError

    @abstractmethod
    def validate(self, context: ContextT) -> Sequence[DiscrepancyT]:
        raise NotImplementedError

