from abc import ABC, abstractmethod
from pathlib import Path
from typing import Generic, TypeVar

ResultT = TypeVar("ResultT")


class BaseExtractor(ABC, Generic[ResultT]):
    """File-format adapter contract for future Excel and CSV extraction."""

    @abstractmethod
    def supports(self, path: Path) -> bool:
        raise NotImplementedError

    @abstractmethod
    def extract(self, path: Path) -> ResultT:
        raise NotImplementedError

