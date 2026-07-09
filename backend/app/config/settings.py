from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Centralized runtime settings; defaults remain safe for local desktop use."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="PROCUREMENT_VALIDATOR_",
        extra="ignore",
    )

    host: str = Field(default="127.0.0.1", pattern=r"^(127\.0\.0\.1|localhost)$")
    port: int = Field(default=8765, ge=1024, le=65535)
    log_level: str = "INFO"
    data_directory: Path = Path.home() / ".procurement-validator"

    @property
    def database_path(self) -> Path:
        return self.data_directory / "procurement-validator.sqlite3"

    @property
    def upload_directory(self) -> Path:
        return self.data_directory / "working-files"

    @property
    def report_directory(self) -> Path:
        return self.data_directory / "reports"


@lru_cache
def get_settings() -> Settings:
    return Settings()
