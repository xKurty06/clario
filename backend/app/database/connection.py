import sqlite3
from contextlib import contextmanager
from collections.abc import Iterator

from app.config.settings import get_settings


@contextmanager
def database() -> Iterator[sqlite3.Connection]:
    settings = get_settings()
    settings.data_directory.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(settings.database_path)
    connection.row_factory = sqlite3.Row
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
