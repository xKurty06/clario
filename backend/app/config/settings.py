from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

CLARIO_DATA_DIRECTORY = Path.home() / ".clario"
CLARIO_DATABASE_NAME = "clario.sqlite3"


def default_data_directory() -> Path:
    return CLARIO_DATA_DIRECTORY


class Settings(BaseSettings):
    """Centralized runtime settings; defaults remain safe for local desktop use."""

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
        populate_by_name=True,
    )

    host: str = Field(
        default="127.0.0.1",
        pattern=r"^(127\.0\.0\.1|localhost)$",
        validation_alias=AliasChoices("CLARIO_HOST", "PROCUREMENT_VALIDATOR_HOST"),
    )
    port: int = Field(
        default=8765,
        ge=1024,
        le=65535,
        validation_alias=AliasChoices("CLARIO_PORT", "PROCUREMENT_VALIDATOR_PORT"),
    )
    log_level: str = Field(
        default="INFO",
        validation_alias=AliasChoices("CLARIO_LOG_LEVEL", "PROCUREMENT_VALIDATOR_LOG_LEVEL"),
    )
    data_directory: Path = Field(
        default_factory=default_data_directory,
        validation_alias=AliasChoices("CLARIO_DATA_DIRECTORY", "PROCUREMENT_VALIDATOR_DATA_DIRECTORY"),
    )

    @property
    def database_path(self) -> Path:
        return self.data_directory / CLARIO_DATABASE_NAME

    @property
    def sessions_directory(self) -> Path:
        return self.data_directory / "sessions"

    @property
    def upload_directory(self) -> Path:
        return self.data_directory / "working-files"

    @property
    def report_directory(self) -> Path:
        return self.data_directory / "reports"


@lru_cache
def get_settings() -> Settings:
    return Settings()
