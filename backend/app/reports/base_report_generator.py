from abc import ABC, abstractmethod
from pathlib import Path
from typing import Generic, TypeVar

ReportDataT = TypeVar("ReportDataT")


class BaseReportGenerator(ABC, Generic[ReportDataT]):
    """Output adapter contract; generators consume existing validation results."""

    @abstractmethod
    def generate(self, data: ReportDataT, destination: Path) -> Path:
        raise NotImplementedError

