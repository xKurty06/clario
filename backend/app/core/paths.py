from pathlib import Path


def ensure_private_directory(path: Path) -> Path:
    """Create an application-owned local directory when persistence is enabled."""
    path.mkdir(parents=True, exist_ok=True)
    return path

